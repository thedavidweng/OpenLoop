import AVFoundation
import Foundation
import OpenLoopCLIKit
import OpenLoopCore
import OpenLoopEngines
import Testing

actor EventLog {
  var events: [CLIEvent] = []
  func append(_ event: CLIEvent) { events.append(event) }
}

@Test func cancellingCLIExecutionCancelsItsGenerationAndRetainsRequest() async throws {
  let root = try temporaryDirectory()
  defer { try? FileManager.default.removeItem(at: root) }
  let core = try OpenLoopCore(directory: root, engines: [WaitingEngine()])
  let environment = OpenLoopEnvironment(
    core: core, catalog: .firstParty,
    runtime: AceRuntime(directory: root, bundledUV: root, settingsProvider: { Settings() }))
  let cli = OpenLoopCLI(environment: environment)
  let request = GenerationRequest(selection: testSelection, prompt: "cancel this")
  let file = root.appendingPathComponent("request.json")
  try JSONEncoder().encode(request).write(to: file)
  let execution = Task {
    try await cli.execute(arguments: ["run", "--request", file.path]) { event in
      if event.kind == "progress" { withUnsafeCurrentTask { $0?.cancel() } }
    }
  }
  await #expect(throws: CancellationError.self) { try await execution.value }
  let workspace = try await core.workspace()
  #expect(workspace.tasks.first?.state == .cancelled)
  #expect(workspace.tasks.first?.request.prompt == "cancel this")
  #expect(workspace.history.isEmpty)
}
@Test func cliStreamsVersionedCoreResultsAndSharesProjectsWithGUI() async throws {
  let root = try temporaryDirectory()
  defer { try? FileManager.default.removeItem(at: root) }
  let core = try OpenLoopCore(directory: root, engines: [FakeEngine()])
  let environment = OpenLoopEnvironment(
    core: core, catalog: .firstParty,
    runtime: AceRuntime(directory: root, bundledUV: root, settingsProvider: { Settings() }))
  let cli = OpenLoopCLI(environment: environment)
  let log = EventLog()
  try await cli.execute(arguments: ["project", "create", "CLI idea"]) { await log.append($0) }
  let project = try #require(try await core.workspace().projects.first)
  let request = GenerationRequest(selection: testSelection, prompt: "piano", projectID: project.id)
  let file = root.appendingPathComponent("request.json")
  try JSONEncoder().encode(request).write(to: file)
  try await cli.execute(arguments: ["run", "--request", file.path]) { await log.append($0) }
  let events = await log.events
  #expect(events.allSatisfy { $0.v == 2 && !$0.ts.isEmpty })
  #expect(events.contains { $0.kind == "progress" })
  let gui = try OpenLoopCore(directory: root, engines: [FakeEngine()])
  #expect(try await gui.workspace().history.first?.request.projectID == project.id)
  await #expect(throws: CoreError.self) {
    try await cli.execute(arguments: ["clear"]) { await log.append($0) }
  }
  #expect(try await gui.workspace().history.count == 1)
}

@Test func failedCLIOutputCancelsItsQueuedGeneration() async throws {
  let root = try temporaryDirectory()
  defer { try? FileManager.default.removeItem(at: root) }
  let core = try OpenLoopCore(directory: root, engines: [FakeEngine()])
  let environment = OpenLoopEnvironment(
    core: core, catalog: .firstParty,
    runtime: AceRuntime(directory: root, bundledUV: root, settingsProvider: { Settings() }))
  let cli = OpenLoopCLI(environment: environment)
  let request = GenerationRequest(selection: testSelection, prompt: "failed output")
  let file = root.appendingPathComponent("request.json")
  try JSONEncoder().encode(request).write(to: file)
  await #expect(throws: CoreError.self) {
    try await cli.execute(arguments: ["run", "--request", file.path]) { _ in
      throw CoreError.invalid("Output unavailable")
    }
  }
  let state = try await core.workspace()
  #expect(state.tasks.first?.state == .cancelled)
  #expect(state.history.isEmpty)
}

@Test func cliRunsAndFiltersProjectsByNameOrID() async throws {
  let root = try temporaryDirectory()
  defer { try? FileManager.default.removeItem(at: root) }
  let core = try OpenLoopCore(directory: root, engines: [FakeEngine()])
  var settings = try await core.settings()
  settings.selection = testSelection
  try await core.updateSettings(settings)
  let cli = OpenLoopCLI(
    environment: OpenLoopEnvironment(
      core: core, catalog: .firstParty,
      runtime: AceRuntime(directory: root, bundledUV: root, settingsProvider: { Settings() })))
  let project = try await core.createProject(name: "Song")
  for name in ["Song", project.id] {
    try await cli.execute(arguments: ["run", "--prompt", "piano", "--project", name]) { _ in }
  }
  try await cli.execute(arguments: ["run", "--prompt", "unfiled"]) { _ in }
  for name in ["Song", project.id] {
    let log = EventLog()
    try await cli.execute(arguments: ["list", "--project", name]) { await log.append($0) }
    let event = try #require(await log.events.first)
    let records = try JSONDecoder().decode(
      [GenerationRecord].self, from: JSONEncoder().encode(event.data))
    #expect(records.count == 2)
    #expect(records.allSatisfy { $0.request.projectID == project.id })
  }
  _ = try await core.createProject(name: "Song")
  for name in ["Song", "Missing"] {
    await #expect(throws: CoreError.self) {
      try await cli.execute(arguments: ["list", "--project", name]) { _ in }
    }
  }
  #expect(try await core.workspace().history.count == 3)
}

