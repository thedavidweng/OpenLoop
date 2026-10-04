import Foundation
import Observation
import OpenLoopAudio
import OpenLoopCore
import OpenLoopEngines

// SwiftUI also declares `Settings`; views refer to the Core type through this alias.
public typealias WorkspaceSettings = Settings

public enum SidebarItem: Hashable, Sendable {
  case history
  case unfiled
  case project(String)
  var projectID: String? {
    if case .project(let id) = self { return id }
    return nil
  }
}

public enum Readiness: Equatable, Sendable {
  case unsupported(String)
  case needsRuntime
  case needsModel(packID: String, error: String?)
  case installing
  case ready
  public var isReady: Bool { self == .ready }
}

public enum Activity: Equatable, Sendable {
  case idle, generating, installing
}

public struct TakeItem: Identifiable, Equatable, Sendable {
  public var take: Take
  public var record: GenerationRecord
  public var id: String { take.id }
  public var audio: Artifact? { record.artifacts.first { $0.kind == .audio } }
  public var isMissing: Bool { !(audio?.exists ?? false) }
}

// Presentation state only: selection, drafts, and orchestration of Core calls.
@MainActor @Observable
public final class WorkspaceModel {
  public private(set) var workspace: Workspace?
  public private(set) var catalog = EngineCatalog.firstParty
  public private(set) var activeTaskID: String?
  public private(set) var activity: Activity = .idle
  public private(set) var progress: Double?
  public private(set) var statusMessage: String?
  public private(set) var runtimeProvisioned: Bool?
  public private(set) var connectionError: String?
  public var error: String?
  public var notice: String?
  public var sidebar: SidebarItem? = .unfiled
  public var selectedTakeID: String?
  public var comparisonTakeID: String?
  public var draft: GenerationRequest?
  public var setupConfigurationID: String?
  public var historySelection: Set<String> = []
  public var pendingDeletion: Set<String>?
  public var isCreatingProject = false
  public var showsInspector = true
  public private(set) var dismissedTaskIDs: Set<String>
  public let physicalMemoryGB = Int(ProcessInfo.processInfo.physicalMemory / 1_073_741_824)
  @ObservationIgnored public var onTakeCompleted: (@MainActor (GenerationRecord) -> Void)?
  @ObservationIgnored private var environment: OpenLoopEnvironment?
  @ObservationIgnored private var installTask: Task<Void, Never>?
  @ObservationIgnored private let defaults: UserDefaults
  private static let dismissedKey = "dismissedGenerationTaskIDs"

  public init(defaults: UserDefaults = .standard) {
    self.defaults = defaults
    dismissedTaskIDs = Set(defaults.stringArray(forKey: Self.dismissedKey) ?? [])
  }

  // MARK: Connection

  public func connect(directory: URL = OpenLoopCore.defaultDirectory, bundledUV: URL? = nil) async {
    let uv = bundledUV ?? Bundle.main.bundleURL.appendingPathComponent("Contents/MacOS/uv")
    do {
      try await connect(environment: OpenLoopEnvironment.open(directory: directory, bundledUV: uv))
    } catch {
      connectionError = error.localizedDescription
    }
  }
  public func connect(environment: OpenLoopEnvironment) async throws {
    self.environment = environment
    catalog = environment.catalog
    connectionError = nil
    try await refresh()
    if draft == nil, let settings = workspace?.settings {
      let selection =
        settings.selection.flatMap { try? catalog.configuration($0).selection }
        ?? (catalog.recommendedConfigurations(memoryGB: physicalMemoryGB).first
        ?? catalog.configurations.first(where: { (try? catalog.configuration($0.selection)) != nil }
        ))?
        .selection
      if let selection {
        draft = GenerationRequest(
          selection: selection, prompt: "", duration: settings.defaultDuration,
          audioFormat: settings.defaultAudioFormat)
      }
    }
  }
  public var isConnected: Bool { environment != nil }
  public func refresh() async throws {
    workspace = try await core().workspace()
    if let environment { runtimeProvisioned = try await environment.runtime.isProvisioned() }
    if let id = selectedTakeID, !(workspace?.takes.contains { $0.id == id } ?? false) {
      selectedTakeID = nil
    }
    if let id = comparisonTakeID, !(workspace?.takes.contains { $0.id == id } ?? false) {
      comparisonTakeID = nil
    }
    if let id = sidebar?.projectID, !(workspace?.projects.contains { $0.id == id } ?? false) {
      sidebar = .unfiled
    }
  }
  // Picks up GUI/CLI changes made by another process; failures stay silent while idle.
  public func refreshQuietly() async {
    guard isConnected, activity == .idle else { return }
    try? await refresh()
  }

