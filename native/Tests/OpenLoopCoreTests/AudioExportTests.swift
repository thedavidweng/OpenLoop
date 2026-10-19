import AVFoundation
import Foundation
import OpenLoopCLIKit
import OpenLoopCore
import OpenLoopEngines
import Testing

let testAudioEncoder = URL(fileURLWithPath: #filePath)
  .deletingLastPathComponent().deletingLastPathComponent().deletingLastPathComponent()
  .appendingPathComponent("binaries/audio-encoder/ffmpeg")

func writeExportAudio(_ url: URL) throws {
  let format = try #require(AVAudioFormat(standardFormatWithSampleRate: 44100, channels: 2))
  let buffer = try #require(AVAudioPCMBuffer(pcmFormat: format, frameCapacity: 4410))
  buffer.frameLength = 4410
  let samples = try #require(buffer.floatChannelData)
  for channel in 0..<2 {
    for frame in 0..<4410 {
      samples[channel][frame] = Float(sin(Double(frame) * 2 * .pi * 440 / 44100) * 0.2)
    }
  }
  let file = try AVAudioFile(forWriting: url, settings: format.settings)
  try file.write(from: buffer)
}

struct ExportAudioEngine: Engine {
  let id = "test"
  func capabilities(for selection: Selection) throws -> Capabilities {
    .init([.lyrics], maximumDuration: 60)
  }
  func generate(
    _ request: GenerationRequest, taskID: String, outputDirectory: URL, emit: EngineEventSink
  ) async throws -> EngineResult {
    let audio = outputDirectory.appendingPathComponent("source.wav")
    try writeExportAudio(audio)
    return .init(
      artifacts: [.init(kind: .audio, url: audio, mediaType: "audio/wav")],
      metadata: [
        "title": .string("Export Title"), "artist": .string("Export Artist"),
        "genre": .string("Ambient"),
      ])
  }
  func cancel(taskID: String) async throws {}
  func shutdown() async throws {}
}

@Test func exportPresetsValidateFormatAndPreserveGenerationMetadata() throws {
  #expect(try AudioExportPreset.select(format: "mp3", preset: "podcast") == .podcast)
  #expect(try AudioExportPreset.select(format: "flac", preset: nil) == .lossless)
  for pair in [("wav", nil), ("mp3", "lossless"), ("ogg", "unknown")] as [(String, String?)] {
    #expect(throws: CoreError.self) { try AudioExportPreset.select(format: pair.0, preset: pair.1) }
  }
}

@Test(arguments: AudioExportPreset.allCases)
func generatedAudioExportsLocallyWithTagsAndNeverRewritesHistory(preset: AudioExportPreset)
  async throws
{
  let root = try temporaryDirectory()
  defer { try? FileManager.default.removeItem(at: root) }
  let core = try OpenLoopCore(
    directory: root, engines: [ExportAudioEngine()], audioEncoder: testAudioEncoder)
  let task = try await core.submit(
    .init(selection: testSelection, prompt: "ambient piano", lyrics: "Test Lyrics"))
  for try await _ in try await core.run(taskID: task.id) {}
  let record = try #require(try await core.workspace().history.first)
  let audio = try #require(record.artifacts.first)
  let original = try Data(contentsOf: audio.url)
  let output = root.appendingPathComponent("export.\(preset.format)")
  try Data("old export".utf8).write(to: output)
  await #expect(throws: CoreError.self) {
    try await core.exportArtifact(
      generationID: record.id, artifactID: audio.id, destination: output, preset: preset)
  }
  try await core.exportArtifact(
    generationID: record.id, artifactID: audio.id, destination: output, preset: preset,
    replaceExisting: true)
  let exported = try Data(contentsOf: output)
  #expect(exported.count > 100)
  for value in ["Export Title", "Export Artist", "Ambient", "Test Lyrics", "ambient piano"] {
    #expect(exported.range(of: Data(value.utf8)) != nil)
  }
  #expect(try Data(contentsOf: audio.url) == original)
  #expect(try await core.workspace().history == [record])
  let raw = root.appendingPathComponent("original.wav")
  try Data("previous export".utf8).write(to: raw)
  await #expect(throws: (any Error).self) {
    try await core.exportArtifact(
      generationID: record.id, artifactID: audio.id, destination: raw)
  }
  try await core.exportArtifact(
    generationID: record.id, artifactID: audio.id, destination: raw, replaceExisting: true)
  #expect(try Data(contentsOf: raw) == original)
  await #expect(throws: CoreError.self) {
    try await core.exportArtifact(
      generationID: record.id, artifactID: audio.id, destination: audio.url, preset: preset,
      replaceExisting: true)
  }
}

