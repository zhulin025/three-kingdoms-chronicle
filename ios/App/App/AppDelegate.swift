import UIKit
import Capacitor
import Photos
import PhotosUI
import AVFoundation

class MainViewController: CAPBridgeViewController {
    override func capacitorDidLoad() {
        // Capacitor auto-registers package plugins; app-local plugins must be added as an instance.
        bridge?.registerPluginInstance(PhotoLibraryPlugin())
        bridge?.registerPluginInstance(GenerationIslandPlugin())
        bridge?.registerPluginInstance(ImagePickerPlugin())
    }
}

/// Uses the native Photos picker instead of WKWebView's file input. The latter
/// can lose its selected file when the app resumes while a generation is active.
class ImagePickerPlugin: CAPPlugin, CAPBridgedPlugin, PHPickerViewControllerDelegate {
    let identifier = "ImagePickerPlugin"
    let jsName = "NativeImagePicker"
    let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "pickImage", returnType: CAPPluginReturnPromise)
    ]
    private var pendingCall: CAPPluginCall?

    @objc func pickImage(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            guard self.pendingCall == nil else {
                call.reject("图片选择窗口已打开")
                return
            }
            guard let viewController = self.bridge?.viewController else {
                call.reject("无法打开系统相册")
                return
            }

            var configuration = PHPickerConfiguration(photoLibrary: .shared())
            configuration.filter = .images
            configuration.selectionLimit = 1
            configuration.preferredAssetRepresentationMode = .current
            let picker = PHPickerViewController(configuration: configuration)
            picker.delegate = self
            self.pendingCall = call
            viewController.present(picker, animated: true)
        }
    }

    func picker(_ picker: PHPickerViewController, didFinishPicking results: [PHPickerResult]) {
        picker.dismiss(animated: true)
        guard let call = pendingCall else { return }
        guard let result = results.first else {
            finish(call, error: "没有选择图片")
            return
        }
        let provider = result.itemProvider
        guard provider.canLoadObject(ofClass: UIImage.self) else {
            finish(call, error: "这张图片无法读取，请选择另一张图片")
            return
        }
        provider.loadObject(ofClass: UIImage.self) { [weak self] object, error in
            guard let self else { return }
            guard let image = object as? UIImage, error == nil,
                  let data = self.jpegData(from: image) else {
                self.finish(call, error: "系统未能读取这张图片。请等待 iCloud 照片下载完成后重试。")
                return
            }
            self.finish(call, dataUrl: "data:image/jpeg;base64,\(data.base64EncodedString())")
        }
    }

    private func jpegData(from image: UIImage) -> Data? {
        let maxDimension: CGFloat = 2048
        let originalSize = image.size
        let scale = min(1, maxDimension / max(originalSize.width, originalSize.height))
        let targetSize = CGSize(width: max(1, floor(originalSize.width * scale)), height: max(1, floor(originalSize.height * scale)))
        let renderer = UIGraphicsImageRenderer(size: targetSize)
        let normalized = renderer.image { _ in
            image.draw(in: CGRect(origin: .zero, size: targetSize))
        }
        return normalized.jpegData(compressionQuality: 0.92)
    }

    private func finish(_ call: CAPPluginCall, dataUrl: String? = nil, error: String? = nil) {
        DispatchQueue.main.async {
            guard self.pendingCall === call else { return }
            self.pendingCall = nil
            if let dataUrl {
                call.resolve(["dataUrl": dataUrl, "filename": "mergegen-input.jpg"])
            } else {
                call.reject(error ?? "无法读取图片")
            }
        }
    }
}