  // MARK: Catalog and readiness

  public var configurations: [Configuration] { catalog.configurations }
  public func configuration(for selection: Selection) -> Configuration? {
    try? catalog.configuration(selection)
  }
  public var currentConfiguration: Configuration? {
    draft.flatMap { configuration(for: $0.selection) }
  }
  public var capabilities: Capabilities? { currentConfiguration?.capabilities }
  public func engineName(_ id: String) -> String {
    catalog.engines.first { $0.id == id }?.name ?? id
  }
  public func configurationName(_ selection: Selection) -> String {
    catalog.configurations.first { $0.selection == selection }.map {
      "\(engineName(selection.engineID)) \($0.name)"
    } ?? selection.configurationID
  }
  public func runtime(for configuration: Configuration) -> RuntimeDescriptor? {
    catalog.runtimes.first { $0.id == configuration.selection.runtimeID }
  }
  public func pack(_ id: String) -> ModelPack? { catalog.packs.first { $0.id == id } }
  public func installation(packID: String) -> ModelInstallation? {
    workspace?.installations.first { $0.id == packID }
  }
  public func readiness(for configuration: Configuration) -> Readiness {
    guard let runtime = runtime(for: configuration), runtime.supportsCurrentMachine() else {
      return .unsupported("This Engine requires an Apple Silicon Mac running macOS.")
    }
    if activity == .installing { return .installing }
    guard runtimeProvisioned == true else { return .needsRuntime }
    let packID = configuration.selection.modelPackID
    guard let installation = installation(packID: packID), installation.state == .installed else {
      return .needsModel(packID: packID, error: installation(packID: packID)?.error)
    }
    return .ready
  }
  public var currentReadiness: Readiness? { currentConfiguration.map(readiness(for:)) }

  public func chooseConfiguration(id: String) async {
    do {
      let selection = try catalog.selection(configurationID: id)
      let capabilities = try catalog.configuration(selection).capabilities
      if var request = draft {
        if request.selection.engineID != selection.engineID { request.engineOptions = .init() }
        request.selection = selection
        draft = ComposeRules.sanitized(request, for: capabilities)
      } else {
        draft = GenerationRequest(selection: selection, prompt: "")
      }
      if var settings = workspace?.settings, settings.selection != selection {
        settings.selection = selection
        try await core().updateSettings(settings)
        try await refresh()
      }
    } catch { self.error = error.localizedDescription }
  }

  // MARK: Projects and Takes

  public var projects: [Project] {
    (workspace?.projects ?? []).sorted { $0.createdAt > $1.createdAt }
  }
  public var selectedProjectID: String? { sidebar?.projectID }
  public func select(_ item: SidebarItem?) {
    guard item != sidebar else { return }
    sidebar = item
    selectedTakeID = nil
    comparisonTakeID = nil
    if let parent = draft?.parentTakeID,
      workspace?.takes.first(where: { $0.id == parent })?.projectID != item?.projectID
    {
      clearIteration()
    }
  }
  public func record(id: String) -> GenerationRecord? {
    workspace?.history.first { $0.id == id }
  }
  public func item(takeID: String?) -> TakeItem? {
    guard let takeID, let take = workspace?.takes.first(where: { $0.id == takeID }),
      let record = record(id: take.generationID)
    else { return nil }
    return TakeItem(take: take, record: record)
  }
  public func takes(projectID: String?) -> [TakeItem] {
    guard let workspace else { return [] }
    let records = Dictionary(uniqueKeysWithValues: workspace.history.map { ($0.id, $0) })
    return workspace.takes.filter { $0.projectID == projectID }
      .compactMap { take in records[take.generationID].map { TakeItem(take: take, record: $0) } }
      .sorted {
        $0.record.createdAt == $1.record.createdAt
          ? $0.take.index > $1.take.index : $0.record.createdAt > $1.record.createdAt
      }
  }
  public func attempts(projectID: String?) -> [GenerationTask] {
    (workspace?.tasks ?? [])
      .filter {
        [.failed, .cancelled].contains($0.state) && $0.request.projectID == projectID
          && !dismissedTaskIDs.contains($0.id)
      }
      .sorted { $0.createdAt > $1.createdAt }
  }
  public var runningElsewhere: Bool {
    activeTaskID == nil && (workspace?.tasks.contains { $0.state == .running } ?? false)
  }
  public func createProject(name: String) async {
    await perform {
      let project = try await self.core().createProject(name: name)
      try await self.refresh()
      self.select(.project(project.id))
    }
  }
  public func renameProject(id: String, name: String) async {
    await perform {
      try await self.core().renameProject(id: id, name: name)
      try await self.refresh()
    }
  }
  public func deleteProject(id: String) async {
    await perform {
      try await self.core().deleteProject(id: id)
      if self.sidebar == .project(id) { self.select(.unfiled) }
      try await self.refresh()
    }
  }

