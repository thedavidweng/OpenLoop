import Foundation

public actor OpenLoopCore {
  public nonisolated let directory: URL
  private let store: Persistence
  private let engines: [String: any Engine]
  private var lease: GenerationLease?
  private var workers: [String: Task<Void, Never>] = [:]
  public static var defaultDirectory: URL {
    FileManager.default.homeDirectoryForCurrentUser.appendingPathComponent(
      "Library/Application Support/com.openmusic.openloop")
  }
  public init(directory: URL = OpenLoopCore.defaultDirectory, engines: [any Engine]) throws {
    guard Set(engines.map(\.id)).count == engines.count else {
      throw CoreError.invalid("Duplicate Engine IDs")
    }
    let persistence = try Persistence(directory: directory)
    self.directory = directory
    self.store = persistence
    self.engines = Dictionary(uniqueKeysWithValues: engines.map { ($0.id, $0) })
    do {
      let recoveryLease = try GenerationLease(directory: directory)
      defer { withExtendedLifetime(recoveryLease) {} }
      try persistence.transaction {
        for var task in try persistence.all("task", as: GenerationTask.self)
        where task.state == .running {
          task.state = .failed
          task.error =
            "OpenLoop exited before this Generation Task completed. Retry to generate again."
          try persistence.save("task", id: task.id, value: task)
        }
      }
    } catch CoreError.conflict { /* A live GUI/CLI still owns the running task. */  }
  }
  public func workspace() throws -> Workspace {
    Workspace(
      projects: try store.all("project", as: Project.self),
      takes: try store.all("take", as: Take.self),
      history: try store.all("generation", as: GenerationRecord.self).sorted {
        $0.createdAt > $1.createdAt
      },
      tasks: try store.all("task", as: GenerationTask.self), settings: try settings(),
      installations: try store.all("installation", as: ModelInstallation.self))
  }
  public func settings() throws -> Settings {
    try store.get("settings", id: "shared", as: Settings.self)
  }
  public func updateSettings(_ value: Settings) throws {
    try value.validate()
    try store.save("settings", id: "shared", value: value)
  }
  public func recordInstallation(_ installation: ModelInstallation) throws {
    try store.save("installation", id: installation.id, value: installation)
  }
  public func createProject(name: String) throws -> Project {
    guard !name.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty else {
      throw CoreError.invalid("Project name is required")
    }
    let project = Project(name: name)
    try store.save("project", id: project.id, value: project)
    return project
  }
  public func renameProject(id: String, name: String) throws {
    guard !name.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty else {
      throw CoreError.invalid("Project name is required")
    }
    var project = try store.get("project", id: id, as: Project.self)
    project.name = name
    try store.save("project", id: id, value: project)
  }
  public func deleteProject(id: String) throws {
    try store.transaction {
      _ = try store.get("project", id: id, as: Project.self)
      guard
        try store.all("task", as: GenerationTask.self).allSatisfy({
          $0.request.projectID != id || ![.queued, .running].contains($0.state)
        })
      else { throw CoreError.conflict("Project has an active Generation Task") }
      for var record in try store.all("generation", as: GenerationRecord.self)
      where record.request.projectID == id {
        record.request.projectID = nil
        try store.save("generation", id: record.id, value: record)
      }
      for var take in try store.all("take", as: Take.self) where take.projectID == id {
        take.projectID = nil
        try store.save("take", id: take.id, value: take)
      }
      try store.remove("project", id: id)
    }
  }
  public func capabilities(for selection: Selection) throws -> Capabilities {
    try engine(selection.engineID).capabilities(for: selection)
  }
  private func engine(_ id: String) throws -> any Engine {
    guard let engine = engines[id] else { throw CoreError.invalid("No bound Engine: \(id)") }
    return engine
  }
  public func submit(_ request: GenerationRequest) throws -> GenerationTask {
    try engine(request.selection.engineID).validate(request)
    if let id = request.projectID { _ = try store.get("project", id: id, as: Project.self) }
    if let id = request.parentTakeID {
      let parent = try store.get("take", id: id, as: Take.self)
      guard parent.projectID == request.projectID else {
        throw CoreError.invalid("Parent Take belongs to another Project")
      }
    }
    let task = GenerationTask(
      id: UUID().uuidString, request: request, state: .queued, createdAt: Date())
    try store.save("task", id: task.id, value: task)
    return task
  }
  public func retry(taskID: String) throws -> GenerationTask {
    let task = try store.get("task", id: taskID, as: GenerationTask.self)
    guard [.failed, .cancelled].contains(task.state) else {
      throw CoreError.invalid("Only failed or cancelled tasks can be retried")
    }
    return try submit(task.request)
  }
  public func requestForTake(id: String, reproduce: Bool) throws -> GenerationRequest {
    let take = try store.get("take", id: id, as: Take.self)
    let record = try store.get("generation", id: take.generationID, as: GenerationRecord.self)
    var request = record.request
    request.takeCount = 1
    if reproduce {
      guard try capabilities(for: request.selection).supported.contains(.reproducibility),
        let seed = record.seed
      else { throw CoreError.invalid("This Take cannot be reproduced") }
      request.seed = seed

    } else {
      request.seed = nil
      request.parentTakeID = id
      request.operation = .variation
    }
    return request
  }
  public func run(taskID: String) throws -> AsyncThrowingStream<GenerationEvent, Error> {
    let executionLease = try GenerationLease(directory: directory)
    let task: GenerationTask = try store.transaction {
      var task = try store.get("task", id: taskID, as: GenerationTask.self)
      guard task.state == .queued else { throw CoreError.conflict("Generation Task is not queued") }
      guard try store.all("task", as: GenerationTask.self).allSatisfy({ $0.state != .running })
      else { throw CoreError.conflict("A Generation Task is already running") }
      task.state = .running
      try store.save("task", id: taskID, value: task)
      return task
    }
    lease = executionLease
    let (stream, continuation) = AsyncThrowingStream<GenerationEvent, Error>.makeStream()
    workers[taskID] = Task { await self.execute(task, continuation: continuation) }
    continuation.onTermination = { termination in
      if case .cancelled = termination {
        Task {
          do { try await self.cancel(taskID: taskID) } catch {
            continuation.finish(throwing: error)
          }
        }
      }
    }
    return stream
  }
  private func assertRunning(_ id: String) throws {
    try Task.checkCancellation()
    guard try store.get("task", id: id, as: GenerationTask.self).state == .running else {
      throw CancellationError()
    }
  }
  private func execute(
    _ task: GenerationTask, continuation: AsyncThrowingStream<GenerationEvent, Error>.Continuation
  ) async {
    var current = task
    continuation.yield(.task(current))
    do {
      let adapter = try engine(task.request.selection.engineID)
      let outputRoot = try settings().outputDirectory ?? directory.appendingPathComponent("outputs")
      for index in 1...task.request.takeCount {
        try assertRunning(task.id)
        let generationID = UUID().uuidString
        let output = outputRoot.appendingPathComponent(generationID)
        try FileManager.default.createDirectory(at: output, withIntermediateDirectories: true)
        do {
          var request = task.request
          request.takeCount = 1
          if let seed = request.seed {
            let (next, overflow) = seed.addingReportingOverflow(Int64(index - 1))
            guard !overflow else { throw CoreError.invalid("Seed overflow") }
            request.seed = next
          }
          let result = try await adapter.generate(request, taskID: task.id, outputDirectory: output)
          { event in
            try await self.assertRunning(task.id)
            continuation.yield(.engine(event))
          }
          try assertRunning(task.id)
          guard result.artifacts.contains(where: { $0.kind == .audio }),
            result.artifacts.allSatisfy({
              $0.url.isFileURL && $0.exists
                && $0.url.standardizedFileURL.path.hasPrefix(output.standardizedFileURL.path + "/")
            })
          else {
            throw CoreError.engine("Engine returned missing or non-owned artifacts")
          }
          let record = GenerationRecord(
            id: generationID, taskID: task.id, createdAt: Date(), request: request,
            artifacts: result.artifacts, seed: result.seed, metadata: result.metadata,
            isFavorite: false)
          let take = Take(
            id: generationID, projectID: request.projectID, parentTakeID: request.parentTakeID,
            generationID: generationID, index: index)
          try store.transaction {
            try assertRunning(task.id)
            try store.save("generation", id: record.id, value: record)
            try store.save("take", id: take.id, value: take)
          }
          continuation.yield(.completed(record, take))
        } catch {
          try FileManager.default.removeItem(at: output)
          throw error
        }
      }
      current.state = .completed
      try store.save("task", id: current.id, value: current)
      continuation.yield(.task(current))
      continuation.finish()
    } catch {
      current.state = error is CancellationError ? .cancelled : .failed
      current.error = error is CancellationError ? nil : error.localizedDescription
      do {
        try store.save("task", id: current.id, value: current)
        continuation.yield(.task(current))
        if current.state == .cancelled {
          continuation.finish()
        } else {
          continuation.finish(throwing: error)
        }
      } catch { continuation.finish(throwing: error) }
    }
    workers[task.id] = nil
    lease = nil
  }
  public func cancel(taskID: String) async throws {
    var task = try store.get("task", id: taskID, as: GenerationTask.self)
    guard [.queued, .running].contains(task.state) else { return }
    let running = task.state == .running
    task.state = .cancelled
    try store.save("task", id: task.id, value: task)
    workers[taskID]?.cancel()
    if running { try await engine(task.request.selection.engineID).cancel(taskID: task.id) }
  }
  public func setFavorite(generationID: String, favorite: Bool) throws {
    try store.transaction {
      var record = try store.get("generation", id: generationID, as: GenerationRecord.self)
      record.isFavorite = favorite
      try store.save("generation", id: record.id, value: record)
    }
  }
  public func deleteGenerations(ids: Set<String>, confirmed: Bool) throws {
    guard confirmed else { throw CoreError.confirmationRequired }
    try store.transaction {
      guard
        try store.all("task", as: GenerationTask.self).allSatisfy({ task in
          guard [.queued, .running].contains(task.state), let parent = task.request.parentTakeID
          else { return true }
          return !ids.contains(parent)
        })
      else { throw CoreError.conflict("A Generation Task is using one of these Takes") }
      let records = try ids.map { try store.get("generation", id: $0, as: GenerationRecord.self) }
      let retained = try store.all("generation", as: GenerationRecord.self).filter {
        !ids.contains($0.id)
      }
      let retainedPaths = Set(retained.flatMap(\.artifacts).map { $0.url.standardizedFileURL.path })
      for artifact in records.flatMap(\.artifacts)
      where artifact.exists && !retainedPaths.contains(artifact.url.standardizedFileURL.path) {
        try FileManager.default.removeItem(at: artifact.url)
      }
      for record in records { try store.remove("generation", id: record.id) }
      for var take in try store.all("take", as: Take.self) {
        if ids.contains(take.generationID) {
          try store.remove("take", id: take.id)
        } else if let parent = take.parentTakeID, ids.contains(parent) {
          take.parentTakeID = nil
          try store.save("take", id: take.id, value: take)
        }
      }
    }
  }
  public func exportArtifact(generationID: String, artifactID: String, destination: URL) throws {
    let record = try store.get("generation", id: generationID, as: GenerationRecord.self)
    guard let artifact = record.artifacts.first(where: { $0.id == artifactID }), artifact.exists,
      destination.isFileURL
    else { throw CoreError.invalid("Artifact or destination is unavailable") }
    try FileManager.default.copyItem(at: artifact.url, to: destination)
  }
  public func shutdown() async throws {
    for id in Array(workers.keys) { try await cancel(taskID: id) }
    for worker in workers.values { await worker.value }
    guard try store.all("task", as: GenerationTask.self).allSatisfy({ $0.state != .running }) else {
      throw CoreError.conflict("Another process is using the local Engine")
    }
    for adapter in engines.values { try await adapter.shutdown() }
  }
}