@Test func filesConvertCLISelectsFormatsAndFindsGenerationMetadata() async throws {
  let root = try temporaryDirectory()
  defer { try? FileManager.default.removeItem(at: root) }
  let core = try OpenLoopCore(
    directory: root, engines: [ExportAudioEngine()], audioEncoder: testAudioEncoder)
  let task = try await core.submit(
    .init(selection: testSelection, prompt: "tagged audio", lyrics: "CLI Lyrics"))
  for try await _ in try await core.run(taskID: task.id) {}
  let record = try #require(try await core.workspace().history.first)
  var untagged = record
  untagged.metadata = [:]
  untagged.request.prompt = "one two three four five six seven"
  #expect(
    untagged.exportMetadata == [
      "title": "one two three four five six", "artist": "OpenLoop",
      "genre": untagged.request.prompt, "comment": untagged.request.prompt, "lyrics": "CLI Lyrics",
    ])
  let source = try #require(record.artifacts.first?.url)
  let cli = OpenLoopCLI(
    environment: OpenLoopEnvironment(
      core: core, catalog: .firstParty,
      runtime: AceRuntime(directory: root, bundledUV: root, settingsProvider: { Settings() })))
  for format in ["mp3", "flac", "ogg"] {
    let log = EventLog()
    try await cli.execute(arguments: ["files", "convert", source.path, "--format", format]) {
      await log.append($0)
    }
    let output = source.deletingPathExtension().appendingPathExtension(format)
    let event = try #require(await log.events.first)
    #expect(event.v == 2 && event.kind == "result" && event.data == .string(output.path))
    #expect(try Data(contentsOf: output).range(of: Data("Export Artist".utf8)) != nil)
  }
  for options in [
    [], ["--format", "wav"], ["--format", "mp3", "--preset", "lossless"],
    ["--format", "ogg", "--unknown"], ["--format", "flac", "--output"],
  ] {
    await #expect(throws: CoreError.self) {
      try await cli.execute(arguments: ["files", "convert", source.path] + options) { _ in }
    }
  }
  #expect(try await core.workspace().history == [record])
}

@Test func conversionFailureKeepsExistingDestinationAndReportsMissingEncoder() async throws {
  let root = try temporaryDirectory()
  defer { try? FileManager.default.removeItem(at: root) }
  let source = root.appendingPathComponent("bad.wav")
  try Data("not audio".utf8).write(to: source)
  let destination = root.appendingPathComponent("keep.mp3")
  let old = Data("keep this export".utf8)
  try old.write(to: destination)
  await #expect(throws: CoreError.self) {
    try await AudioConverter(executable: testAudioEncoder).convert(
      input: source, destination: destination, preset: .mp3, metadata: [:], replaceExisting: true)
  }
  #expect(try Data(contentsOf: destination) == old)
  await #expect(throws: CoreError.self) {
    try await AudioConverter(executable: root.appendingPathComponent("missing-encoder")).convert(
      input: source, destination: destination, preset: .mp3, metadata: [:], replaceExisting: true)
  }
  #expect(try Data(contentsOf: destination) == old)
  #expect(
    try FileManager.default.contentsOfDirectory(atPath: root.path).sorted() == [
      "bad.wav", "keep.mp3",
    ])
}

@Test func cancelledConversionStopsTheEncoderAndRemovesItsStagedOutput() async throws {
  let root = try temporaryDirectory()
  defer { try? FileManager.default.removeItem(at: root) }
  let source = root.appendingPathComponent("source.wav")
  try writeExportAudio(source)
  let encoder = root.appendingPathComponent("slow-encoder")
  let started = root.appendingPathComponent("started")
  try Data("#!/bin/sh\ntouch '\(started.path)'\nexec /bin/sleep 30\n".utf8).write(to: encoder)
  try FileManager.default.setAttributes([.posixPermissions: 0o755], ofItemAtPath: encoder.path)
  let destination = root.appendingPathComponent("cancel.mp3")
  let task = Task {
    try await AudioConverter(executable: encoder).convert(
      input: source, destination: destination, preset: .mp3, metadata: [:])
  }
  for _ in 0..<200 where !FileManager.default.fileExists(atPath: started.path) {
    try await Task.sleep(for: .milliseconds(10))
  }
  #expect(FileManager.default.fileExists(atPath: started.path))
  task.cancel()
  await #expect(throws: CancellationError.self) { try await task.value }
  #expect(!FileManager.default.fileExists(atPath: destination.path))
  #expect(
    try FileManager.default.contentsOfDirectory(atPath: root.path).allSatisfy {
      !$0.hasPrefix(".openloop-export-")
    })
}
