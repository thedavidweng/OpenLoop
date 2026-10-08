import Foundation
import Testing

@testable import OpenLoopCore

let testSelection = Selection(
  engineID: "test", runtimeID: "test/local", modelPackID: "test/pack",
  configurationID: "test/default")
struct FakeEngine: Engine {
  let id = "test"
  func capabilities(for selection: Selection) throws -> Capabilities {
    .init([.lyrics, .reproducibility, .referenceAudio, .cover, .repaint], maximumDuration: 60)
  }
  func generate(
    _ request: GenerationRequest, taskID: String, outputDirectory: URL, emit: EngineEventSink
  ) async throws -> EngineResult {
    try await emit(.progress(0.5, "Generating"))
    let audio = outputDirectory.appendingPathComponent("music.wav")
    let lyrics = outputDirectory.appendingPathComponent("lyrics.json")
    try Data("audio".utf8).write(to: audio)
    try Data("{}".utf8).write(to: lyrics)
    return .init(
      artifacts: [
        .init(kind: .audio, url: audio, mediaType: "audio/wav"),
        .init(kind: .timedLyrics, url: lyrics, mediaType: "application/json"),
      ], seed: 42)
  }
  func cancel(taskID: String) async throws {}
  func shutdown() async throws {}
}
func temporaryDirectory() throws -> URL {
  let url = FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString)
  try FileManager.default.createDirectory(at: url, withIntermediateDirectories: true)
  return url
}
@Test func completedTakesPersistMultipleArtifactsAcrossCoreInstances() async throws {
  let root = try temporaryDirectory()
  defer { try? FileManager.default.removeItem(at: root) }
  let core = try OpenLoopCore(directory: root, engines: [FakeEngine()])
  let project = try await core.createProject(name: "My song")
  let request = GenerationRequest(
    selection: testSelection, prompt: "piano", takeCount: 2, projectID: project.id)
  let task = try await core.submit(request)
  let events = try await core.run(taskID: task.id)
  for try await _ in events {}
  let reopened = try OpenLoopCore(directory: root, engines: [FakeEngine()])
  let state = try await reopened.workspace()
  #expect(state.history.count == 2)
  #expect(state.takes.count == 2)
  #expect(state.history.allSatisfy { $0.artifacts.count == 2 && $0.seed == 42 })
  #expect(state.tasks.first?.state == .completed)
  #expect(state.projects.first?.name == "My song")
}

struct FailingEngine: Engine {
  let id = "test"
  func capabilities(for selection: Selection) throws -> Capabilities {
    .init([], maximumDuration: 60)
  }
  func generate(
    _ request: GenerationRequest, taskID: String, outputDirectory: URL, emit: EngineEventSink
  ) async throws -> EngineResult { throw CoreError.engine("Out of memory") }
  func cancel(taskID: String) async throws {}
  func shutdown() async throws {}
}
@Test func failedTasksKeepRequestsAndStayOutOfHistory() async throws {
  let root = try temporaryDirectory()
  defer { try? FileManager.default.removeItem(at: root) }
  let core = try OpenLoopCore(directory: root, engines: [FailingEngine()])
  let request = GenerationRequest(selection: testSelection, prompt: "Keep my musical idea")
  let task = try await core.submit(request)
  do {
    for try await _ in try await core.run(taskID: task.id) {}
    Issue.record("Expected generation failure")
  } catch {}
  let state = try await core.workspace()
  #expect(state.history.isEmpty)
  #expect(state.tasks.first?.request == request)
  #expect(state.tasks.first?.state == .failed)
  #expect(state.tasks.first?.error == "Out of memory")
  let retry = try await core.retry(taskID: task.id)
  #expect(retry.request == request)
  #expect(retry.id != task.id)
}
@Test func deletionRequiresConfirmationAndRemovesEveryArtifact() async throws {
  let root = try temporaryDirectory()
  defer { try? FileManager.default.removeItem(at: root) }
  let core = try OpenLoopCore(directory: root, engines: [FakeEngine()])
  let task = try await core.submit(.init(selection: testSelection, prompt: "piano"))
  for try await _ in try await core.run(taskID: task.id) {}
  let state = try await core.workspace()
  let record = try #require(state.history.first)
  await #expect(throws: CoreError.self) {
    try await core.deleteGenerations(ids: [record.id], confirmed: false)
  }
  #expect(record.artifacts.allSatisfy { $0.exists })
  try await core.deleteGenerations(ids: [record.id], confirmed: true)
  #expect(record.artifacts.allSatisfy { !$0.exists })
  #expect(try await core.workspace().history.isEmpty)
}
actor WaitingEngine: Engine {
  nonisolated let id = "test"
  nonisolated func capabilities(for selection: Selection) throws -> Capabilities {
    .init([], maximumDuration: 60)
  }
  func generate(
    _ request: GenerationRequest, taskID: String, outputDirectory: URL, emit: EngineEventSink
  ) async throws -> EngineResult {
    try await emit(.progress(nil, "Running"))
    try await Task.sleep(for: .seconds(30))
    throw CoreError.engine("Unexpected completion")
  }
  func cancel(taskID: String) async throws {}
  func shutdown() async throws {}
}
@Test func cancellationPreservesRequestWithoutHistory() async throws {
  let root = try temporaryDirectory()
  defer { try? FileManager.default.removeItem(at: root) }
  let core = try OpenLoopCore(directory: root, engines: [WaitingEngine()])
  let request = GenerationRequest(selection: testSelection, prompt: "strings")
  let task = try await core.submit(request)
  for try await event in try await core.run(taskID: task.id) {
    if case .engine = event { try await core.cancel(taskID: task.id) }
  }
  let state = try await core.workspace()
  #expect(state.tasks.first?.state == .cancelled)
  #expect(state.tasks.first?.request == request)
  #expect(state.history.isEmpty)
}
@Test func capabilityValidationRejectsUnsupportedIntentBeforeSubmission() async throws {
  let root = try temporaryDirectory()
  defer { try? FileManager.default.removeItem(at: root) }
  let core = try OpenLoopCore(directory: root, engines: [FakeEngine()])
  await #expect(throws: CoreError.self) {
    try await core.submit(.init(selection: testSelection, prompt: "piano", bpm: 120))
  }
  #expect(try await core.workspace().tasks.isEmpty)
}
@Test func twoCoreInstancesDoNotOverwriteProjectsOrSettings() async throws {
  let root = try temporaryDirectory()
  defer { try? FileManager.default.removeItem(at: root) }
  let gui = try OpenLoopCore(directory: root, engines: [FakeEngine()])
  let cli = try OpenLoopCore(directory: root, engines: [FakeEngine()])
  _ = try await gui.createProject(name: "GUI idea")
  _ = try await cli.createProject(name: "CLI idea")
  var settings = try await cli.settings()
  settings.language = "zh-CN"
  try await cli.updateSettings(settings)
  #expect(try await gui.workspace().projects.count == 2)
  #expect(try await gui.settings().language == "zh-CN")
}