  // MARK: Generation

  public var canGenerate: Bool {
    guard activity == .idle, !runningElsewhere, let draft, let capabilities else { return false }
    return (try? draft.validate(capabilities: capabilities)) != nil
  }
  public func generate() async {
    guard activity == .idle, var request = draft, let configuration = currentConfiguration else {
      return
    }
    guard readiness(for: configuration).isReady else {
      setupConfigurationID = configuration.id
      return
    }
    request.projectID = selectedProjectID
    do {
      let task = try await core().submit(request)
      try await consume(task)
    } catch {
      self.error = error.localizedDescription
      await refreshAfterError()
    }
  }
  public func retry(taskID: String) async {
    guard activity == .idle else { return }
    do {
      let task = try await core().retry(taskID: taskID)
      dismiss(taskID: taskID)
      try await consume(task)
    } catch {
      self.error = error.localizedDescription
      await refreshAfterError()
    }
  }
  public func openTaskInCompose(taskID: String) {
    guard let task = workspace?.tasks.first(where: { $0.id == taskID }) else { return }
    draft = task.request
    select(task.request.projectID.map(SidebarItem.project) ?? .unfiled)
  }
  public func dismiss(taskID: String) {
    dismissedTaskIDs.insert(taskID)
    defaults.set(Array(dismissedTaskIDs), forKey: Self.dismissedKey)
  }
  public func canReproduce(_ record: GenerationRecord) -> Bool {
    record.seed != nil
      && (configuration(for: record.request.selection)?.capabilities.supported.contains(
        .reproducibility) ?? false)
  }
  public func iterate(takeID: String, reproduce: Bool) async {
    await perform {
      let request = try await self.core().requestForTake(id: takeID, reproduce: reproduce)
      let project = self.workspace?.takes.first { $0.id == takeID }?.projectID
      self.select(project.map(SidebarItem.project) ?? .unfiled)
      self.draft = request
    }
  }
  public func clearIteration() {
    draft?.parentTakeID = nil
    draft?.operation = .generate
  }
  private func consume(_ task: GenerationTask) async throws {
    activeTaskID = task.id
    activity = .generating
    error = nil
    statusMessage = "Queued"
    defer {
      activeTaskID = nil
      activity = .idle
      progress = nil
      statusMessage = nil
    }
    let stream: AsyncThrowingStream<GenerationEvent, Error>
    do {
      stream = try await core().run(taskID: task.id)
    } catch {
      // Keep the request retryable instead of leaving an orphaned queued task.
      try? await core().cancel(taskID: task.id)
      throw error
    }
    for try await event in stream {
      switch event {
      case .engine(.lifecycle(let message)): statusMessage = message
      case .engine(.progress(let fraction, let label)):
        progress = fraction
        statusMessage = label
      case .completed(let record, let take):
        try await refresh()
        if selectedTakeID == nil { selectedTakeID = take.id }
        onTakeCompleted?(record)
      case .task(let state):
        if state.state == .cancelled {
          notice =
            "Generation cancelled. Completed Takes were kept; the local Engine may finish its current computation in the background."
        }
      }
    }
    try await refresh()
  }
  public func cancel() async {
    guard let id = activeTaskID else { return }
    statusMessage = "Cancelling"
    await perform { try await self.core().cancel(taskID: id) }
  }

  // MARK: History