class GenerationIslandPlugin: CAPPlugin, CAPBridgedPlugin {
    let identifier = "GenerationIslandPlugin"
    let jsName = "GenerationIsland"
    let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "showLoading", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "showResult", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "hide", returnType: CAPPluginReturnPromise)
    ]
    private let presentation = GenerationIslandPresentation()

    @objc func showLoading(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            guard let host = self.bridge?.viewController?.view else {
                call.reject("无法显示生成状态")
                return
            }
            self.presentation.showLoading(
                phase: call.getString("phase") ?? "generating",
                progress: call.getInt("progress"),
                loadedBytes: call.getDouble("loadedBytes"),
                totalBytes: call.getDouble("totalBytes"),
                taskCount: call.getInt("taskCount") ?? 1,
                in: host
            )
            call.resolve()
        }
    }

    @objc func showResult(_ call: CAPPluginCall) {
        let recordId = call.getString("recordId") ?? ""
        guard let dataUrl = call.getString("imageDataUrl"),
              let comma = dataUrl.firstIndex(of: ","),
              let data = Data(base64Encoded: String(dataUrl[dataUrl.index(after: comma)...])),
              let image = UIImage(data: data) else {
            call.reject("生成图预览数据无效")
            return
        }
        DispatchQueue.main.async {
            guard let host = self.bridge?.viewController?.view else {
                call.reject("无法显示生成结果")
                return
            }
            self.presentation.onOpenDetail = { [weak self] recordId in
                self?.notifyListeners("openDetail", data: ["recordId": recordId])
            }
            self.presentation.showResult(image: image, recordId: recordId, in: host)
            call.resolve()
        }
    }

    @objc func hide(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            self.presentation.hide()
            call.resolve()
        }
    }
}

private final class GenerationIslandPresentation: NSObject {
    private weak var host: UIView?
    private var overlay: UIView?
    private var backdrop: UIVisualEffectView?
    private var island: UIView?
    private var loadingIndicator: UIActivityIndicatorView?
    private var loadingLabel: UILabel?
    private var taskCountBadge: UILabel?
    private var photoCard: UIView?
    private var closeButton: UIButton?
    private var detailButton: UIButton?
    private var recordId = ""
    var onOpenDetail: ((String) -> Void)?

    func showLoading(phase: String, progress: Int?, loadedBytes: Double?, totalBytes: Double?, taskCount: Int, in host: UIView) {
        attach(to: host)
        guard let island, let indicator = loadingIndicator, let label = loadingLabel else { return }
        let wasHidden = island.isHidden
        overlay?.isUserInteractionEnabled = true
        backdrop?.removeFromSuperview()
        backdrop = nil
        closeButton?.removeFromSuperview()
        closeButton = nil
        photoCard?.removeFromSuperview()
        photoCard = nil
        island.isHidden = false
        island.alpha = 1
        indicator.startAnimating()
        if phase == "downloading" {
            label.font = .monospacedDigitSystemFont(ofSize: 8.5, weight: .semibold)
            label.text = "下载中\n\(downloadLabel(loadedBytes: loadedBytes, totalBytes: totalBytes))"
        } else {
            label.font = .systemFont(ofSize: 10, weight: .semibold)
            label.text = progress.map { "生成中 \($0)%" } ?? "生成中"
        }
        taskCountBadge?.isHidden = taskCount <= 1
        taskCountBadge?.text = "\(min(taskCount, 99))"
        let statusText = label.text ?? ""
        island.accessibilityLabel = taskCount > 1 ? "\(taskCount) 个任务进行中，\(statusText)" : "任务进行中，\(statusText)"
        if wasHidden {
            island.transform = CGAffineTransform(scaleX: 0.72, y: 0.72)
            island.alpha = 0
            UIView.animate(withDuration: 0.32, delay: 0, usingSpringWithDamping: 0.82, initialSpringVelocity: 0.4) {
                island.transform = .identity
                island.alpha = 1
            }
        }
    }

