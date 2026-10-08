import Foundation
import OpenLoopAudio
import OpenLoopCore
import Testing

@testable import OpenLoopAppKit
@testable import OpenLoopEngines

@MainActor @Test func retryOpeningALibraryKeepsProcessEnvironmentOverrides() async throws {
  let root = FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString)
  defer { try? FileManager.default.removeItem(at: root) }
  try Data("not a directory".utf8).write(to: root)
  let model = WorkspaceModel(
    defaults: UserDefaults(suiteName: UUID().uuidString)!,
    processEnvironment: ["OPENLOOP_DATA_DIR": root.path, "OPENLOOP_UV": "/tmp/isolated-uv"])
  await model.connect()
  #expect(model.connectionError != nil)
  try FileManager.default.removeItem(at: root)
  await model.connect()
  #expect(model.connectionError == nil)
  #expect(model.isConnected)
  #expect(
    FileManager.default.fileExists(atPath: root.appendingPathComponent("openloop.sqlite3").path))
}

@Test func loopRestartsWhenNativePlaybackFinishesAndResetsItsPosition() throws {
  let selection = try AudioSelection(start: 2, end: 10, duration: 10)
  #expect(PlaybackModel.loopEnded(selection, currentTime: 0, isPlaying: false))
  #expect(PlaybackModel.loopEnded(selection, currentTime: 10, isPlaying: true))
  #expect(!PlaybackModel.loopEnded(selection, currentTime: 5, isPlaying: true))
}

private let selection = Selection(
  engineID: "test", runtimeID: "test/local", modelPackID: "test/pack",
  configurationID: "test/default")
private let license = License(
  name: "MIT", url: URL(string: "https://example.com/license")!, notice: "Review")
private let catalog = EngineCatalog(
  engines: [
    .init(id: "test", name: "Test Engine", bound: true),
    .init(id: "future", name: "Future", bound: false),
  ],
  runtimes: [
    .init(
      id: "test/local", engineID: "test", operatingSystems: ["macOS"], architectures: ["arm64"],
      accelerators: [], recommendedMemoryGB: 1, implementation: "fake",
      sourceURL: URL(string: "https://example.com")!,
      revision: "0", license: license)
  ],
  packs: [
    .init(
      id: "test/pack", engineID: "test", name: "Pack", runtimeIDs: ["test/local"],
      recommendedMemoryGB: 1,
      installable: true, license: license)
  ],
  configurations: [
    .init(
      id: "test/default", name: "Default", selection: selection,
      capabilities: .init(
        [.lyrics, .reproducibility, .referenceAudio, .repaint, .extend], maximumDuration: 60),
      model: "fake",
      languageModel: nil,
      thinking: false, recommendedMemoryGB: 1)
  ])

private struct ScriptedEngine: Engine {
  let id = "test"
  let seed: Int64?
  let fails: Bool
  func capabilities(for selection: Selection) throws -> Capabilities {
    try catalog.configuration(selection).capabilities
  }
  func generate(
    _ request: GenerationRequest, taskID: String, outputDirectory: URL, emit: EngineEventSink
  ) async throws -> EngineResult {
    try await emit(.progress(0.5, "Generating"))
    if fails { throw CoreError.engine("Out of memory") }
    let audio = outputDirectory.appendingPathComponent("audio.wav")
    try Data("audio".utf8).write(to: audio)
    return .init(artifacts: [.init(kind: .audio, url: audio, mediaType: "audio/wav")], seed: seed)
  }
  func cancel(taskID: String) async throws {}
  func shutdown() async throws {}
}

@MainActor
private func makeModel(seed: Int64? = 7, fails: Bool = false, provisioned: Bool = true) async throws
  -> (WorkspaceModel, URL)
{
  let root = FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString)
  try FileManager.default.createDirectory(at: root, withIntermediateDirectories: true)
  if provisioned {
    let runtime = root.appendingPathComponent("native-runtime/ace-step")
    try FileManager.default.createDirectory(at: runtime, withIntermediateDirectories: true)
    try Data().write(to: runtime.appendingPathComponent("pyproject.toml"))
  }
  let core = try OpenLoopCore(directory: root, engines: [ScriptedEngine(seed: seed, fails: fails)])
  try await core.recordInstallation(.init(id: "test/pack", state: .installed, directory: root))
  let runtime = AceRuntime(
    directory: root, bundledUV: root, settingsProvider: { try await core.settings() })
  let model = WorkspaceModel(defaults: UserDefaults(suiteName: UUID().uuidString)!)
  try await model.connect(
    environment: OpenLoopEnvironment(core: core, catalog: catalog, runtime: runtime))
  return (model, root)
}

