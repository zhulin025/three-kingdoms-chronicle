import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const appPackagePath = path.join(root, "ios/App/CapApp-SPM/Package.swift");
const resolvedPath = path.join(root, "ios/App/App.xcodeproj/project.xcworkspace/xcshareddata/swiftpm/Package.resolved");
const pluginPackagePaths = [
  "node_modules/@capacitor/app/Package.swift",
  "node_modules/@capacitor/haptics/Package.swift",
  "node_modules/@capacitor/share/Package.swift"
].map((file) => path.join(root, file));

function replaceRemoteCapacitorPackage(filePath, relativePath) {
  if (!fs.existsSync(filePath)) return;
  const current = fs.readFileSync(filePath, "utf8");
  const next = current.replace(
    /\.package\(url: "https:\/\/github\.com\/ionic-team\/capacitor-swift-pm\.git", (?:exact|from): "[^"]+"\)/g,
    `.package(name: "capacitor-swift-pm", path: "${relativePath}")`
  );
  if (next !== current) fs.writeFileSync(filePath, next);
}

replaceRemoteCapacitorPackage(appPackagePath, "../../LocalPackages/capacitor-swift-pm");
for (const pluginPackagePath of pluginPackagePaths) {
  replaceRemoteCapacitorPackage(pluginPackagePath, "../../../ios/LocalPackages/capacitor-swift-pm");
}

fs.mkdirSync(path.dirname(resolvedPath), { recursive: true });
fs.writeFileSync(
  resolvedPath,
  JSON.stringify(
    {
      originHash: "0000000000000000000000000000000000000000000000000000000000000000",
      pins: [],
      version: 3
    },
    null,
    2
  ) + "\n"
);

console.log("Localized iOS SwiftPM dependencies to ios/LocalPackages.");