    func showResult(image: UIImage, recordId: String, in host: UIView) {
        attach(to: host)
        guard let island, let overlay else { return }
        self.recordId = recordId
        overlay.isUserInteractionEnabled = true
        loadingIndicator?.stopAnimating()
        loadingLabel?.text = "生成完成"

        let blur = UIVisualEffectView(effect: UIBlurEffect(style: .systemChromeMaterialLight))
        blur.frame = overlay.bounds
        blur.autoresizingMask = [.flexibleWidth, .flexibleHeight]
        blur.alpha = 0
        overlay.insertSubview(blur, at: 0)
        backdrop?.removeFromSuperview()
        backdrop = blur

        let card = makePhotoCard(image: image, in: overlay)
        overlay.addSubview(card)
        photoCard = card
        let startOffset = islandCenter(in: overlay).y - card.frame.minY + 24
        card.transform = CGAffineTransform(translationX: 0, y: startOffset).scaledBy(x: 0.34, y: 0.34)
        card.alpha = 0
        island.isHidden = false
        addCloseButton(to: overlay)

        UIView.animate(withDuration: 0.22, delay: 0.1, options: [.curveEaseOut]) {
            island.transform = CGAffineTransform(scaleX: 0.78, y: 0.78)
            island.alpha = 0
            blur.alpha = 1
        } completion: { _ in
            island.isHidden = true
            island.alpha = 1
            island.transform = .identity
        }
        UIView.animate(withDuration: 0.68, delay: 0.12, usingSpringWithDamping: 0.74, initialSpringVelocity: 0.45, options: [.curveEaseOut]) {
            card.transform = .identity
            card.alpha = 1
        }
    }

    @objc func hide() {
        guard let island else { return }
        UIView.animate(withDuration: 0.24, animations: {
            self.photoCard?.alpha = 0
            self.photoCard?.transform = CGAffineTransform(translationX: 0, y: -20).scaledBy(x: 0.96, y: 0.96)
            self.backdrop?.alpha = 0
            self.closeButton?.alpha = 0
            island.alpha = 0
        }, completion: { _ in
            self.photoCard?.removeFromSuperview()
            self.photoCard = nil
            self.closeButton?.removeFromSuperview()
            self.closeButton = nil
            self.backdrop?.removeFromSuperview()
            self.backdrop = nil
            self.overlay?.removeFromSuperview()
            self.overlay = nil
            self.island = nil
            self.loadingIndicator = nil
            self.loadingLabel = nil
            self.taskCountBadge = nil
        })
    }

    @objc private func openDetail() {
        let target = recordId
        hide()
        guard !target.isEmpty else { return }
        onOpenDetail?(target)
    }

    private func attach(to host: UIView) {
        if self.host !== host || island == nil {
            overlay?.removeFromSuperview()
            self.host = host
            let container = PassthroughView(frame: host.bounds)
            container.autoresizingMask = [.flexibleWidth, .flexibleHeight]
            host.addSubview(container)
            overlay = container
            let safeBottom = container.window?.safeAreaInsets.bottom ?? host.safeAreaInsets.bottom
            let size: CGFloat = 68
            let tabClearance: CGFloat = 78
            let view = DraggableGenerationBubble(frame: CGRect(x: 16, y: container.bounds.height - safeBottom - size - tabClearance - 12, width: size, height: size))
            view.autoresizingMask = [.flexibleRightMargin, .flexibleTopMargin]
            view.backgroundColor = UIColor(white: 0.025, alpha: 0.98)
            view.layer.cornerRadius = size / 2
            view.clipsToBounds = true
            container.addSubview(view)
            island = view

            let indicator = UIActivityIndicatorView(style: .medium)
            indicator.color = .white
            indicator.frame = CGRect(x: 24, y: 10, width: 20, height: 20)
            view.addSubview(indicator)
            loadingIndicator = indicator

            let label = UILabel(frame: CGRect(x: 4, y: 30, width: 60, height: 30))
            label.font = .systemFont(ofSize: 11, weight: .semibold)
            label.textColor = UIColor(white: 1, alpha: 0.94)
            label.text = "生成中"
            label.textAlignment = .center
            label.numberOfLines = 2
            label.lineBreakMode = .byTruncatingTail
            view.addSubview(label)
            loadingLabel = label

            let badge = UILabel(frame: CGRect(x: 47, y: 2, width: 19, height: 19))
            badge.backgroundColor = UIColor(red: 0.10, green: 0.72, blue: 0.63, alpha: 1)
            badge.textColor = .white
            badge.font = .monospacedDigitSystemFont(ofSize: 10, weight: .bold)
            badge.textAlignment = .center
            badge.layer.cornerRadius = 9.5
            badge.clipsToBounds = true
            badge.isHidden = true
            view.addSubview(badge)
            taskCountBadge = badge
        }
    }