@Test func composeHidesAndClearsControlsTheEngineDoesNotSupport() throws {
  let capabilities = Capabilities([.lyrics], maximumDuration: 30)
  #expect(ComposeRules.shows(.lyrics, in: capabilities))
  #expect(!ComposeRules.shows(.bpm, in: capabilities))
  #expect(!ComposeRules.shows(.reproducibility, in: nil))
  let request = GenerationRequest(
    selection: selection, prompt: "x", lyrics: "la", duration: 120, seed: 1, bpm: 90,
    key: "C major",
    timeSignature: "4")
  let sanitized = ComposeRules.sanitized(request, for: capabilities)
  #expect(sanitized.lyrics == "la")
  #expect(
    sanitized.seed == nil && sanitized.bpm == nil && sanitized.key == nil
      && sanitized.timeSignature == nil)
  #expect(sanitized.duration == 30)
}

@MainActor @Test func generationNeedsSetupUntilRuntimeIsInstalled() async throws {
  let (model, root) = try await makeModel(provisioned: false)
  defer { try? FileManager.default.removeItem(at: root) }
  let configuration = try #require(model.currentConfiguration)
  #expect(model.readiness(for: configuration) == .needsRuntime)
  model.draft?.prompt = "piano"
  await model.generate()
  #expect(model.setupConfigurationID == configuration.id)
  #expect(model.history.isEmpty)
}

@MainActor @Test func failedSettingsSaveKeepsThePersistedSettingsForRetry() async throws {
  let (model, root) = try await makeModel()
  defer { try? FileManager.default.removeItem(at: root) }
  let saved = try #require(model.settings)
  var pending = saved
  pending.backendPort = 0
  await model.saveSettings(pending)
  #expect(model.error != nil)
  #expect(model.settings == saved)
  pending.backendPort = 45678
  await model.saveSettings(pending)
  #expect(model.settings == pending)
}

@MainActor @Test func generatedTakesLandInTheSelectedProjectAndHistory() async throws {
  let (model, root) = try await makeModel()
  defer { try? FileManager.default.removeItem(at: root) }
  #expect(model.currentReadiness == .ready)
  await model.createProject(name: "Song")
  let projectID = try #require(model.selectedProjectID)
  model.draft?.prompt = "warm synths"
  model.draft?.takeCount = 2
  #expect(model.canGenerate)
  await model.generate()
  #expect(model.error == nil)
  #expect(model.takes(projectID: projectID).count == 2)
  #expect(model.takes(projectID: nil).isEmpty)
  #expect(model.history.count == 2)
  #expect(model.selectedTakeID != nil)
  #expect(model.activity == .idle)
}

@MainActor @Test func failedGenerationIsRetryableButNeverHistory() async throws {
  let (model, root) = try await makeModel(fails: true)
  defer { try? FileManager.default.removeItem(at: root) }
  model.draft?.prompt = "keep this idea"
  await model.generate()
  #expect(model.error == "Out of memory")
  #expect(model.history.isEmpty)
  let attempt = try #require(model.attempts(projectID: nil).first)
  #expect(attempt.state == .failed)
  model.draft?.prompt = "changed"
  model.openTaskInCompose(taskID: attempt.id)
  #expect(model.draft?.prompt == "keep this idea")
  model.dismiss(taskID: attempt.id)
  #expect(model.attempts(projectID: nil).isEmpty)
}

@MainActor @Test func exactReproductionRequiresTheActualSeed() async throws {
  let (model, root) = try await makeModel(seed: nil)
  defer { try? FileManager.default.removeItem(at: root) }
  model.draft?.prompt = "no seed reported"
  await model.generate()
  let item = try #require(model.takes(projectID: nil).first)
  #expect(!model.canReproduce(item.record))
  await model.iterate(takeID: item.id, reproduce: true)
  #expect(model.error != nil)

  let (seeded, seededRoot) = try await makeModel(seed: 99)
  defer { try? FileManager.default.removeItem(at: seededRoot) }
  seeded.draft?.prompt = "seeded"
  await seeded.generate()
  let take = try #require(seeded.takes(projectID: nil).first)
  #expect(seeded.canReproduce(take.record))
  await seeded.iterate(takeID: take.id, reproduce: true)
  #expect(seeded.draft?.seed == 99)
  await seeded.iterate(takeID: take.id, reproduce: false)
  #expect(seeded.draft?.parentTakeID == take.id)
  #expect(seeded.draft?.operation == .variation)
}

@MainActor @Test func leavingTheProjectDropsAVariationLink() async throws {
  let (model, root) = try await makeModel()
  defer { try? FileManager.default.removeItem(at: root) }
  await model.createProject(name: "A")
  model.draft?.prompt = "idea"
  await model.generate()
  let take = try #require(model.selectedTakeID)
  await model.iterate(takeID: take, reproduce: false)
  #expect(model.draft?.parentTakeID == take)
  model.select(.unfiled)
  #expect(model.draft?.parentTakeID == nil)
  #expect(model.draft?.operation == .generate)
  #expect(model.draft?.prompt == "idea")
}

