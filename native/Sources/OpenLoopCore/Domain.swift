import Foundation

public enum CoreError: Error, LocalizedError, Sendable {
  case invalid(String)
  case notFound(String)
  case conflict(String)
  case persistence(String)
  case engine(String)
  case confirmationRequired
  public var errorDescription: String? {
    switch self {
    case .invalid(let s), .notFound(let s), .conflict(let s), .persistence(let s), .engine(let s): s
    case .confirmationRequired: "Explicit confirmation is required to delete local artifacts."
    }
  }
}

public enum JSONValue: Codable, Sendable, Equatable {
  case string(String)
  case integer(Int64)
  case number(Double)
  case bool(Bool)
  case array([JSONValue])
  case object([String: JSONValue])
  case null
  public init(from decoder: any Decoder) throws {
    let c = try decoder.singleValueContainer()
    if c.decodeNil() {
      self = .null
    } else if let v = try? c.decode(Bool.self) {
      self = .bool(v)
    } else if let v = try? c.decode(Int64.self) {
      self = .integer(v)
    } else if let v = try? c.decode(Double.self) {
      self = .number(v)
    } else if let v = try? c.decode(String.self) {
      self = .string(v)
    } else if let v = try? c.decode([JSONValue].self) {
      self = .array(v)
    } else {
      self = .object(try c.decode([String: JSONValue].self))
    }
  }
  public func encode(to encoder: any Encoder) throws {
    var c = encoder.singleValueContainer()
    switch self {
    case .string(let v): try c.encode(v)
    case .integer(let v): try c.encode(v)
    case .number(let v): try c.encode(v)
    case .bool(let v): try c.encode(v)
    case .array(let v): try c.encode(v)
    case .object(let v): try c.encode(v)
    case .null: try c.encodeNil()
    }
  }
}

