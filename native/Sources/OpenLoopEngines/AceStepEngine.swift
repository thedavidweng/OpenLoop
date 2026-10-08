import Foundation
import OpenLoopCore

public struct AceAdvancedSettings: Codable, Sendable {
  public var negativePrompt: String?
  public var vocalLanguage: String = "unknown"
  public var thinking: Bool?
  public var inferenceSteps: Int = 8
  public var guidanceScale: Double = 7
  public var coverStrength: Double?
  public init() {}
}
public struct AceStepEngine: Engine {
  public let id = "ace-step"
  private let runtime: AceRuntime
  private let catalog: EngineCatalog
  public init(runtime: AceRuntime, catalog: EngineCatalog = .firstParty) {
    self.runtime = runtime
    self.catalog = catalog
  }
  public func capabilities(for selection: Selection) throws -> Capabilities {
    try catalog.configuration(selection).capabilities
  }
  public func validate(_ request: GenerationRequest) throws { _ = try payload(for: request) }
  public func payload(for request: GenerationRequest) throws -> JSONValue {
    let config = try catalog.configuration(request.selection)
    try request.validate(capabilities: config.capabilities)
    if let seed = request.seed, seed < 0 {
      throw CoreError.invalid(
        "ACE-Step deterministic seed must be nonnegative; omit seed for random generation")
    }
    guard request.engineOptions.version == 1 else {
      throw CoreError.invalid("Unsupported ACE-Step options version")
    }
    let supported: Set<String> = [
      "negativePrompt", "vocalLanguage", "thinking", "inferenceSteps", "guidanceScale",
      "coverStrength",
    ]
    guard Set(request.engineOptions.values.keys).isSubset(of: supported) else {
      throw CoreError.invalid("Unknown ACE-Step advanced setting")
    }
    var defaults: [String: JSONValue] = [
      "vocalLanguage": .string("unknown"), "inferenceSteps": .number(8),
      "guidanceScale": .number(7),
    ]
    defaults.merge(request.engineOptions.values) { _, new in new }
    let options = try JSONDecoder().decode(
      AceAdvancedSettings.self, from: JSONEncoder().encode(JSONValue.object(defaults)))
    guard (1...200).contains(options.inferenceSteps), options.guidanceScale.isFinite,
      options.guidanceScale >= 0
    else { throw CoreError.invalid("Invalid ACE-Step inference settings") }
    if [.cover, .repaint].contains(request.operation) && request.references.isEmpty {
      throw CoreError.invalid("Cover/repaint requires source audio")
    }
    if let strength = options.coverStrength, !strength.isFinite || !(0...1).contains(strength) {
      throw CoreError.invalid("Cover strength must be between zero and one")
    }
    let thinking = options.thinking ?? config.thinking
    guard !thinking || config.languageModel != nil else {
      throw CoreError.invalid("Planning requires a configuration with a language model")
    }
    var payload: [String: JSONValue] = [
      "prompt": .string(request.prompt), "lyrics": .string(request.lyrics),
      "vocal_language": .string(options.vocalLanguage),
      "audio_duration": .number(request.duration), "audio_format": .string(request.audioFormat),
      "model": .string(config.model),
      "task_type": .string(
        request.operation == .cover
          ? "cover" : request.operation == .repaint ? "repaint" : "text2music"),
      "thinking": .bool(thinking),
      "inference_steps": .number(Double(options.inferenceSteps)),
      "guidance_scale": .number(options.guidanceScale),
      "use_random_seed": .bool(request.seed == nil), "seed": .integer(request.seed ?? -1),
      "batch_size": .number(1), "lm_backend": .string("mlx"),
      "time_signature": .string(request.timeSignature ?? "4"),
      "use_format": .bool(thinking), "use_cot_caption": .bool(thinking),
      "use_cot_language": .bool(thinking),
      "constrained_decoding": .bool(true),
    ]
    if let lm = config.languageModel { payload["lm_model_path"] = .string(lm) }
    if let bpm = request.bpm { payload["bpm"] = .number(Double(bpm)) }
    if let key = request.key { payload["key_scale"] = .string(key) }
    if let negative = options.negativePrompt { payload["negative_prompt"] = .string(negative) }
    if let audio = request.references.first {
      payload[request.operation == .generate ? "reference_audio_path" : "src_audio_path"] = .string(
        audio.path)
    }
    // Core validated the region; ACE-Step has no extend task, so the catalog never
    // claims `.extend` and only repaint reaches this mapping.
    if request.operation == .repaint, let region = request.editRegion {
      payload["repainting_start"] = .number(region.start)
      payload["repainting_end"] = .number(region.end)
    }
    if let strength = options.coverStrength { payload["audio_cover_strength"] = .number(strength) }
    return .object(payload)
  }
  public func generate(
    _ request: GenerationRequest, taskID: String, outputDirectory: URL, emit: EngineEventSink
  ) async throws -> EngineResult {
    let body = try payload(for: request)
    let port = try await runtime.ensureReady(selection: request.selection, emit: emit)
    let http = try LocalHTTP(port: port)
    let submitted = try await http.envelope("/release_task", body: body)
    // Both response shapes are documented in the existing adapter contract.
    guard
      let backendID = submitted["task_id"]?.string ?? submitted["task_ids"]?.array?.first?.string
    else { throw CoreError.engine("Engine did not return a task ID") }
    let deadline = Date().addingTimeInterval(900)
    while Date() < deadline {
      try Task.checkCancellation()
      let results = try await http.envelope(
        "/query_result", body: .object(["task_id_list": .array([.string(backendID)])]))
      guard let item = results.array?.first, let status = item["status"]?.number else {
        throw CoreError.engine("Malformed Engine task result")
      }
      switch status {
      case 0: try await emit(.progress(nil, "Generating Take"))
      case 1:
        guard let text = item["result"]?.string else {
          throw CoreError.engine("Engine omitted result")
        }
        let result = try JSONDecoder().decode(JSONValue.self, from: Data(text.utf8))
        let primary = result.array?.first ?? result
        guard
          let rawPath = primary["file"]?.string ?? primary["path"]?.string ?? primary["audio_path"]?
            .string ?? primary["output_path"]?.string
        else { throw CoreError.engine("Engine omitted audio artifact") }
        let path: String
        if rawPath.contains("?") {
          guard
            let embedded = URLComponents(string: rawPath)?.queryItems?.first(where: {
              $0.name == "path"
            })?.value
          else { throw CoreError.engine("Malformed audio artifact path") }
          path = embedded
        } else {
          path = rawPath
        }
        let data = try await http.data(
          "/v1/audio", query: [.init(name: "path", value: path)], timeout: 180)
        try Task.checkCancellation()
        let audio = outputDirectory.appendingPathComponent("audio." + request.audioFormat)
        try data.write(to: audio, options: .atomic)
        let metadata = outputDirectory.appendingPathComponent("metadata.json")
        try JSONEncoder().encode(result).write(to: metadata, options: .atomic)
        return .init(
          artifacts: [
            .init(kind: .audio, url: audio, mediaType: "audio/" + request.audioFormat),
            .init(kind: .metadata, url: metadata, mediaType: "application/json"),
          ],
          seed: try actualSeed(primary), metadata: ["engineResult": result])
      case 2: throw CoreError.engine(item["error"]?.string ?? "ACE-Step reported task failure")
      default: throw CoreError.engine("Unknown Engine status: \(status)")
      }
      try await Task.sleep(for: .seconds(1))
    }
    throw CoreError.engine("Generation Task timed out")
  }
  private func actualSeed(_ result: JSONValue) throws -> Int64? {
    guard let value = result["seed_value"]?.string, !value.isEmpty else { return nil }
    guard let seed = Int64(value) else {
      throw CoreError.engine("Invalid actual seed in Engine result")
    }
    return seed
  }
  // This runtime has no server-side cancel endpoint. Core cancels polling/download
  // and discards late results; it never kills another client's shared runtime.
  public func cancel(taskID: String) async throws {}
  public func shutdown() async throws { try await runtime.stop() }
}
