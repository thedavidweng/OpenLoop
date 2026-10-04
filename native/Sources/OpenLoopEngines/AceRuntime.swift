import Foundation
import OpenLoopCore

public actor AceRuntime {
  private let directory: URL
  private let uv: URL
  private let settings: Settings
  private let catalog: EngineCatalog
  private var child: Process?
  private var logHandle: FileHandle?
  public init(
    directory: URL, bundledUV: URL, settings: Settings, catalog: EngineCatalog = .firstParty
  ) {
    self.directory = directory
    self.uv = bundledUV
    self.settings = settings
    self.catalog = catalog
  }
  public func provision(licenseAccepted: Bool, emit: EngineEventSink) async throws {
    guard licenseAccepted else {
      throw CoreError.invalid("Review and accept the Engine runtime license before installation")
    }
    let runtime = try descriptor()
    guard runtime.supportsCurrentMachine() else {
      throw CoreError.invalid("Runtime requires Apple Silicon macOS")
    }
    guard FileManager.default.isExecutableFile(atPath: uv.path) else {
      throw CoreError.engine("Bundled uv is missing: \(uv.path)")
    }
    let root = directory.appendingPathComponent("native-runtime")
    try FileManager.default.createDirectory(at: root, withIntermediateDirectories: true)
    let lock = try RuntimeLock(root.appendingPathComponent("runtime.lock"))
    defer { withExtendedLifetime(lock) {} }
    let destination = workingDirectory
    guard !FileManager.default.fileExists(atPath: destination.path) else {
      guard
        FileManager.default.fileExists(
          atPath: destination.appendingPathComponent("pyproject.toml").path)
      else {
        throw CoreError.engine(
          "Existing runtime directory is incomplete; remove it explicitly before reinstalling")
      }
      return
    }
    try await emit(.lifecycle("Installing Engine runtime"))
    let (archive, response) = try await URLSession.shared.download(from: runtime.sourceURL)
    defer { try? FileManager.default.removeItem(at: archive) }
    guard let http = response as? HTTPURLResponse, http.statusCode == 200 else {
      throw CoreError.engine("Runtime source download failed")
    }
    let staging = root.appendingPathComponent(UUID().uuidString)
    try FileManager.default.createDirectory(at: staging, withIntermediateDirectories: true)
    defer {
      if FileManager.default.fileExists(atPath: staging.path) {
        try? FileManager.default.removeItem(at: staging)
      }
    }
    try await command(
      executable: URL(fileURLWithPath: "/usr/bin/tar"),
      arguments: ["-xzf", archive.path, "--strip-components=1", "-C", staging.path],
      working: staging)
    try FileManager.default.createDirectory(
      at: destination.deletingLastPathComponent(), withIntermediateDirectories: true)
    try FileManager.default.moveItem(at: staging, to: destination)
    do { try await command(executable: uv, arguments: ["sync"], working: destination) } catch {
      try FileManager.default.removeItem(at: destination)
      throw error
    }
    try await emit(.lifecycle("Engine runtime installed"))
  }
  private var workingDirectory: URL {
    settings.runtimeDirectory ?? directory.appendingPathComponent("native-runtime/ace-step")
  }
  private func descriptor() throws -> RuntimeDescriptor {
    guard let runtime = catalog.runtimes.first(where: { $0.id == "ace-step/uv" }) else {
      throw CoreError.invalid("ACE-Step Runtime descriptor missing")
    }
    return runtime
  }
  private func command(executable: URL, arguments: [String], working: URL) async throws {
    let process = Process()
    process.executableURL = executable
    process.arguments = arguments
    process.currentDirectoryURL = working
    process.standardOutput = FileHandle.standardError
    process.standardError = FileHandle.standardError
    try process.run()
    do {
      while process.isRunning { try await Task.sleep(for: .milliseconds(100)) }
      guard process.terminationStatus == 0 else {
        throw CoreError.engine(
          "Runtime command failed: \(arguments.first ?? executable.lastPathComponent)")
      }
    } catch {
      if process.isRunning { process.terminate() }
      throw error
    }
  }
  public func ensureReady(selection: Selection, emit: EngineEventSink) async throws {
    let config = try catalog.configuration(selection)
    guard try descriptor().supportsCurrentMachine() else {
      throw CoreError.invalid("Runtime requires Apple Silicon macOS")
    }
    let http = try LocalHTTP(port: settings.backendPort)
    if await healthy(http) {
      try await emit(.lifecycle("Using running local Engine"))
      return
    }
    let lockRoot = directory.appendingPathComponent("native-runtime")
    try FileManager.default.createDirectory(at: lockRoot, withIntermediateDirectories: true)
    let lock = try RuntimeLock(lockRoot.appendingPathComponent("runtime.lock"))
    defer { withExtendedLifetime(lock) {} }
    guard FileManager.default.isExecutableFile(atPath: uv.path),
      FileManager.default.fileExists(
        atPath: workingDirectory.appendingPathComponent("pyproject.toml").path)
    else {
      throw CoreError.engine(
        "Engine runtime is not installed. Run openloop setup --accept-license.")
    }
    if let child, child.isRunning {
      throw CoreError.conflict("Owned runtime is unhealthy; stop it before restarting")
    }
    let modelRoot = settings.modelDirectory ?? directory.appendingPathComponent("models")
    for file in try EngineCatalog.modelFiles(packID: selection.modelPackID) {
      let url = modelRoot.appendingPathComponent(file.localPath)
      guard FileManager.default.fileExists(atPath: url.path),
        (try FileManager.default.attributesOfItem(atPath: url.path)[.size] as? NSNumber)?.int64Value
          == file.size
      else {
        throw CoreError.engine(
          "Selected Model Pack is incomplete. Run openloop models install \(selection.modelPackID) --accept-license."
        )
      }
    }
    let logs = settings.logDirectory ?? directory.appendingPathComponent("logs/backend")
    try FileManager.default.createDirectory(at: logs, withIntermediateDirectories: true)
    let logURL = logs.appendingPathComponent("native-ace-step-\(UUID().uuidString).log")
    FileManager.default.createFile(atPath: logURL.path, contents: nil)
    let handle = try FileHandle(forWritingTo: logURL)
    let process = Process()
    process.executableURL = uv
    process.currentDirectoryURL = workingDirectory
    process.arguments = [
      "run", "acestep-api", "--host", "127.0.0.1", "--port", String(settings.backendPort),
    ]
    if let lm = config.languageModel {
      process.arguments! += ["--init-llm", "--lm-model-path", lm]
    }
    var environment = ProcessInfo.processInfo.environment
    environment.merge([
      "ACESTEP_API_HOST": "127.0.0.1", "ACESTEP_API_PORT": String(settings.backendPort),
      "ACE_STEP_PORT": String(settings.backendPort),
      "ACESTEP_CHECKPOINTS_DIR": modelRoot.path, "ACESTEP_PROJECT_ROOT": workingDirectory.path,
      "ACESTEP_CONFIG_PATH": config.model, "ACESTEP_DEVICE": "mps",
      "ACESTEP_INIT_LLM": config.languageModel == nil ? "false" : "true",
      "ACESTEP_LM_MODEL_PATH": config.languageModel ?? "", "ACESTEP_LM_BACKEND": "mlx",
      "ACESTEP_OFFLOAD_TO_CPU": "true",
    ]) { _, new in new }
    process.environment = environment
    process.standardOutput = handle
    process.standardError = handle
    try process.run()
    child = process
    logHandle = handle
    try await emit(.lifecycle("Starting local Engine"))
    do {
      let deadline = Date().addingTimeInterval(300)
      while Date() < deadline {
        try Task.checkCancellation()
        guard process.isRunning else {
          throw CoreError.engine(
            "Engine exited with status \(process.terminationStatus). See \(logURL.path)")
        }
        if await healthy(http) {
          try await emit(.lifecycle("Local Engine ready"))
          return
        }
        try await Task.sleep(for: .seconds(1))
      }
      throw CoreError.engine("Engine readiness timed out. See \(logURL.path)")
    } catch {
      try await stop()
      throw error
    }
  }
  private func healthy(_ http: LocalHTTP) async -> Bool {
    do {
      _ = try await http.data("/health", timeout: 2)
      return true
    } catch { return false }
  }
  public func stop() async throws {
    if let child, child.isRunning {
      child.terminate()
      let deadline = Date().addingTimeInterval(5)
      while child.isRunning && Date() < deadline { try await Task.sleep(for: .milliseconds(100)) }
      if child.isRunning { throw CoreError.engine("Runtime did not stop after termination") }
    }
    child = nil
    try logHandle?.close()
    logHandle = nil
  }
}
