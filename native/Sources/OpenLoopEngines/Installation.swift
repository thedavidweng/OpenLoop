import Darwin
import Foundation
import OpenLoopCore

// File lock coordinates runtime/model installation and startup across GUI/CLI.
final class RuntimeLock {
  private let descriptor: Int32
  init(_ url: URL) throws {
    descriptor = open(url.path, O_CREAT | O_RDWR, S_IRUSR | S_IWUSR)
    guard descriptor >= 0 else { throw CoreError.engine("Cannot open runtime lock") }
    guard flock(descriptor, LOCK_EX | LOCK_NB) == 0 else {
      close(descriptor)
      throw CoreError.conflict("Another OpenLoop process is changing this runtime")
    }
  }
  deinit {
    flock(descriptor, LOCK_UN)
    close(descriptor)
  }
}
public actor ModelInstaller {
  private let core: OpenLoopCore
  private let catalog: EngineCatalog
  public init(core: OpenLoopCore, catalog: EngineCatalog = .firstParty) {
    self.core = core
    self.catalog = catalog
  }
  public func install(packID: String, licenseAccepted: Bool, emit: EngineEventSink) async throws {
    guard licenseAccepted else {
      throw CoreError.invalid("Review and accept the Model Pack license before installation")
    }
    guard catalog.packs.contains(where: { $0.id == packID && $0.installable }) else {
      throw CoreError.invalid("Model Pack is not installable")
    }
    let settings = try await core.settings()
    let directory = settings.modelDirectory ?? core.directory.appendingPathComponent("models")
    try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
    let lock = try RuntimeLock(directory.appendingPathComponent("installation.lock"))
    defer { withExtendedLifetime(lock) {} }
    try await core.recordInstallation(.init(id: packID, state: .downloading, directory: directory))
    do {
      let files = try EngineCatalog.modelFiles(packID: packID)
      let total = files.reduce(Int64(0)) { $0 + $1.size }
      var done: Int64 = 0
      for file in files {
        try Task.checkCancellation()
        let destination = directory.appendingPathComponent(file.localPath)
        try FileManager.default.createDirectory(
          at: destination.deletingLastPathComponent(), withIntermediateDirectories: true)
        if FileManager.default.fileExists(atPath: destination.path) {
          let attributes = try FileManager.default.attributesOfItem(atPath: destination.path)
          if (attributes[.size] as? NSNumber)?.int64Value == file.size {
            done += file.size
            try await emit(.progress(Double(done) / Double(total), file.localPath))
            continue
          }
        }
        let url = settings.modelDownloadBaseURL.appendingPathComponent(file.repo)
          .appendingPathComponent("resolve/main").appendingPathComponent(file.remotePath)
        let (temporary, response) = try await URLSession.shared.download(from: url)
        defer {
          if FileManager.default.fileExists(atPath: temporary.path) {
            try? FileManager.default.removeItem(at: temporary)
          }
        }
        guard let http = response as? HTTPURLResponse, http.statusCode == 200,
          (try FileManager.default.attributesOfItem(atPath: temporary.path)[.size] as? NSNumber)?
            .int64Value == file.size
        else { throw CoreError.engine("Model download size/status mismatch: \(file.localPath)") }
        if FileManager.default.fileExists(atPath: destination.path) {
          try FileManager.default.removeItem(at: destination)
        }
        try FileManager.default.moveItem(at: temporary, to: destination)
        done += file.size
        try await emit(.progress(Double(done) / Double(total), file.localPath))
      }
      try await core.recordInstallation(.init(id: packID, state: .installed, directory: directory))
    } catch {
      try await core.recordInstallation(
        .init(id: packID, state: .failed, directory: directory, error: error.localizedDescription))
      throw error
    }
  }
  public func delete(packID: String, confirmed: Bool) async throws {
    guard confirmed else { throw CoreError.confirmationRequired }
    let state = try await core.workspace()
    guard state.tasks.allSatisfy({ ![.queued, .running].contains($0.state) }) else {
      throw CoreError.conflict("Cannot delete models while a Generation Task is active")
    }
    guard let installation = state.installations.first(where: { $0.id == packID }) else {
      throw CoreError.notFound("Model Pack is not installed")
    }
    let lock = try RuntimeLock(installation.directory.appendingPathComponent("installation.lock"))
    defer { withExtendedLifetime(lock) {} }
    let others = state.installations.filter { $0.id != packID && $0.state == .installed }
    let shared = try Set(
      others.flatMap { try EngineCatalog.modelFiles(packID: $0.id).map(\.localPath) })
    for file in try EngineCatalog.modelFiles(packID: packID) where !shared.contains(file.localPath)
    {
      let url = installation.directory.appendingPathComponent(file.localPath)
      if FileManager.default.fileExists(atPath: url.path) {
        try FileManager.default.removeItem(at: url)
      }
    }
    try await core.recordInstallation(
      .init(id: packID, state: .absent, directory: installation.directory))
  }
}