@MainActor @Test func deletingTakesRemovesThemFromProjectAndHistory() async throws {
  let (model, root) = try await makeModel()
  defer { try? FileManager.default.removeItem(at: root) }
  model.draft?.prompt = "delete me"
  await model.generate()
  let item = try #require(model.takes(projectID: nil).first)
  let audio = try #require(item.audio)
  await model.deleteGenerations(ids: [item.record.id])
  #expect(model.history.isEmpty)
  #expect(model.selectedTakeID == nil)
  #expect(!FileManager.default.fileExists(atPath: audio.url.path))
}

@MainActor @Test func unboundEnginesAreNeverSelectable() async throws {
  let (model, root) = try await makeModel()
  defer { try? FileManager.default.removeItem(at: root) }
  #expect(model.configurations.allSatisfy { $0.selection.engineID != "future" })
  await model.chooseConfiguration(id: "future/turbo")
  #expect(model.error != nil)
  #expect(model.draft?.selection == selection)
}

@MainActor @Test func selectingAConfigurationWithoutALanguageModelClearsPlanning() async throws {
  let (model, root) = try await makeModel()
  defer { try? FileManager.default.removeItem(at: root) }
  model.draft?.engineOptions.values["thinking"] = .bool(true)
  await model.chooseConfiguration(id: selection.configurationID)
  #expect(model.draft?.engineOptions.values["thinking"] == nil)
}

@Test func regionEditsAreBuiltFromTheSourceTakeAndRespectCapabilities() throws {
  let capabilities = Capabilities([.referenceAudio, .repaint, .extend], maximumDuration: 60)
  let source = URL(fileURLWithPath: "/tmp/source.wav")
  var base = GenerationRequest(selection: selection, prompt: "x", seed: 3, takeCount: 4)
  base.parentTakeID = "parent"
  #expect(
    ComposeRules.regionEdit(
      base, .repaint, source: source, sourceDuration: 20, selection: nil,
      capabilities: capabilities) == nil)
  let repaint = try #require(
    ComposeRules.regionEdit(
      base, .repaint, source: source, sourceDuration: 20,
      selection: .init(start: 4, end: 25), capabilities: capabilities))
  #expect(repaint.operation == .repaint && repaint.duration == 20)
  #expect(repaint.editRegion == .init(start: 4, end: 20))
  #expect(repaint.references == [source] && repaint.seed == nil && repaint.takeCount == 1)
  let extend = try #require(
    ComposeRules.regionEdit(
      base, .extend, source: source, sourceDuration: 45, selection: nil,
      capabilities: capabilities))
  #expect(extend.editRegion == .init(start: 45, end: 60) && extend.duration == 60)
  #expect(
    ComposeRules.regionEdit(
      base, .extend, source: source, sourceDuration: 60, selection: nil,
      capabilities: capabilities) == nil)
  #expect(
    ComposeRules.regionEdit(
      base, .extend, source: source, sourceDuration: 20, selection: nil,
      capabilities: .init([.referenceAudio, .repaint], maximumDuration: 60)) == nil)
  let sanitized = ComposeRules.sanitized(
    extend, for: .init([.referenceAudio, .repaint], maximumDuration: 60))
  #expect(sanitized.operation == .variation && sanitized.editRegion == nil)
  #expect(sanitized.references.isEmpty)
}

@MainActor @Test func repaintingASelectionCreatesALinkedTake() async throws {
  let (model, root) = try await makeModel()
  defer { try? FileManager.default.removeItem(at: root) }
  await model.createProject(name: "Song")
  model.draft?.prompt = "verse"
  await model.generate()
  let source = try #require(model.takes(projectID: model.selectedProjectID).first)
  #expect(model.canEdit(source, .repaint) && model.canEdit(source, .extend))
  await model.edit(
    takeID: source.id, .repaint, sourceDuration: 30, selection: .init(start: 8, end: 12))
  #expect(model.error == nil)
  #expect(model.draft?.operation == .repaint)
  #expect(model.draft?.editRegion == .init(start: 8, end: 12))
  #expect(model.draft?.references == [try #require(source.audio).url])
  #expect(model.canGenerate)
  await model.generate()
  let edited = try #require(
    model.takes(projectID: model.selectedProjectID).first { $0.take.parentTakeID == source.id })
  #expect(edited.record.request.editRegion == .init(start: 8, end: 12))

  await model.edit(takeID: source.id, .repaint, sourceDuration: 30)
  #expect(model.error != nil)
  await model.edit(
    takeID: source.id, .repaint, sourceDuration: 60.01, selection: .init(start: 8, end: 12))
  #expect(model.error == "This Take is longer than the Engine's maximum repaint duration.")
  await model.edit(takeID: source.id, .extend, sourceDuration: 30)
  #expect(model.draft?.operation == .extend && model.draft?.duration == 60)
  model.clearIteration()
  #expect(model.draft?.operation == .generate && model.draft?.editRegion == nil)
  #expect(model.draft?.references.isEmpty == true)
}
