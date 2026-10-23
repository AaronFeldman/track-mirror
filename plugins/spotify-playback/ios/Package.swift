// swift-tools-version:5.5
import PackageDescription

let package = Package(
    name: "track-mirror-spotify-playback",
    platforms: [
        .iOS(.v13),
    ],
    products: [
        .library(
            name: "track-mirror-spotify-playback",
            type: .static,
            targets: ["track-mirror-spotify-playback"]
        ),
    ],
    dependencies: [
        .package(name: "Tauri", path: "../.tauri/tauri-api"),
        .package(url: "https://github.com/spotify/ios-sdk.git", exact: "5.0.1"),
    ],
    targets: [
        .target(
            name: "track-mirror-spotify-playback",
            dependencies: [
                .byName(name: "Tauri"),
                .product(name: "SpotifyiOS", package: "ios-sdk"),
            ],
            path: "Sources"
        ),
    ]
)
