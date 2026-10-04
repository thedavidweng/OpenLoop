import Foundation
import OpenLoopCore
import OpenLoopEngines

public struct CLIEvent: Codable, Sendable {
  public let v: Int
  public let ts: String
  public let kind: String
  public let data: JSONValue
  public init(kind: String, data: JSONValue) {
    v = 2
    ts = Date().ISO8601Format()
    self.kind = kind
    self.data = data
  }
  public static func error(_ error: any Error) -> CLIEvent {
    .init(
      kind: "error",
      data: .object([
        "message": .string(error.localizedDescription),
        "code": .string(error is CoreError ? "OPENLOOP_ERROR" : "SYSTEM_ERROR"),
      ]))
  }
}
public typealias CLIEventSink = @Sendable (CLIEvent) async throws -> Void
struct Arguments {
  var values: [String]
  mutating func flag(_ name: String) -> Bool {
    guard let index = values.firstIndex(of: name) else { return false }
    values.remove(at: index)
    return true
  }
  mutating func option(_ name: String) throws -> String? {
    guard let index = values.firstIndex(of: name) else { return nil }
    guard index + 1 < values.count, !values[index + 1].hasPrefix("--") else {
      throw CoreError.invalid("Missing value for \(name)")
    }
    let value = values.remove(at: index + 1)
    values.remove(at: index)
    return value
  }
  mutating func positional() throws -> String {
    guard !values.isEmpty, !values[0].hasPrefix("--") else {
      throw CoreError.invalid("Missing command argument")
    }
    return values.removeFirst()
  }
  func finish() throws {
    guard values.isEmpty else {
      throw CoreError.invalid("Unexpected arguments: \(values.joined(separator: " "))")
    }
  }
}
public struct OpenLoopCLI: Sendable {
  public let environment: OpenLoopEnvironment
  public init(environment: OpenLoopEnvironment) { self.environment = environment }
  public static let usage = """
    OpenLoop native CLI (NDJSON v2 with --json)
      status | catalog | list | ps
      project list | create NAME | rename ID NAME | delete ID
      settings get | set FILE.json
      setup --accept-license
      models list | install PACK --accept-license | delete PACK --yes
      run --prompt TEXT [--configuration ID] [--lyrics TEXT] [--duration SECONDS]
          [--seed INTEGER] [--takes COUNT] [--project ID] [--format wav|mp3|flac] [--accept-license]
      run --request FILE.json
      retry TASK_ID | stop TASK_ID
      reproduce TAKE_ID | vary TAKE_ID
      delete GENERATION_ID --yes | clear --yes
      favorite GENERATION_ID [--off]
      export GENERATION_ID ARTIFACT_ID DESTINATION
    Global executable options: --data-dir PATH, --uv PATH, --json
    """
  public func execute(arguments: [String], emit: @escaping CLIEventSink) async throws {
    var args = Arguments(values: arguments)
    let command = try args.positional()
    let core = environment.core
    let engineEvents: EngineEventSink = { event in try await emit(CLIEvent(engineEvent: event)) }
    switch command {
    case "help", "--help":
      try args.finish()
      try await result(Self.usage, emit)
    case "catalog":
      try args.finish()
      try await result(environment.catalog, emit)
    case "status":
      try args.finish()
      try await result(await core.settings(), emit)
    case "list":
      try args.finish()
      try await result(await core.workspace().history, emit)
    case "ps":
      try args.finish()
      try await result(await core.workspace().tasks, emit)
    case "project":
      let action = try args.positional()
      switch action {
      case "list":
        try args.finish()
        try await result(await core.workspace().projects, emit)
      case "create":
        let name = try args.positional()
        try args.finish()
        try await result(await core.createProject(name: name), emit)
      case "rename":
        let id = try args.positional()
        let name = try args.positional()
        try args.finish()
        try await core.renameProject(id: id, name: name)
        try await result("Project renamed", emit)
      case "delete":
        let id = try args.positional()
        try args.finish()
        try await core.deleteProject(id: id)
        try await result("Project deleted; Takes retained in History", emit)
      default: throw CoreError.invalid("Unknown project command")
      }
    case "settings":
      switch try args.positional() {
      case "get":
        try args.finish()
        try await result(await core.settings(), emit)
      case "set":
        let path = try args.positional()
        try args.finish()
        let settings = try JSONDecoder().decode(
          Settings.self, from: Data(contentsOf: URL(fileURLWithPath: path)))
        if let selection = settings.selection {
          _ = try environment.catalog.configuration(selection)
        }
        try await core.updateSettings(settings)
        try await result("Settings saved; runtime changes apply on next start", emit)
      default: throw CoreError.invalid("Unknown settings command")
      }
    case "setup":
      let accepted = args.flag("--accept-license")
      try args.finish()
      try await environment.runtime.provision(licenseAccepted: accepted, emit: engineEvents)
      try await result("Runtime installed", emit)
    case "models":
      switch try args.positional() {
      case "list":
        try args.finish()
        try await result(await core.workspace().installations, emit)
      case "install":
        let id = try args.positional()
        let accepted = args.flag("--accept-license")
        try args.finish()
        try await environment.installer.install(
          packID: id, licenseAccepted: accepted, emit: engineEvents)
        try await result("Model Pack installed", emit)
      case "delete":
        let id = try args.positional()
        let confirmed = args.flag("--yes")
        try args.finish()
        try await environment.installer.delete(packID: id, confirmed: confirmed)
        try await result("Model Pack deleted", emit)
      default: throw CoreError.invalid("Unknown models command")
      }
    case "run":
      let accepted = args.flag("--accept-license")
      let request: GenerationRequest
      if let path = try args.option("--request") {
        request = try JSONDecoder().decode(
          GenerationRequest.self, from: Data(contentsOf: URL(fileURLWithPath: path)))
      } else {
        let settings = try await core.settings()
        let selection: Selection
        if let config = try args.option("--configuration") {
          selection = try environment.catalog.selection(configurationID: config)
        } else if let selected = settings.selection {
          selection = selected
        } else {
          throw CoreError.invalid("Choose a configuration with --configuration or Settings")
        }
        guard let prompt = try args.option("--prompt") else {
          throw CoreError.invalid("--prompt is required")
        }
        let lyrics = try args.option("--lyrics") ?? ""
        let duration = try numericOption(
          &args, "--duration", default: settings.defaultDuration, parse: Double.init)
        let takes = try numericOption(&args, "--takes", default: 1, parse: Int.init)
        let seed: Int64?
        if let text = try args.option("--seed") {
          guard let value = Int64(text) else { throw CoreError.invalid("Invalid seed") }
          seed = value
        } else {
          seed = nil
        }
        request = try GenerationRequest(
          selection: selection, prompt: prompt, lyrics: lyrics, duration: duration, seed: seed,
          takeCount: takes,
          projectID: args.option("--project"),
          audioFormat: args.option("--format") ?? settings.defaultAudioFormat)
      }
      try args.finish()
      if accepted {
        _ = try environment.catalog.configuration(request.selection)
        try await environment.runtime.provision(licenseAccepted: true, emit: engineEvents)
        try await environment.installer.install(
          packID: request.selection.modelPackID, licenseAccepted: true, emit: engineEvents)
      }
      let task = try await core.submit(request)
      try await generate(task, emit: emit)
    case "retry":
      let id = try args.positional()
      try args.finish()
      try await generate(core.retry(taskID: id), emit: emit)
    case "reproduce", "vary":
      let id = try args.positional()
      try args.finish()
      let request = try await core.requestForTake(id: id, reproduce: command == "reproduce")
      try await generate(core.submit(request), emit: emit)
    case "stop":
      let id = try args.positional()
      try args.finish()
      try await core.cancel(taskID: id)
      try await result("Generation Task cancelled", emit)
    case "delete":
      let id = try args.positional()
      let confirmed = args.flag("--yes")
      try args.finish()
      try await core.deleteGenerations(ids: [id], confirmed: confirmed)
      try await result("Generation and local Artifacts deleted", emit)
    case "clear":
      let confirmed = args.flag("--yes")
      try args.finish()
      let ids = Set(try await core.workspace().history.map(\.id))
      try await core.deleteGenerations(ids: ids, confirmed: confirmed)
      try await result("Deleted \(ids.count) Generations and local Artifacts", emit)
    case "favorite":
      let id = try args.positional()
      let favorite = !args.flag("--off")
      try args.finish()
      try await core.setFavorite(generationID: id, favorite: favorite)
      try await result("Favorite updated", emit)
    case "export":
      let generation = try args.positional()
      let artifact = try args.positional()
      let destination = try args.positional()
      try args.finish()
      try await core.exportArtifact(
        generationID: generation, artifactID: artifact,
        destination: URL(fileURLWithPath: destination))
      try await result(destination, emit)
    default: throw CoreError.invalid("Unknown command: \(command). Run openloop help.")
    }
  }
  private func numericOption<T>(
    _ args: inout Arguments, _ name: String, default value: T, parse: (String) -> T?
  ) throws -> T {
    guard let text = try args.option(name) else { return value }
    guard let number = parse(text) else { throw CoreError.invalid("Invalid \(name)") }
    return number
  }
  private func result<T: Encodable>(_ value: T, _ emit: CLIEventSink) async throws {
    let data = try JSONDecoder().decode(JSONValue.self, from: JSONEncoder().encode(value))
    try await emit(.init(kind: "result", data: data))
  }
  private func generate(_ task: GenerationTask, emit: CLIEventSink) async throws {
    do {
      try await result(task, emit)
      for try await event in try await environment.core.run(taskID: task.id) {
        switch event {
        case .task(let task): try await result(task, emit)
        case .completed(let generation, let take):
          let value = try JSONDecoder().decode(
            JSONValue.self, from: JSONEncoder().encode(generation))
          let takeValue = try JSONDecoder().decode(JSONValue.self, from: JSONEncoder().encode(take))
          try await emit(
            .init(kind: "result", data: .object(["generation": value, "take": takeValue])))
        case .engine(let event): try await emit(CLIEvent(engineEvent: event))
        }
      }
      try Task.checkCancellation()
    } catch is CancellationError {
      try await environment.core.cancel(taskID: task.id)
      throw CancellationError()
    }
  }
}

public func openEnvironment(directory: URL?, uv: URL) async throws -> OpenLoopEnvironment {
  try await OpenLoopEnvironment.open(
    directory: directory ?? OpenLoopCore.defaultDirectory, bundledUV: uv)
}

extension CLIEvent {
  fileprivate init(engineEvent: EngineEvent) {
    switch engineEvent {
    case .lifecycle(let message):
      self.init(kind: "lifecycle", data: .object(["message": .string(message)]))
    case .progress(let fraction, let label):
      self.init(
        kind: "progress",
        data: .object([
          "fraction": fraction.map(JSONValue.number) ?? .null, "label": .string(label),
        ]))
    }
  }
}
