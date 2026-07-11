// swift-tools-version:5.3

import PackageDescription

let package = Package(
    name: "capacitor-swift-pm",
    products: [
        .library(
            name: "Capacitor",
            targets: ["Capacitor"]
        ),
        .library(
            name: "Cordova",
            targets: ["Cordova"]
        )
    ],
    targets: [
        .binaryTarget(
            name: "Capacitor",
            path: "Frameworks/Capacitor.xcframework"
        ),
        .binaryTarget(
            name: "Cordova",
            path: "Frameworks/Cordova.xcframework"
        )
    ]
)
