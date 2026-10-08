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