    private func downloadLabel(loadedBytes: Double?, totalBytes: Double?) -> String {
        let formatter = ByteCountFormatter()
        formatter.countStyle = .file
        formatter.allowedUnits = [.useKB, .useMB]
        formatter.includesUnit = true
        formatter.isAdaptive = true
        let loaded = formatter.string(fromByteCount: Int64(loadedBytes ?? 0))
        guard let totalBytes, totalBytes > 0 else { return "↓ \(loaded)" }
        return "↓ \(loaded)/\(formatter.string(fromByteCount: Int64(totalBytes)))"
    }

    private func islandCenter(in host: UIView) -> CGPoint {
        island?.center ?? CGPoint(x: host.bounds.midX, y: host.safeAreaInsets.top + 34)
    }

    private func makePhotoCard(image: UIImage, in host: UIView) -> UIView {
        let width = min(host.bounds.width - 42, 286)
        let height = width + 118
        let frame = CGRect(x: (host.bounds.width - width) / 2, y: max(108, (host.bounds.height - height) / 2 - 20), width: width, height: height)
        let card = UIView(frame: frame)
        card.backgroundColor = .white
        card.layer.cornerRadius = 5
        card.layer.cornerCurve = .continuous
        card.layer.shadowColor = UIColor.black.cgColor
        card.layer.shadowOpacity = 0.22
        card.layer.shadowRadius = 18
        card.layer.shadowOffset = CGSize(width: 0, height: 9)
        card.clipsToBounds = false

        let imageView = UIImageView(frame: CGRect(x: 10, y: 10, width: width - 20, height: width - 20))
        imageView.image = image
        imageView.contentMode = .scaleAspectFill
        imageView.clipsToBounds = true
        card.addSubview(imageView)

        let caption = UILabel(frame: CGRect(x: 14, y: width - 2, width: width - 28, height: 34))
        caption.text = "MERGEGEN  ·  JUST DEVELOPED"
        caption.textAlignment = .center
        caption.font = .monospacedSystemFont(ofSize: 10, weight: .medium)
        caption.textColor = UIColor(white: 0.18, alpha: 0.75)
        card.addSubview(caption)

        let button = UIButton(type: .system)
        button.frame = CGRect(x: 14, y: width + 38, width: width - 28, height: 48)
        button.setTitle("查看生成详情", for: .normal)
        button.titleLabel?.font = .systemFont(ofSize: 16, weight: .semibold)
        button.setTitleColor(.white, for: .normal)
        button.backgroundColor = UIColor(red: 0.09, green: 0.55, blue: 0.50, alpha: 1)
        button.layer.cornerRadius = 14
        button.layer.cornerCurve = .continuous
        button.addTarget(self, action: #selector(openDetail), for: .touchUpInside)
        card.addSubview(button)
        detailButton = button
        return card
    }

    private func addCloseButton(to host: UIView) {
        closeButton?.removeFromSuperview()
        let button = UIButton(type: .system)
        button.frame = CGRect(x: host.bounds.width - 54, y: 16, width: 38, height: 38)
        button.autoresizingMask = [.flexibleLeftMargin, .flexibleBottomMargin]
        button.setImage(UIImage(systemName: "xmark"), for: .normal)
        button.tintColor = UIColor(white: 0.08, alpha: 0.82)
        button.backgroundColor = UIColor(white: 1, alpha: 0.78)
        button.layer.cornerRadius = 19
        button.addTarget(self, action: #selector(hide), for: .touchUpInside)
        host.addSubview(button)
        closeButton = button
    }
}

private final class PassthroughView: UIView {
    override func point(inside point: CGPoint, with event: UIEvent?) -> Bool {
        subviews.reversed().contains { !$0.isHidden && $0.alpha > 0.01 && $0.point(inside: convert(point, to: $0), with: event) }
    }
}

private final class DraggableGenerationBubble: UIView {
    override init(frame: CGRect) {
        super.init(frame: frame)
        addGestureRecognizer(UIPanGestureRecognizer(target: self, action: #selector(drag(_:))))
        accessibilityLabel = "正在生成，可拖动"
    }

    required init?(coder: NSCoder) { nil }

    @objc private func drag(_ gesture: UIPanGestureRecognizer) {
        guard let parent = superview else { return }
        let translation = gesture.translation(in: parent)
        var next = CGPoint(x: center.x + translation.x, y: center.y + translation.y)
        let radius = bounds.width / 2
        next.x = min(max(radius + 8, next.x), parent.bounds.width - radius - 8)
        next.y = min(max(radius + 8, next.y), parent.bounds.height - radius - 8)
        center = next
        gesture.setTranslation(.zero, in: parent)
    }
}

class PhotoLibraryPlugin: CAPPlugin, CAPBridgedPlugin {
    let identifier = "PhotoLibraryPlugin"
    let jsName = "PhotoLibrary"
    let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "saveImage", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "saveVideo", returnType: CAPPluginReturnPromise)
    ]

    @objc func saveImage(_ call: CAPPluginCall) {
        guard let dataUrl = call.getString("dataUrl"),
              let comma = dataUrl.firstIndex(of: ","),
              let data = Data(base64Encoded: String(dataUrl[dataUrl.index(after: comma)...])),
              let image = UIImage(data: data) else {
            call.reject("图片数据无效")
            return
        }

        let save = {
            PHPhotoLibrary.shared().performChanges({
                PHAssetChangeRequest.creationRequestForAsset(from: image)
            }) { success, error in
                DispatchQueue.main.async {
                    if success {
                        call.resolve()
                    } else {
                        call.reject(error?.localizedDescription ?? "无法保存到系统相册")
                    }
                }
            }
        }

        let status = PHPhotoLibrary.authorizationStatus(for: .addOnly)
        if status == .authorized || status == .limited {
            save()
        } else if status == .notDetermined {
            PHPhotoLibrary.requestAuthorization(for: .addOnly) { nextStatus in
                if nextStatus == .authorized || nextStatus == .limited {
                    save()
                } else {
                    DispatchQueue.main.async { call.reject("未获得保存图片到相册的权限") }
                }
            }
        } else {
            call.reject("未获得保存图片到相册的权限")
        }
    }

    @objc func saveVideo(_ call: CAPPluginCall) {
        guard let dataUrl = call.getString("dataUrl"),
              let comma = dataUrl.firstIndex(of: ","),
              let data = Data(base64Encoded: String(dataUrl[dataUrl.index(after: comma)...])) else {
            call.reject("视频数据无效")
            return
        }

        let durationSec = call.getDouble("duration") ?? 10.0
        let save = {
            let tempInputUrl = FileManager.default.temporaryDirectory.appendingPathComponent("mergegen-raw-\(UUID().uuidString).mp4")
            let tempOutputUrl = FileManager.default.temporaryDirectory.appendingPathComponent("mergegen-fixed-\(UUID().uuidString).mp4")
            do {
                try data.write(to: tempInputUrl, options: .atomic)
            } catch {
                call.reject("无法写入临时视频文件")
                return
            }

            let asset = AVAsset(url: tempInputUrl)
            let composition = AVMutableComposition()
            let durationTime = CMTime(seconds: durationSec, preferredTimescale: 600)
            
            let videoTracks = asset.tracks(withMediaType: .video)
            let audioTracks = asset.tracks(withMediaType: .audio)
            var didSucceed = false
            
            if let videoTrack = videoTracks.first {
                let compositionVideoTrack = composition.addMutableTrack(withMediaType: .video, preferredTrackID: kCMPersistentTrackID_Invalid)
                let timeRange = CMTimeRange(start: videoTrack.timeRange.start, duration: durationTime)
                do {
                    try compositionVideoTrack?.insertTimeRange(timeRange, of: videoTrack, at: .zero)
                    didSucceed = true
                } catch {
                    // Fallback
                }
            }
            
            if let audioTrack = audioTracks.first {
                let compositionAudioTrack = composition.addMutableTrack(withMediaType: .audio, preferredTrackID: kCMPersistentTrackID_Invalid)
                let timeRange = CMTimeRange(start: audioTrack.timeRange.start, duration: durationTime)
                do {
                    try compositionAudioTrack?.insertTimeRange(timeRange, of: audioTrack, at: .zero)
                } catch {
                    // Fallback
                }
            }

            let assetToExport: AVAsset = didSucceed ? composition : asset
            guard let exportSession = AVAssetExportSession(asset: assetToExport, presetName: AVAssetExportPresetPassthrough) else {
                self.saveVideoToLibrary(fileURL: tempInputUrl, call: call)
                return
            }

            exportSession.outputURL = tempOutputUrl
            exportSession.outputFileType = .mp4
            exportSession.shouldOptimizeForNetworkUse = true

            exportSession.exportAsynchronously {
                DispatchQueue.main.async {
                    if exportSession.status == .completed {
                        try? FileManager.default.removeItem(at: tempInputUrl)
                        self.saveVideoToLibrary(fileURL: tempOutputUrl, call: call)
                    } else {
                        try? FileManager.default.removeItem(at: tempOutputUrl)
                        self.saveVideoToLibrary(fileURL: tempInputUrl, call: call)
                    }
                }
            }
        }

        let status = PHPhotoLibrary.authorizationStatus(for: .addOnly)
        if status == .authorized || status == .limited {
            save()
        } else if status == .notDetermined {
            PHPhotoLibrary.requestAuthorization(for: .addOnly) { nextStatus in
                if nextStatus == .authorized || nextStatus == .limited {
                    save()
                } else {
                    DispatchQueue.main.async { call.reject("未获得保存视频到相册的权限") }
                }
            }
        } else {
            call.reject("未获得保存视频到相册的权限")
        }
    }

    private func saveVideoToLibrary(fileURL: URL, call: CAPPluginCall) {
        PHPhotoLibrary.shared().performChanges({
            PHAssetChangeRequest.creationRequestForAssetFromVideo(atFileURL: fileURL)
        }) { success, error in
            try? FileManager.default.removeItem(at: fileURL)
            DispatchQueue.main.async {
                if success {
                    call.resolve()
                } else {
                    call.reject(error?.localizedDescription ?? "无法保存视频到系统相册")
                }
            }
        }
    }
}

@UIApplicationMain
class AppDelegate: UIResponder, UIApplicationDelegate {

    var window: UIWindow?

    func application(_ application: UIApplication, didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]?) -> Bool {
        // Override point for customization after application launch.
        return true
    }

    func applicationWillResignActive(_ application: UIApplication) {
        // Sent when the application is about to move from active to inactive state. This can occur for certain types of temporary interruptions (such as an incoming phone call or SMS message) or when the user quits the application and it begins the transition to the background state.
        // Use this method to pause ongoing tasks, disable timers, and invalidate graphics rendering callbacks. Games should use this method to pause the game.
    }

    func applicationDidEnterBackground(_ application: UIApplication) {
        // Use this method to release shared resources, save user data, invalidate timers, and store enough application state information to restore your application to its current state in case it is terminated later.
        // If your application supports background execution, this method is called instead of applicationWillTerminate: when the user quits.
    }

    func applicationWillEnterForeground(_ application: UIApplication) {
        // Called as part of the transition from the background to the active state; here you can undo many of the changes made on entering the background.
    }

    func applicationDidBecomeActive(_ application: UIApplication) {
        // Restart any tasks that were paused (or not yet started) while the application was inactive. If the application was previously in the background, optionally refresh the user interface.
    }

    func applicationWillTerminate(_ application: UIApplication) {
        // Called when the application is about to terminate. Save data if appropriate. See also applicationDidEnterBackground:.
    }

    func application(_ app: UIApplication, open url: URL, options: [UIApplication.OpenURLOptionsKey: Any] = [:]) -> Bool {
        // Called when the app was launched with a url. Feel free to add additional processing here,
        // but if you want the App API to support tracking app url opens, make sure to keep this call
        return ApplicationDelegateProxy.shared.application(app, open: url, options: options)
    }

    func application(_ application: UIApplication, continue userActivity: NSUserActivity, restorationHandler: @escaping ([UIUserActivityRestoring]?) -> Void) -> Bool {
        // Called when the app was launched with an activity, including Universal Links.
        // Feel free to add additional processing here, but if you want the App API to support
        // tracking app url opens, make sure to keep this call
        return ApplicationDelegateProxy.shared.application(application, continue: userActivity, restorationHandler: restorationHandler)
    }

}
