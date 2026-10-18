import Foundation

public enum AudioExportPreset: String, CaseIterable, Codable, Sendable {
  case mp3, podcast, lossless, ogg

  public var title: String {
    switch self {
    case .mp3: "MP3 (192 kb/s)"
    case .podcast: "Podcast quality (MP3, mono, 96 kb/s)"
    case .lossless: "Lossless archive (FLAC)"
    case .ogg: "Ogg Vorbis (quality 5)"
    }
  }
  public var format: String {
    switch self {
    case .mp3, .podcast: "mp3"
    case .lossless: "flac"
    case .ogg: "ogg"
    }
  }
  var arguments: [String] {
    switch self {
    case .mp3: ["-c:a", "libmp3lame", "-b:a", "192k"]
    case .podcast: ["-c:a", "libmp3lame", "-b:a", "96k", "-ac", "1", "-ar", "44100"]
    case .lossless: ["-c:a", "flac"]
    case .ogg: ["-c:a", "libvorbis", "-q:a", "5"]
    }
  }
  public static func select(format: String, preset: String?) throws -> Self {
    let value: Self
    if let preset {
      guard let selected = Self(rawValue: preset) else {
        throw CoreError.invalid("Unknown export preset: \(preset)")
      }
      value = selected
    } else {
      switch format {
      case "mp3": value = .mp3
      case "flac": value = .lossless
      case "ogg": value = .ogg
      default: throw CoreError.invalid("Export format must be mp3, flac, or ogg")
      }
    }
    guard value.format == format else {
      throw CoreError.invalid("Export preset does not match --format")
    }
    return value
  }
}

public struct AudioConverter: Sendable {
  public static var bundledExecutable: URL {
    Bundle.main.executableURL!.resolvingSymlinksInPath().deletingLastPathComponent()
      .appendingPathComponent("ffmpeg")
  }
  public let executable: URL
  public init(executable: URL) { self.executable = executable }

  public func convert(
    input: URL, destination: URL, preset: AudioExportPreset, metadata: [String: String],
    replaceExisting: Bool = false
  ) async throws {
    guard input.isFileURL, destination.isFileURL,
      FileManager.default.fileExists(atPath: input.path),
      input.resolvingSymlinksInPath() != destination.resolvingSymlinksInPath(),
      destination.pathExtension.lowercased() == preset.format
    else { throw CoreError.invalid("Invalid local input, export destination, or file extension") }
    guard replaceExisting || !FileManager.default.fileExists(atPath: destination.path) else {
      throw CoreError.conflict("Export destination already exists")
    }
    guard executable.isFileURL, FileManager.default.isExecutableFile(atPath: executable.path) else {
      throw CoreError.notFound(
        "Bundled audio encoder is missing. Prepare the pinned audio sidecar.")
    }
    let temporary = destination.deletingLastPathComponent()
      .appendingPathComponent(".openloop-export-\(UUID().uuidString)")
    try FileManager.default.createDirectory(at: temporary, withIntermediateDirectories: false)
    defer { try? FileManager.default.removeItem(at: temporary) }
    let output = temporary.appendingPathComponent("audio.\(preset.format)")
    let diagnostic = temporary.appendingPathComponent("encoder.log")
    try Data().write(to: diagnostic)
    let log = try FileHandle(forWritingTo: diagnostic)
    defer { try? log.close() }
    let process = Process()
    process.executableURL = executable
    process.arguments =
      [
        "-nostdin", "-hide_banner", "-loglevel", "error", "-threads", "1",
        "-protocol_whitelist", "file", "-i", input.path, "-map", "0:a:0", "-vn",
        "-map_metadata", "-1",
      ] + preset.arguments
      + metadata.keys.sorted().flatMap { ["-metadata", "\($0)=\(metadata[$0]!)"] }
      + ["-threads", "1", "-n", output.path]
    process.standardInput = FileHandle.nullDevice
    process.standardOutput = FileHandle.nullDevice
    process.standardError = log
    try Task.checkCancellation()
    try process.run()
    do {
      while process.isRunning { try await Task.sleep(for: .milliseconds(50)) }
      try Task.checkCancellation()
    } catch {
      if process.isRunning { process.terminate() }
      process.waitUntilExit()
      throw error
    }
    guard process.terminationStatus == 0 else {
      let message = String(decoding: try Data(contentsOf: diagnostic), as: UTF8.self)
      throw CoreError.engine("Local audio conversion failed: \(message)")
    }
    // Publish only a completed conversion; an encoder failure never deletes the user's old export.
    if replaceExisting && FileManager.default.fileExists(atPath: destination.path) {
      _ = try FileManager.default.replaceItemAt(destination, withItemAt: output)
    } else {
      try FileManager.default.moveItem(at: output, to: destination)
    }
  }
}

extension GenerationRecord {
  public var exportMetadata: [String: String] {
    var tags = [
      "title": request.prompt.split(whereSeparator: \.isWhitespace).prefix(6).joined(
        separator: " "),
      "artist": "OpenLoop", "genre": request.prompt, "comment": request.prompt,
      "lyrics": request.lyrics,
    ]
    for key in ["title", "artist", "genre"] {
      if case .string(let value) = metadata[key] { tags[key] = value }
    }
    return tags
  }
}
