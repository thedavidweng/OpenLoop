import Foundation

extension Persistence {
  func migrateLegacy() throws {
    try transaction {
      guard try rows("SELECT value FROM native_metadata WHERE key='schema'").isEmpty else { return }
      let tables = Set(
        try rows("SELECT name FROM sqlite_master WHERE type='table'").compactMap { $0["name"] })
      var settings = Settings()
      if tables.contains("settings") {
        for row in try rows("SELECT key,value FROM settings") {
          guard let key = row["key"], let value = row["value"] else {
            throw CoreError.persistence("Incomplete legacy Settings row")
          }
          settings.legacyValues[key] = try JSONDecoder().decode(
            JSONValue.self, from: Data(value.utf8))
        }
        let values = settings.legacyValues
        func string(_ key: String) -> String? {
          if case .string(let s) = values[key] { return s }
          return nil
        }
        func number(_ key: String) -> Double? {
          if case .number(let n) = values[key] { return n }
          if case .integer(let n) = values[key] { return Double(n) }
          return nil
        }
        if let port = number("backendPort") { settings.backendPort = Int(port) }
        if let duration = number("defaultDurationSeconds") { settings.defaultDuration = duration }
        if let format = string("defaultAudioFormat") { settings.defaultAudioFormat = format }
        settings.outputDirectory = string("outputDirectory").map { URL(fileURLWithPath: $0) }
        settings.modelDirectory = string("modelDirectory").map { URL(fileURLWithPath: $0) }
        settings.runtimeDirectory = string("backendWorkingDirectory").map {
          URL(fileURLWithPath: $0)
        }
        settings.logDirectory = string("logDirectory").map { URL(fileURLWithPath: $0) }
        settings.language = string("language")
        let mirror: String?
        if case .array(let mirrors) = values["modelMirror"], case .string(let first) = mirrors.first
        {
          mirror = first
        } else {
          mirror = string("modelMirror")
        }
        if let mirror, !mirror.isEmpty {
          guard let url = URL(string: mirror) else {
            throw CoreError.persistence("Invalid legacy model mirror")
          }
          settings.modelDownloadBaseURL = url
        }
        if case .bool(let completed) = values["firstRunCompleted"] {
          settings.firstRunCompleted = completed
        }
        let selected = string("selectedModelId") ?? string("modelVariant").map { "ace-step/" + $0 }
        if let selected { settings.selection = legacySelection(selected) }
      }
      try settings.validate()
      try save("settings", id: "shared", value: settings)
      if tables.contains("projects") {
        for row in try rows("SELECT * FROM projects") {
          guard let id = row["id"], let name = row["name"], let created = row["created_at"] else {
            throw CoreError.persistence("Incomplete legacy Project")
          }
          try save(
            "project", id: id,
            value: Project(id: id, name: name, createdAt: try legacyDate(created)))
        }
      }
      if tables.contains("generations") {
        for row in try rows("SELECT * FROM generations WHERE status='completed'") {
          guard let id = row["id"], let path = row["output_path"], let created = row["created_at"]
          else { throw CoreError.persistence("Incomplete legacy Generation Record") }
          let configuration: String
          if row["model"] == "acestep-v15-xl-turbo" {
            configuration = "ace-step/pro"
          } else if row["thinking"] == "0" && row["lm_model"] == nil {
            configuration = "ace-step/lite"
          } else {
            configuration = "ace-step/turbo"
          }
          let selection = legacySelection(configuration)
          var request = GenerationRequest(
            selection: selection, prompt: row["prompt"] ?? "", lyrics: row["lyrics"] ?? "",
            duration: try legacyNumber(row["duration_seconds"], parse: Double.init) ?? 30,
            projectID: row["project_id"],
            audioFormat: row["audio_format"] ?? "wav")
          // Preserve the original adapter settings and provenance without promoting them into core fields.
          request.bpm = try legacyNumber(row["bpm"], parse: Int.init)
          request.key = row["key_scale"]
          request.timeSignature = row["time_signature"]
          request.seed = try legacyNumber(row["seed"], parse: Int64.init)
          var options: [String: JSONValue] = [:]
          if let steps = try legacyNumber(row["inference_steps"], parse: Int64.init) {
            options["inferenceSteps"] = .integer(steps)
          }
          if let scale = try legacyNumber(row["guidance_scale"], parse: Double.init) {
            options["guidanceScale"] = .number(scale)
          }
          if let thinking = row["thinking"] { options["thinking"] = .bool(thinking == "1") }
          if let language = row["vocal_language"] { options["vocalLanguage"] = .string(language) }
          request.engineOptions = EngineOptions(values: options)
          let record = GenerationRecord(
            id: id, taskID: "legacy/" + id, createdAt: try legacyDate(created), request: request,
            artifacts: path.isEmpty
              ? []
              : [
                .init(
                  id: id + "/audio", kind: .audio, url: URL(fileURLWithPath: path),
                  mediaType: "audio/" + request.audioFormat)
              ],
            seed: try legacyNumber(row["seed"], parse: Int64.init),
            metadata: [
              "migration": .string("tauri-v1"),
              "legacyRecord": .object(row.reduce(into: [:]) { $0[$1.key] = .string($1.value) }),
            ], isFavorite: row["is_favorite"] == "1")
          try save("generation", id: id, value: record)
          try save(
            "take", id: id,
            value: Take(id: id, projectID: request.projectID, generationID: id, index: 1))
        }
      }
      // Legacy tables/files are left intact until packaged native parity; import is idempotent.
      try execute("INSERT INTO native_metadata(key,value) VALUES('schema','1')")
    }
  }
  private func legacyNumber<T>(_ value: String?, parse: (String) -> T?) throws -> T? {
    guard let value else { return nil }
    guard let number = parse(value) else {
      throw CoreError.persistence("Invalid legacy numeric value: \(value)")
    }
    return number
  }
  private func legacySelection(_ configuration: String) -> Selection {
    if configuration.hasPrefix("ace-step/") {
      return .init(
        engineID: "ace-step", runtimeID: "ace-step/uv",
        modelPackID: configuration == "ace-step/pro" ? "ace-step/xl" : "ace-step/standard",
        configurationID: configuration)
    }
    return .init(
      engineID: String(configuration.split(separator: "/").first ?? ""), runtimeID: "unbound",
      modelPackID: configuration, configurationID: configuration)
  }
  private func legacyDate(_ value: String) throws -> Date {
    let fractional = ISO8601DateFormatter()
    fractional.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
    if let date = fractional.date(from: value) ?? ISO8601DateFormatter().date(from: value) {
      return date
    }
    throw CoreError.persistence("Invalid legacy timestamp: \(value)")
  }
}