@Test func interruptedNativeTasksRecoverAsRetryableFailures() async throws {
  let root = try temporaryDirectory()
  defer { try? FileManager.default.removeItem(at: root) }
  let core = try OpenLoopCore(directory: root, engines: [FakeEngine()])
  var task = try await core.submit(.init(selection: testSelection, prompt: "idea survives crash"))
  task.state = .running
  let payload = String(decoding: try JSONEncoder().encode(task), as: UTF8.self)
    .replacingOccurrences(of: "'", with: "''")
  try legacyDatabase(
    root: root,
    sql: "UPDATE native_objects SET payload='\(payload)' WHERE kind='task' AND id='\(task.id)'")
  let reopened = try OpenLoopCore(directory: root, engines: [FakeEngine()])
  #expect(try await reopened.workspace().tasks.first?.state == .failed)
  #expect(try await reopened.retry(taskID: task.id).request.prompt == "idea survives crash")
}

@Test func liveCoreRecoversTasksAfterAnotherExecutorLosesItsLease() async throws {
  let root = try temporaryDirectory()
  defer { try? FileManager.default.removeItem(at: root) }
  let core = try OpenLoopCore(directory: root, engines: [FakeEngine()])
  let persistence = try Persistence(directory: root)
  var interrupted = try await core.submit(.init(selection: testSelection, prompt: "CLI crash"))
  interrupted.state = .running
  var owner: GenerationLease? = try GenerationLease(directory: root)
  try persistence.save("task", id: interrupted.id, value: interrupted)
  #expect(try await core.workspace().tasks.first?.state == .running)
  withExtendedLifetime(owner) {}
  owner = nil
  #expect(try await core.workspace().tasks.first?.state == .failed)
  // Also recover on run when no workspace refresh happened after the crash.
  try persistence.save("task", id: interrupted.id, value: interrupted)
  let next = try await core.submit(.init(selection: testSelection, prompt: "GUI continues"))
  for try await _ in try await core.run(taskID: next.id) {}
  let state = try await core.workspace()
  #expect(state.tasks.first { $0.id == interrupted.id }?.state == .failed)
  #expect(state.tasks.first { $0.id == next.id }?.state == .completed)
}

@Test func variationsOfEditsPreserveEditIntentAndRemainSubmittable() async throws {
  let root = try temporaryDirectory()
  defer { try? FileManager.default.removeItem(at: root) }
  let core = try OpenLoopCore(directory: root, engines: [FakeEngine()])
  let first = try await core.submit(.init(selection: testSelection, prompt: "original"))
  for try await _ in try await core.run(taskID: first.id) {}
  let parent = try #require(try await core.workspace().takes.first)
  let source = try #require(try await core.workspace().history.first?.artifacts.first)
  for operation in [Operation.cover, .repaint] {
    let request = GenerationRequest(
      selection: testSelection, prompt: "edit", seed: 12, parentTakeID: parent.id,
      operation: operation, references: [source.url],
      editRegion: operation == .repaint ? .init(start: 4, end: 8) : nil)
    let edit = try await core.submit(request)
    for try await _ in try await core.run(taskID: edit.id) {}
    let state = try await core.workspace()
    let record = try #require(state.history.first { $0.taskID == edit.id })
    let take = try #require(state.takes.first { $0.generationID == record.id })
    let variation = try await core.requestForTake(id: take.id, reproduce: false)
    var expected = request
    expected.seed = nil
    expected.parentTakeID = take.id
    #expect(variation == expected)
    _ = try await core.submit(variation)
  }
}