  public var history: [GenerationRecord] { workspace?.history ?? [] }
  public func projectName(_ id: String?) -> String? {
    id.flatMap { id in workspace?.projects.first { $0.id == id }?.name }
  }
  public func takeID(forRecord id: String) -> String? {
    workspace?.takes.first { $0.generationID == id }?.id
  }
  // Records targeted by menu commands: the History selection or the selected Take.
  public var focusedRecords: [GenerationRecord] {
    if sidebar == .history {
      return history.filter { historySelection.contains($0.id) }
    }
    return item(takeID: selectedTakeID).map { [$0.record] } ?? []
  }
  public func setFavorite(id: String, favorite: Bool) async {
    await perform {
      try await self.core().setFavorite(generationID: id, favorite: favorite)
      try await self.refresh()
    }
  }
  public func deleteGenerations(ids: Set<String>) async {
    await perform {
      try await self.core().deleteGenerations(ids: ids, confirmed: true)
      self.historySelection.subtract(ids)
      try await self.refresh()
    }
  }
  public func export(generationID: String, artifactID: String, to destination: URL) async {
    await perform {
      try await self.core().exportArtifact(
        generationID: generationID, artifactID: artifactID, destination: destination)
    }
  }

  // MARK: Installation

  public func install(configurationID: String) {
    guard activity == .idle, let environment,
      let configuration = catalog.configurations.first(where: { $0.id == configurationID })
    else { return }
    activity = .installing
    error = nil
    progress = nil
    statusMessage = "Preparing"
    let packID = configuration.selection.modelPackID
    installTask = Task {
      defer {
        activity = .idle
        progress = nil
        statusMessage = nil
        installTask = nil
      }
      do {
        if try await !environment.runtime.isProvisioned() {
          try await environment.runtime.provision(licenseAccepted: true) { event in
            await self.apply(event)
          }
        }
        if installation(packID: packID)?.state != .installed {
          progress = 0
          try await environment.installer.install(packID: packID, licenseAccepted: true) { event in
            await self.apply(event)
          }
        }
        try await refresh()
        if setupConfigurationID == configurationID { setupConfigurationID = nil }
        notice = "\(configurationName(configuration.selection)) is ready."
      } catch is CancellationError {
        notice = "Installation cancelled. Downloaded files are kept and resume next time."
        await refreshAfterError()
      } catch {
        if Task.isCancelled {
          notice = "Installation cancelled. Downloaded files are kept and resume next time."
        } else {
          self.error = error.localizedDescription
        }
        await refreshAfterError()
      }
    }
  }
  public func cancelInstall() { installTask?.cancel() }
  public func deleteModel(packID: String) async {
    guard let environment else { return }
    await perform {
      try await environment.installer.delete(packID: packID, confirmed: true)
      try await self.refresh()
    }
  }
  private func apply(_ event: EngineEvent) {
    switch event {
    case .lifecycle(let message): statusMessage = message
    case .progress(let fraction, let label):
      progress = fraction
      statusMessage = label
    }
  }

  // MARK: Settings and lifecycle

  public var settings: Settings? { workspace?.settings }
  public func saveSettings(_ settings: Settings) async {
    await perform {
      if let selection = settings.selection { _ = try self.catalog.configuration(selection) }
      try await self.core().updateSettings(settings)
      try await self.refresh()
    }
  }
  public func stopEngine() async {
    guard activity == .idle, let environment else { return }
    await perform {
      try await environment.runtime.stop()
      self.notice = "The local Engine stopped. New settings apply when it next starts."
    }
  }
  public func shutdown() async {
    installTask?.cancel()
    try? await core().shutdown()
  }
  private func perform(_ work: @MainActor () async throws -> Void) async {
    do { try await work() } catch {
      self.error = error.localizedDescription
      await refreshAfterError()
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

// Capability-driven presentation rules shared by Compose and tests.
public enum ComposeRules {
  public static func shows(_ capability: Capability, in capabilities: Capabilities?) -> Bool {
    capabilities?.supported.contains(capability) ?? false
  }
  public static func sanitized(_ request: GenerationRequest, for capabilities: Capabilities)
    -> GenerationRequest
  {
    var request = request
    let supported = capabilities.supported
    if !supported.contains(.lyrics) { request.lyrics = "" }
    if !supported.contains(.reproducibility) { request.seed = nil }
    if !supported.contains(.bpm) { request.bpm = nil }
    if !supported.contains(.key) { request.key = nil }
    if !supported.contains(.timeSignature) { request.timeSignature = nil }
    if !supported.contains(.referenceAudio) { request.references = [] }
    request.duration = min(request.duration, capabilities.maximumDuration)
    return request
  }
}