public enum Capability: String, Codable, Sendable, CaseIterable {
  case lyrics, bpm, key, timeSignature, referenceAudio, cover, repaint, extend, score, stems,
    timedLyrics, reproducibility
}
public struct Capabilities: Codable, Sendable, Equatable {
  public var supported: Set<Capability>
  public var maximumDuration: Double
  public init(_ supported: Set<Capability>, maximumDuration: Double) {
    self.supported = supported
    self.maximumDuration = maximumDuration
  }
}
public struct Selection: Codable, Sendable, Equatable {
  public var engineID: String
  public var runtimeID: String
  public var modelPackID: String
  public var configurationID: String
  public init(engineID: String, runtimeID: String, modelPackID: String, configurationID: String) {
    self.engineID = engineID
    self.runtimeID = runtimeID
    self.modelPackID = modelPackID
    self.configurationID = configurationID
  }
}
public enum Operation: String, Codable, Sendable {
  case generate, variation, cover, repaint, extend
}
public struct EngineOptions: Codable, Sendable, Equatable {
  public var version: Int
  public var values: [String: JSONValue]
  public init(version: Int = 1, values: [String: JSONValue] = [:]) {
    self.version = version
    self.values = values
  }
}
public struct GenerationRequest: Codable, Sendable, Equatable {
  public var selection: Selection
  public var projectID: String?
  public var parentTakeID: String?
  public var prompt: String
  public var lyrics: String
  public var duration: Double
  public var seed: Int64?
  public var takeCount: Int
  public var operation: Operation
  public var references: [URL]
  public var bpm: Int?
  public var key: String?
  public var timeSignature: String?
  public var audioFormat: String
  public var engineOptions: EngineOptions
  public init(
    selection: Selection, prompt: String, lyrics: String = "", duration: Double = 30,
    seed: Int64? = nil, takeCount: Int = 1, projectID: String? = nil,
    parentTakeID: String? = nil, operation: Operation = .generate,
    references: [URL] = [], bpm: Int? = nil, key: String? = nil,
    timeSignature: String? = nil, audioFormat: String = "wav",
    engineOptions: EngineOptions = .init()
  ) {
    self.selection = selection
    self.prompt = prompt
    self.lyrics = lyrics
    self.duration = duration
    self.seed = seed
    self.takeCount = takeCount
    self.projectID = projectID
    self.parentTakeID = parentTakeID
    self.operation = operation
    self.references = references
    self.bpm = bpm
    self.key = key
    self.timeSignature = timeSignature
    self.audioFormat = audioFormat
    self.engineOptions = engineOptions
  }
  public func validate(capabilities: Capabilities) throws {
    guard !prompt.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty,
      duration.isFinite, duration > 0, duration <= capabilities.maximumDuration,
      (1...8).contains(takeCount), ["wav", "mp3", "flac"].contains(audioFormat)
    else {
      throw CoreError.invalid("Invalid prompt, duration, take count, or audio format.")
    }
    var required = Set<Capability>()
    if !lyrics.isEmpty { required.insert(.lyrics) }
    if seed != nil { required.insert(.reproducibility) }
    if bpm != nil { required.insert(.bpm) }
    if key != nil { required.insert(.key) }
    if timeSignature != nil { required.insert(.timeSignature) }
    if !references.isEmpty { required.insert(.referenceAudio) }
    switch operation {
    case .cover: required.insert(.cover)
    case .repaint: required.insert(.repaint)
    case .extend: required.insert(.extend)
    case .generate, .variation: break
    }
    guard required.isSubset(of: capabilities.supported) else {
      throw CoreError.invalid("Selected Engine does not support the requested capabilities.")
    }
    guard references.allSatisfy(\.isFileURL) else {
      throw CoreError.invalid("Reference artifacts must be local files.")
    }
    if let bpm, bpm <= 0 { throw CoreError.invalid("BPM must be positive.") }
    if operation != .generate && parentTakeID == nil {
      throw CoreError.invalid("Iteration requires a parent Take.")
    }
  }
}
public struct Project: Codable, Sendable, Equatable, Identifiable {
  public var id: String
  public var name: String
  public var createdAt: Date
  public init(id: String = UUID().uuidString, name: String, createdAt: Date = Date()) {
    self.id = id
    self.name = name
    self.createdAt = createdAt
  }
}
public enum ArtifactKind: String, Codable, Sendable {
  case audio, timedLyrics, midi, score, stem, metadata
}
public struct Artifact: Codable, Sendable, Equatable, Identifiable {
  public var id: String
  public var kind: ArtifactKind
  public var url: URL
  public var mediaType: String
  public init(id: String = UUID().uuidString, kind: ArtifactKind, url: URL, mediaType: String) {
    self.id = id
    self.kind = kind
    self.url = url
    self.mediaType = mediaType
  }
  public var exists: Bool { FileManager.default.fileExists(atPath: url.path) }
}
public struct EngineResult: Sendable {
  public var artifacts: [Artifact]
  public var seed: Int64?
  public var metadata: [String: JSONValue]
  public init(artifacts: [Artifact], seed: Int64? = nil, metadata: [String: JSONValue] = [:]) {
    self.artifacts = artifacts
    self.seed = seed
    self.metadata = metadata
  }
}
public struct GenerationRecord: Codable, Sendable, Equatable, Identifiable {
  public var id: String
  public var taskID: String
  public var createdAt: Date
  public var request: GenerationRequest
  public var artifacts: [Artifact]
  public var seed: Int64?
  public var metadata: [String: JSONValue]
  public var isFavorite: Bool
}
public struct Take: Codable, Sendable, Equatable, Identifiable {
  public var id: String
  public var projectID: String?
  public var parentTakeID: String?
  public var generationID: String
  public var index: Int
}
public enum TaskState: String, Codable, Sendable {
  case queued, running, completed, failed, cancelled
}
public struct GenerationTask: Codable, Sendable, Equatable, Identifiable {
  public var id: String
  public var request: GenerationRequest
  public var state: TaskState
  public var createdAt: Date
  public var error: String?
}
public enum EngineEvent: Sendable {
  case lifecycle(String)
  case progress(Double?, String)
}
public enum GenerationEvent: Sendable {
  case task(GenerationTask)
  case engine(EngineEvent)
  case completed(GenerationRecord, Take)
}
public typealias EngineEventSink = @Sendable (EngineEvent) async throws -> Void
public protocol Engine: Sendable {
  var id: String { get }
  func capabilities(for selection: Selection) throws -> Capabilities
  func validate(_ request: GenerationRequest) throws
  func generate(
    _ request: GenerationRequest, taskID: String, outputDirectory: URL, emit: EngineEventSink
  ) async throws -> EngineResult
  func cancel(taskID: String) async throws
  func shutdown() async throws
}
public struct Settings: Codable, Sendable, Equatable {
  public var selection: Selection?
  public var backendPort: Int = 8001
  public var defaultDuration: Double = 30
  public var defaultAudioFormat: String = "wav"
  public var outputDirectory: URL?
  public var modelDirectory: URL?
  public var runtimeDirectory: URL?
  public var logDirectory: URL?
  public var modelDownloadBaseURL: URL = URL(string: "https://huggingface.co")!
  public var language: String?
  public var firstRunCompleted = false
  public var legacyValues: [String: JSONValue] = [:]
  public init() {}
  public func validate() throws {
    guard (1024...65535).contains(backendPort), defaultDuration.isFinite, defaultDuration > 0,
      ["wav", "mp3", "flac"].contains(defaultAudioFormat), modelDownloadBaseURL.scheme == "https",
      modelDownloadBaseURL.host != nil,
      [outputDirectory, modelDirectory, runtimeDirectory, logDirectory].compactMap({ $0 })
        .allSatisfy(\.isFileURL)
    else {
      throw CoreError.invalid("Invalid Settings.")
    }
  }
}
public enum InstallationState: String, Codable, Sendable {
  case absent, downloading, installed, failed
}
public struct ModelInstallation: Codable, Sendable, Equatable, Identifiable {
  public var id: String
  public var state: InstallationState
  public var directory: URL
  public var error: String?
  public init(id: String, state: InstallationState, directory: URL, error: String? = nil) {
    self.id = id
    self.state = state
    self.directory = directory
    self.error = error
  }
}
public struct Workspace: Sendable {
  public var projects: [Project]
  public var takes: [Take]
  public var history: [GenerationRecord]
  public var tasks: [GenerationTask]
  public var settings: Settings
  public var installations: [ModelInstallation]
}

extension Engine {
  public func validate(_ request: GenerationRequest) throws {
    try request.validate(capabilities: capabilities(for: request.selection))
  }
}
