import Foundation
import Observation
import OpenLoopAudio
import OpenLoopCore
import OpenLoopEngines

// Presentation state only. Opus owns the screens, commands and native interactions.
@MainActor @Observable
final class WorkspaceModel {
  private(set) var workspace: Workspace?
  private(set) var catalog = EngineCatalog.firstParty
  private(set) var activeTaskID: String?
  private(set) var progress: Double?
  private(set) var activity: String?
  var error: String?
  var selectedProjectID: String?
  var selectedTakeID: String?
  var comparisonTakeID: String?
  var draft: GenerationRequest?
  @ObservationIgnored private var environment: OpenLoopEnvironment?
  @ObservationIgnored let player = TakePlayer()

  func connect(directory: URL = OpenLoopCore.defaultDirectory, bundledUV: URL? = nil) async {
    do {
      let uv = bundledUV ?? Bundle.main.bundleURL.appendingPathComponent("Contents/MacOS/uv")
      let environment = try await OpenLoopEnvironment.open(directory: directory, bundledUV: uv)
      self.environment = environment
      self.catalog = environment.catalog
      try await refresh()
      if let settings = workspace?.settings, let selection = settings.selection {
        draft = GenerationRequest(
          selection: selection, prompt: "", duration: settings.defaultDuration,
          audioFormat: settings.defaultAudioFormat)
      }
    } catch { self.error = error.localizedDescription }
  }
  func refresh() async throws { workspace = try await core().workspace() }
  func chooseConfiguration(id: String) throws {
    let selection = try catalog.selection(configurationID: id)
    if draft != nil {
      draft?.selection = selection
    } else {
      draft = GenerationRequest(selection: selection, prompt: "")
    }
  }
  func generate() async {
    do {
      guard var request = draft else { throw CoreError.invalid("Choose an Engine configuration") }
      request.projectID = selectedProjectID
      let task = try await core().submit(request)
      try await consume(task)
    } catch {
      self.error = error.localizedDescription
      await refreshAfterError()
    }
  }
  func retry(taskID: String) async {
    do { try await consume(core().retry(taskID: taskID)) } catch {
      self.error = error.localizedDescription
      await refreshAfterError()
    }
  }
  func openTaskInCompose(taskID: String) throws {
    guard let task = workspace?.tasks.first(where: { $0.id == taskID }) else {
      throw CoreError.notFound("Generation Task not found")
    }
    draft = task.request
    selectedProjectID = task.request.projectID
  }
  func iterate(takeID: String, reproduce: Bool) async throws {
    draft = try await core().requestForTake(id: takeID, reproduce: reproduce)
    selectedProjectID = draft?.projectID
  }
  private func consume(_ task: GenerationTask) async throws {
    activeTaskID = task.id
    error = nil
    defer {
      activeTaskID = nil
      progress = nil
      activity = nil
    }
    for try await event in try await core().run(taskID: task.id) {
      switch event {
      case .engine(.lifecycle(let message)): activity = message
      case .engine(.progress(let fraction, let label)):
        progress = fraction
        activity = label
      case .completed, .task: try await refresh()
      }
    }
    try await refresh()
  }
  func cancel() async throws { if let id = activeTaskID { try await core().cancel(taskID: id) } }
  func createProject(name: String) async throws {
    selectedProjectID = try await core().createProject(name: name).id
    try await refresh()
  }
  func renameProject(id: String, name: String) async throws {
    try await core().renameProject(id: id, name: name)
    try await refresh()
  }
  func deleteProject(id: String) async throws {
    try await core().deleteProject(id: id)
    if selectedProjectID == id { selectedProjectID = nil }
    try await refresh()
  }
  func saveSettings(_ settings: Settings) async throws {
    if let selection = settings.selection { _ = try catalog.configuration(selection) }
    try await core().updateSettings(settings)
    try await refresh()
  }
  func deleteGenerations(ids: Set<String>, confirmed: Bool) async throws {
    try await core().deleteGenerations(ids: ids, confirmed: confirmed)
    try await refresh()
  }
  func setFavorite(id: String, favorite: Bool) async throws {
    try await core().setFavorite(generationID: id, favorite: favorite)
    try await refresh()
  }
  func export(generationID: String, artifactID: String, to destination: URL) async throws {
    try await core().exportArtifact(
      generationID: generationID, artifactID: artifactID, destination: destination)
  }
  func installRuntime(licenseAccepted: Bool) async throws {
    guard let environment else { throw CoreError.conflict("Workspace is not connected") }
    defer {
      progress = nil
      activity = nil
    }
    try await environment.runtime.provision(licenseAccepted: licenseAccepted) { event in
      await self.apply(event)
    }
    try await refresh()
  }
  func installModel(packID: String, licenseAccepted: Bool) async throws {
    guard let environment else { throw CoreError.conflict("Workspace is not connected") }
    defer {
      progress = nil
      activity = nil
    }
    try await environment.installer.install(packID: packID, licenseAccepted: licenseAccepted) {
      event in
      await self.apply(event)
    }
    try await refresh()
  }
  func deleteModel(packID: String, confirmed: Bool) async throws {
    guard let environment else { throw CoreError.conflict("Workspace is not connected") }
    try await environment.installer.delete(packID: packID, confirmed: confirmed)
    try await refresh()
  }
  func shutdown() async throws { try await core().shutdown() }
  private func apply(_ event: EngineEvent) {
    switch event {
    case .lifecycle(let message): activity = message
    case .progress(let fraction, let label):
      progress = fraction
      activity = label
    }
  }
  private func core() throws -> OpenLoopCore {
    guard let core = environment?.core else {
      throw CoreError.conflict("Workspace is not connected")
    }
    return core
  }
  private func refreshAfterError() async {
    do { try await refresh() } catch { self.error = error.localizedDescription }
  }
}
