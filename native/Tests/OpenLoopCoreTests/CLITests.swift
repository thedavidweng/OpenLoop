import Foundation
import OpenLoopCLIKit
import OpenLoopCore
import OpenLoopEngines
import Testing

actor EventLog {
  var events: [CLIEvent] = []
  func append(_ event: CLIEvent) { events.append(event) }
}
@Test func cliStreamsVersionedCoreResultsAndSharesProjectsWithGUI() async throws {
  let root = try temporaryDirectory()
  defer { try? FileManager.default.removeItem(at: root) }
  let core = try OpenLoopCore(directory: root, engines: [FakeEngine()])
  let environment = OpenLoopEnvironment(
    core: core, catalog: .firstParty,
    runtime: AceRuntime(directory: root, bundledUV: root, settings: Settings()))
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