@Test func cliProfilesPersistResolveNamesAndRecordProvenance() async throws {
  let root = try temporaryDirectory()
  defer { try? FileManager.default.removeItem(at: root) }
  let core = try OpenLoopCore(directory: root, engines: [FakeEngine()])
  var settings = try await core.settings()
  settings.selection = testSelection
  try await core.updateSettings(settings)
  let cli = OpenLoopCLI(
    environment: OpenLoopEnvironment(
      core: core, catalog: .firstParty,
      runtime: AceRuntime(directory: root, bundledUV: root, settingsProvider: { Settings() })))
  let createLog = EventLog()
  try await cli.execute(arguments: [
    "profiles", "create", "Fast Draft", "--duration", "17", "--format", "flac",
  ]) { await createLog.append($0) }
  let profileEvent = try #require(await createLog.events.first)
  let profile = try JSONDecoder().decode(
    GenerationProfile.self, from: JSONEncoder().encode(profileEvent.data))
  let listLog = EventLog()
  try await cli.execute(arguments: ["profiles", "list"]) { await listLog.append($0) }
  #expect(await listLog.events.count == 1)
  let listed = try JSONDecoder().decode(
    [GenerationProfile].self,
    from: JSONEncoder().encode(try #require(await listLog.events.first).data))
  #expect(listed == [profile])

  try await cli.execute(arguments: ["run", "--profile", profile.name, "--prompt", "quick idea"]) {
    _ in
  }
  let record = try #require(try await core.workspace().history.first)
  #expect(record.request.profileID == profile.id)
  #expect(record.request.profileName == profile.name)
  #expect(record.request.duration == 17)
  #expect(record.request.audioFormat == "flac")

  try await cli.execute(arguments: ["profiles", "rename", profile.name, "Production"]) { _ in }
  var renamed = profile
  renamed.name = "Production"
  let reopened = try OpenLoopCore(directory: root, engines: [FakeEngine()])
  #expect(try await reopened.profile(matching: "Production") == renamed)
  #expect(try await reopened.workspace().history.first?.request.profileName == profile.name)
  for arguments in [
    ["profiles", "rename", profile.id, " \n"],
    ["profiles", "rename", "missing", "New"],
    ["profiles", "rename", profile.id],
    ["profiles", "rename", profile.id, "New", "--unknown"],
  ] {
    await #expect(throws: CoreError.self) {
      try await cli.execute(arguments: arguments) { _ in }
    }
  }
  #expect(try await core.profile(matching: profile.id) == renamed)
  let second = try await core.createProfile(
    name: renamed.name, selection: testSelection, duration: 18, audioFormat: "wav")
  await #expect(throws: CoreError.self) {
    try await cli.execute(arguments: ["run", "--profile", renamed.name, "--prompt", "ambiguous"]) {
      _ in
    }
  }
  await #expect(throws: CoreError.self) {
    try await cli.execute(arguments: ["profiles", "rename", renamed.name, "Ambiguous"]) { _ in }
  }
  try await cli.execute(arguments: ["profiles", "rename", profile.id, "By ID"]) { _ in }
  renamed.name = "By ID"
  try await cli.execute(arguments: ["profiles", "delete", second.id]) { _ in }
  #expect(try await reopened.workspace().profiles == [renamed])
  try await cli.execute(arguments: ["run", "--profile", renamed.name, "--prompt", "new name"]) {
    _ in
  }
  #expect(try await core.workspace().history.first?.request.profileName == renamed.name)
}

@Test func cliRepaintsAnExternalFileAndKeepsTheSourceUnchanged() async throws {
  let root = try temporaryDirectory()
  defer { try? FileManager.default.removeItem(at: root) }
  let source = root.appendingPathComponent("source.wav")
  let format = try #require(AVAudioFormat(standardFormatWithSampleRate: 8000, channels: 1))
  let buffer = try #require(AVAudioPCMBuffer(pcmFormat: format, frameCapacity: 8000))
  buffer.frameLength = 8000
  let samples = try #require(buffer.floatChannelData)
  for index in 0..<8000 { samples[0][index] = 0 }
  do {
    let file = try AVAudioFile(forWriting: source, settings: format.settings)
    try file.write(from: buffer)
  }
  let original = try Data(contentsOf: source)
  let core = try OpenLoopCore(directory: root, engines: [FakeEngine()])
  var settings = try await core.settings()
  settings.selection = testSelection
  try await core.updateSettings(settings)
  let cli = OpenLoopCLI(
    environment: OpenLoopEnvironment(
      core: core, catalog: .firstParty,
      runtime: AceRuntime(directory: root, bundledUV: root, settingsProvider: { Settings() })))
  let arguments = ["run", "--prompt", "new section", "--repaint", source.path]
  for region in [
    [], ["--start", "bad", "--end", "0.8"], ["--start", "-1", "--end", "0.8"],
    ["--start", "0.2", "--end", "2"], ["--start", "0.8", "--end", "0.2"],
    ["--start", "nan", "--end", "0.8"],
    ["--start", "0.2", "--end", "0.8", "--duration", "30"],
  ] {
    await #expect(throws: CoreError.self) {
      try await cli.execute(arguments: arguments + region) { _ in }
    }
  }
  #expect(try await core.workspace().tasks.isEmpty)
  try await cli.execute(arguments: arguments + ["--start", "0.2", "--end", "0.8"]) { _ in }
  let record = try #require(try await core.workspace().history.first)
  #expect(record.request.operation == .repaint)
  #expect(record.request.prompt == "new section")
  #expect(record.request.duration == 1)
  #expect(record.request.editRegion == EditRegion(start: 0.2, end: 0.8))
  #expect(record.request.references == [source])
  #expect(record.request.parentTakeID == nil)
  #expect(record.artifacts.first?.url != source)
  #expect(try Data(contentsOf: source) == original)
}
