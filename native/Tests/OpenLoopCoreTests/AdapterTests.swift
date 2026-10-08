import Foundation
import OpenLoopCLIKit
import OpenLoopCore
import OpenLoopEngines
import Testing

@Test func aceAdapterMapsRequestAndDownloadsLocalArtifactsThroughHTTPContract() async throws {
  let root = try temporaryDirectory()
  defer { try? FileManager.default.removeItem(at: root) }
  let server = Process()
  let pipe = Pipe()
  server.executableURL = URL(fileURLWithPath: "/usr/bin/python3")
  server.arguments = [
    try #require(
      Bundle.module.url(forResource: "ace-server", withExtension: "py", subdirectory: "Fixtures")
    ).path
  ]
  server.standardOutput = pipe
  try server.run()
  defer {
    server.terminate()
    server.waitUntilExit()
  }
  let text = String(decoding: pipe.fileHandleForReading.availableData, as: UTF8.self)
    .trimmingCharacters(in: .whitespacesAndNewlines)
  let port = try #require(Int(text))
  var settings = Settings()
  settings.backendPort = port
  let runtimeSettings = settings
  let runtime = AceRuntime(
    directory: root, bundledUV: root.appendingPathComponent("unused-uv"),
    settingsProvider: { runtimeSettings })
  let adapter = AceStepEngine(runtime: runtime)
  let core = try OpenLoopCore(directory: root, engines: [adapter])
  let selection = try EngineCatalog.firstParty.selection(configurationID: "ace-step/pro")
  let seed: Int64 = 9_007_199_254_740_993
  let task = try await core.submit(.init(selection: selection, prompt: "ambient piano", seed: seed))
  for try await _ in try await core.run(taskID: task.id) {}
  let record = try #require(try await core.workspace().history.first)
  #expect(record.seed == seed)
  #expect(record.artifacts.count == 2)
  #expect(
    try Data(contentsOf: #require(record.artifacts.first(where: { $0.kind == .audio })).url)
      == Data("local audio".utf8))
  let metadata = try #require(record.artifacts.first(where: { $0.kind == .metadata }))
  let value =
    try JSONSerialization.jsonObject(with: Data(contentsOf: metadata.url)) as? [[String: Any]]
  #expect(value?.first?["model"] as? String == "acestep-v15-xl-turbo")
  #expect(value?.first?["prompt"] as? String == "ambient piano")
  let random = try await core.submit(.init(selection: selection, prompt: "random seed"))
  for try await _ in try await core.run(taskID: random.id) {}
  #expect(try await core.workspace().history.first(where: { $0.taskID == random.id })?.seed == 1234)
  let unknown = try await core.submit(.init(selection: selection, prompt: "omit-seed", seed: 42))
  for try await _ in try await core.run(taskID: unknown.id) {}
  #expect(try await core.workspace().history.first(where: { $0.taskID == unknown.id })?.seed == nil)
}
@Test func unboundEnginesCannotBeSelectedOrInstalled() throws {
  let catalog = EngineCatalog.firstParty
  #expect(throws: CoreError.self) { try catalog.selection(configurationID: "minimax-music3/turbo") }
  #expect(catalog.packs.first(where: { $0.id == "minimax-music3/turbo" })?.installable == false)
  #expect(catalog.runtimes.first?.supportsCurrentMachine() == true)
  for pack in catalog.packs where pack.installable {
    let files = try EngineCatalog.modelFiles(packID: pack.id)
    for component in ["acestep-v15-turbo", "vae", "Qwen3-Embedding-0.6B", "acestep-5Hz-lm-1.7B"] {
      #expect(
        files.contains {
          $0.localPath.hasPrefix(component + "/") && $0.localPath.hasSuffix(".safetensors")
        })
    }
    #expect(!files.contains { $0.localPath.hasSuffix(".py") })
  }
}
@Test func adapterRejectsUnknownOrUnversionedExpertOptions() throws {
  let root = try temporaryDirectory()
  defer { try? FileManager.default.removeItem(at: root) }
  let adapter = AceStepEngine(
    runtime: AceRuntime(directory: root, bundledUV: root, settingsProvider: { Settings() }))
  let selection = try EngineCatalog.firstParty.selection(configurationID: "ace-step/turbo")
  #expect(throws: CoreError.self) {
    try adapter.payload(
      for: .init(selection: selection, prompt: "piano", engineOptions: .init(version: 2)))
  }
  #expect(throws: CoreError.self) {
    try adapter.payload(
      for: .init(
        selection: selection, prompt: "piano",
        engineOptions: .init(values: ["imaginedOption": .bool(true)])))
  }
  #expect(throws: CoreError.self) {
    try adapter.payload(
      for: .init(
        selection: selection, prompt: "piano",
        engineOptions: .init(values: ["repaintStart": .number(1)])))
  }
}
@Test func liteRequestsDoNotRequireAnUnloadedLanguageModel() throws {
  let root = try temporaryDirectory()
  defer { try? FileManager.default.removeItem(at: root) }
  let adapter = AceStepEngine(
    runtime: AceRuntime(directory: root, bundledUV: root, settingsProvider: { Settings() }))
  let selection = try EngineCatalog.firstParty.selection(configurationID: "ace-step/lite")
  let payload = try adapter.payload(for: .init(selection: selection, prompt: "piano"))
  let values = try JSONDecoder().decode(
    [String: JSONValue].self, from: JSONEncoder().encode(payload))
  for flag in ["thinking", "use_format", "use_cot_caption", "use_cot_language"] {
    #expect(values[flag] == .bool(false))
  }
  #expect(throws: CoreError.self) {
    try adapter.payload(
      for: .init(
        selection: selection, prompt: "piano",
        engineOptions: .init(values: ["thinking": .bool(true)])))
  }
}
@Test func aceAdapterMapsTheEngineNeutralEditRegionToRepaint() throws {
  let root = try temporaryDirectory()
  defer { try? FileManager.default.removeItem(at: root) }
  let adapter = AceStepEngine(
    runtime: AceRuntime(directory: root, bundledUV: root, settingsProvider: { Settings() }))
  let selection = try EngineCatalog.firstParty.selection(configurationID: "ace-step/turbo")
  let source = root.appendingPathComponent("source.wav")
  let value = try adapter.payload(
    for: .init(
      selection: selection, prompt: "brighter chorus", duration: 40, parentTakeID: "parent",
      operation: .repaint, references: [source], editRegion: .init(start: 12.5, end: 20)))
  guard case .object(let payload) = value else {
    Issue.record("ACE-Step payload must be an object")
    return
  }
  #expect(payload["task_type"] == .string("repaint"))
  #expect(payload["src_audio_path"] == .string(source.path))
  #expect(payload["repainting_start"] == .number(12.5))
  #expect(payload["repainting_end"] == .number(20))
  #expect(payload["audio_duration"] == .number(40))
  #expect(throws: CoreError.self) {
    try adapter.payload(
      for: .init(
        selection: selection, prompt: "longer", duration: 60, parentTakeID: "parent",
        operation: .extend, references: [source], editRegion: .init(start: 40, end: 60)))
  }
}

