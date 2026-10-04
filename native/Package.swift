// swift-tools-version: 6.2
import PackageDescription

let package = Package(
    name: "OpenLoop",
    platforms: [.macOS(.v15)],
    products: [
        .library(name: "OpenLoopCore", targets: ["OpenLoopCore"]),
        .library(name: "OpenLoopEngines", targets: ["OpenLoopEngines"]),
        .library(name: "OpenLoopAudio", targets: ["OpenLoopAudio"]),
        .executable(name: "OpenLoop", targets: ["OpenLoopApp"]),
        .executable(name: "openloop-cli", targets: ["OpenLoopCLI"]),
    ],
    targets: [
        .systemLibrary(name: "CSQLite"),
        .target(name: "OpenLoopCore", dependencies: ["CSQLite"]),
        .target(name: "OpenLoopEngines", dependencies: ["OpenLoopCore"], resources: [.process("Resources")]),
        .target(name: "OpenLoopAudio", dependencies: ["OpenLoopCore"]),
        .executableTarget(name: "OpenLoopApp", dependencies: ["OpenLoopCore", "OpenLoopEngines", "OpenLoopAudio"]),
        .target(name: "OpenLoopCLIKit", dependencies: ["OpenLoopCore", "OpenLoopEngines"]),
        .executableTarget(name: "OpenLoopCLI", dependencies: ["OpenLoopCLIKit"]),
        .testTarget(name: "OpenLoopCoreTests", dependencies: ["OpenLoopCore", "OpenLoopEngines", "OpenLoopAudio", "OpenLoopCLIKit", "CSQLite"], resources: [.copy("Fixtures")]),
    ]
)