@Test func automaticSQLiteRollbackPreservesTheOriginalFailure() throws {
  let root = try temporaryDirectory()
  defer { try? FileManager.default.removeItem(at: root) }
  let persistence = try Persistence(directory: root)
  try persistence.execute("CREATE TABLE unique_values (value TEXT UNIQUE)")
  try persistence.execute("INSERT INTO unique_values VALUES ('same')")
  do {
    try persistence.transaction {
      try persistence.execute("INSERT OR ROLLBACK INTO unique_values VALUES ('same')")
    }
    Issue.record("Expected UNIQUE constraint failure")
  } catch {
    #expect(error.localizedDescription.contains("UNIQUE constraint failed"))
  }
  try persistence.transaction {
    try persistence.execute("INSERT INTO unique_values VALUES ('different')")
  }
}

@Test func retainedVariationCanBeReproducedAfterItsParentIsDeleted() async throws {
  let root = try temporaryDirectory()
  defer { try? FileManager.default.removeItem(at: root) }
  let core = try OpenLoopCore(directory: root, engines: [FakeEngine()])
  let first = try await core.submit(.init(selection: testSelection, prompt: "piano"))
  for try await _ in try await core.run(taskID: first.id) {}
  let parent = try #require(try await core.workspace().takes.first)
  let variation = try await core.submit(core.requestForTake(id: parent.id, reproduce: false))
  for try await _ in try await core.run(taskID: variation.id) {}
  let take = try #require(try await core.workspace().takes.first { $0.parentTakeID == parent.id })
  try await core.deleteGenerations(ids: [parent.generationID], confirmed: true)
  let request = try await core.requestForTake(id: take.id, reproduce: true)
  #expect(request.parentTakeID == take.id)
  #expect(request.seed == 42)
  let reproduction = try await core.submit(request)
  for try await _ in try await core.run(taskID: reproduction.id) {}
}

@Test func reproductionPreservesEditOperationAndSourceTake() async throws {
  let root = try temporaryDirectory()
  defer { try? FileManager.default.removeItem(at: root) }
  let core = try OpenLoopCore(directory: root, engines: [FakeEngine()])
  let first = try await core.submit(.init(selection: testSelection, prompt: "original"))
  for try await _ in try await core.run(taskID: first.id) {}
  let parent = try #require(try await core.workspace().takes.first)
  let source = try #require(try await core.workspace().history.first?.artifacts.first)
  let request = GenerationRequest(
    selection: testSelection, prompt: "edit", seed: 42,
    parentTakeID: parent.id, operation: .repaint, references: [source.url],
    editRegion: .init(start: 4, end: 8))
  let edited = try await core.submit(request)
  for try await _ in try await core.run(taskID: edited.id) {}
  let take = try #require(
    try await core.workspace().takes.first(where: { $0.parentTakeID == parent.id }))
  let reproduction = try await core.requestForTake(id: take.id, reproduce: true)
  var expected = request
  expected.parentTakeID = take.id
  #expect(reproduction == expected)
}

@Test func regionEditsNeedAValidRegionAndSourceAudio() throws {
  let capabilities = Capabilities([.referenceAudio, .repaint, .extend], maximumDuration: 60)
  let source = URL(fileURLWithPath: "/tmp/source.wav")
  func repaint(_ region: EditRegion?, references: [URL] = [source]) -> GenerationRequest {
    .init(
      selection: testSelection, prompt: "edit", duration: 30, parentTakeID: "parent",
      operation: .repaint, references: references, editRegion: region)
  }
  func extend(_ region: EditRegion) -> GenerationRequest {
    var request = repaint(region)
    request.operation = .extend
    return request
  }
  var variation = repaint(.init(start: 2, end: 6))
  variation.operation = .variation
  try repaint(.init(start: 2, end: 6)).validate(capabilities: capabilities)
  try extend(.init(start: 20, end: 30)).validate(capabilities: capabilities)
  for invalid in [
    repaint(nil), repaint(.init(start: 6, end: 2)), repaint(.init(start: -1, end: 2)),
    repaint(.init(start: 2, end: .infinity)), repaint(.init(start: 2, end: 6), references: []),
    extend(.init(start: 20, end: 31)), variation,
  ] {
    #expect(throws: CoreError.self) { try invalid.validate(capabilities: capabilities) }
  }
  #expect(throws: CoreError.self) {
    try extend(.init(start: 20, end: 30)).validate(
      capabilities: Capabilities([.referenceAudio, .repaint], maximumDuration: 60))
  }
}