@Test func ownedRuntimeLaunchesWithBundledUVAndStopsItsChild() async throws {
  let root = try temporaryDirectory()
  defer { try? FileManager.default.removeItem(at: root) }
  // Reserve a free local port using the same HTTP fixture, then release it.
  let fixture = try #require(
    Bundle.module.url(forResource: "ace-server", withExtension: "py", subdirectory: "Fixtures"))
  let reservation = Process()
  let pipe = Pipe()
  reservation.executableURL = URL(fileURLWithPath: "/usr/bin/python3")
  reservation.arguments = [fixture.path]
  reservation.standardOutput = pipe
  try reservation.run()
  let port = try #require(
    Int(
      String(decoding: pipe.fileHandleForReading.availableData, as: UTF8.self).trimmingCharacters(
        in: .whitespacesAndNewlines)))
  reservation.terminate()
  reservation.waitUntilExit()
  let uv = root.appendingPathComponent("uv")
  try Data(
    "#!/bin/sh\n[ \"$ACESTEP_NO_INIT\" = false ] || exit 42\n[ \"$(readlink \"$ACESTEP_PROJECT_ROOT/checkpoints\")\" = \"$ACESTEP_CHECKPOINTS_DIR\" ] || exit 43\nexec /usr/bin/python3 '\(fixture.path)'\n"
      .utf8
  ).write(to: uv)
  try FileManager.default.setAttributes([.posixPermissions: 0o755], ofItemAtPath: uv.path)
  let working = root.appendingPathComponent("runtime")
  try FileManager.default.createDirectory(at: working, withIntermediateDirectories: true)
  try Data("[project]\n[tool.uv]\nconstraint-dependencies = [\"mlx==0.31.1\"]\n".utf8)
    .write(to: working.appendingPathComponent("pyproject.toml"))
  let models = root.appendingPathComponent("models")
  for file in try EngineCatalog.modelFiles(packID: "ace-step/standard") {
    let path = models.appendingPathComponent(file.localPath)
    try FileManager.default.createDirectory(
      at: path.deletingLastPathComponent(), withIntermediateDirectories: true)
    FileManager.default.createFile(atPath: path.path, contents: nil)
    let handle = try FileHandle(forWritingTo: path)
    try handle.truncate(atOffset: UInt64(file.size))
    try handle.close()
  }
  var settings = Settings()
  settings.backendPort = port
  settings.runtimeDirectory = working
  settings.modelDirectory = models
  let environment = try await OpenLoopEnvironment.open(directory: root, bundledUV: uv)
  try await environment.core.updateSettings(settings)
  let runtime = environment.runtime
  try await runtime.ensureReady(
    selection: EngineCatalog.firstParty.selection(configurationID: "ace-step/lite")
  ) { _ in }
  let health = URL(string: "http://127.0.0.1:\(port)/health")!
  let (_, response) = try await URLSession.shared.data(from: health)
  #expect((response as? HTTPURLResponse)?.statusCode == 200)
  let task = try await environment.core.submit(
    .init(
      selection: EngineCatalog.firstParty.selection(configurationID: "ace-step/lite"),
      prompt: "new settings", seed: 42))
  for try await _ in try await environment.core.run(taskID: task.id) {}
  #expect(try await environment.core.workspace().history.first?.seed == 42)
  try await runtime.stop()
  await #expect(throws: (any Error).self) { _ = try await URLSession.shared.data(from: health) }
  let requestFile = root.appendingPathComponent("cancel-startup.json")
  try JSONEncoder().encode(
    GenerationRequest(
      selection: EngineCatalog.firstParty.selection(configurationID: "ace-step/lite"),
      prompt: "cancel startup")
  ).write(to: requestFile)
  let cli = OpenLoopCLI(environment: environment)
  let execution = Task {
    try await cli.execute(arguments: ["run", "--request", requestFile.path]) { event in
      if event.kind == "lifecycle", case .object(let data) = event.data,
        data["message"] == .string("Starting local Engine")
      {
        withUnsafeCurrentTask { $0?.cancel() }
      }
    }
  }
  await #expect(throws: CancellationError.self) { try await execution.value }
  await #expect(throws: (any Error).self) { _ = try await URLSession.shared.data(from: health) }
  #expect(
    try await environment.core.workspace().tasks.contains {
      $0.request.prompt == "cancel startup" && $0.state == .cancelled
    })
}

@Test func existingRuntimePinsCompatibleMLXBeforeSync() async throws {
  let root = try temporaryDirectory()
  defer { try? FileManager.default.removeItem(at: root) }
  let working = root.appendingPathComponent("native-runtime/ace-step")
  try FileManager.default.createDirectory(at: working, withIntermediateDirectories: true)
  let project = working.appendingPathComponent("pyproject.toml")
  try "[project]\n[tool.uv]\n".write(to: project, atomically: true, encoding: .utf8)
  let uv = root.appendingPathComponent("uv")
  try
    "#!/bin/sh\n[ \"$1\" = sync ] || exit 1\ngrep -q 'mlx==0.31.1' pyproject.toml || exit 2\ntouch synced\n"
    .write(to: uv, atomically: true, encoding: .utf8)
  try FileManager.default.setAttributes([.posixPermissions: 0o755], ofItemAtPath: uv.path)
  let runtime = AceRuntime(directory: root, bundledUV: uv, settingsProvider: { Settings() })
  try await runtime.provision(licenseAccepted: true) { _ in }
  #expect(FileManager.default.fileExists(atPath: working.appendingPathComponent("synced").path))
  try await runtime.provision(licenseAccepted: true) { _ in }
  #expect(
    try String(contentsOf: project, encoding: .utf8).components(
      separatedBy: "constraint-dependencies"
    ).count == 2)
}
