import Foundation
import Observation
import OpenLoopAudio
import OpenLoopCore

public enum ComparisonSide: String, Sendable {
  case a = "A"
  case b = "B"
}

// Wraps TakePlayer with observable transport state, A/B switching and a loop region.
@MainActor @Observable
public final class PlaybackModel {
  public private(set) var loadedRecordID: String?
  public private(set) var loadedArtifact: Artifact?
  public private(set) var isPlaying = false
  public private(set) var currentTime: Double = 0
  public private(set) var duration: Double = 0
  public private(set) var side: ComparisonSide = .a
  public private(set) var selection: AudioSelection?
  public var loopSelection = false
  public var error: String?
  @ObservationIgnored private let player = TakePlayer()
  @ObservationIgnored private var ticker: Timer?
  @ObservationIgnored private var waveforms: [String: Waveform] = [:]

  public init() {}

  public func load(
    _ record: GenerationRecord, side: ComparisonSide = .a, keepPosition: Bool = false
  ) {
    guard let audio = record.artifacts.first(where: { $0.kind == .audio }) else {
      error = "This Take has no audio Artifact."
      return
    }
    let resume = isPlaying
    do {
      if keepPosition, loadedRecordID != nil {
        try player.switchTo(audio)
      } else {
        try player.load(audio)
        selection = nil
        if resume { try player.play() }
      }
      loadedRecordID = record.id
      loadedArtifact = audio
      self.side = side
      if player.isPlaying { startTicking() }
    } catch { self.error = error.localizedDescription }
    sync()
  }
  public func toggle(_ record: GenerationRecord?) {
    if let record, loadedRecordID != record.id {
      load(record)
      if !isPlaying { play() }
      return
    }
    isPlaying ? pause() : play()
  }
  public func play() {
    guard loadedRecordID != nil else { return }
    do {
      if loopSelection, let selection, !(selection.start..<selection.end).contains(currentTime) {
        try player.seek(to: selection.start)
      }
      try player.play()
      startTicking()
    } catch { self.error = error.localizedDescription }
    sync()
  }
  public func pause() {
    player.pause()
    stopTicking()
    sync()
  }
  public func stop() {
    player.stop()
    stopTicking()
    sync()
  }
  public func seek(to seconds: Double) {
    guard loadedRecordID != nil else { return }
    do { try player.seek(to: min(max(0, seconds), player.duration)) } catch {
      self.error = error.localizedDescription
    }
    sync()
  }
  public func skip(by seconds: Double) { seek(to: currentTime + seconds) }
  // Switches between the A and B Takes at the same playback position.
  public func compare(a: GenerationRecord, b: GenerationRecord) {
    if loadedRecordID == a.id && side == .a || loadedRecordID != b.id {
      load(b, side: .b, keepPosition: loadedRecordID != nil)
    } else {
      load(a, side: .a, keepPosition: true)
    }
  }
  public func unload(unlessIn ids: Set<String>) {
    guard let loaded = loadedRecordID, !ids.contains(loaded) else { return }
    stop()
    loadedRecordID = nil
    loadedArtifact = nil
    selection = nil
    sync()
  }
  public func select(start: Double, end: Double) {
    let lower = max(0, min(start, end))
    let upper = min(duration, max(start, end))
    selection =
      upper - lower >= 0.05
      ? try? AudioSelection(start: lower, end: upper, duration: duration) : nil
  }
  public func clearSelection() {
    selection = nil
    loopSelection = false
  }

  public func editSelection(for recordID: String) -> EditRegion? {
    guard loadedRecordID == recordID, let selection else { return nil }
    return EditRegion(start: selection.start, end: selection.end)
  }
  public func audioDuration(of record: GenerationRecord) async -> Double? {
    if loadedRecordID == record.id, duration > 0 { return duration }
    guard let audio = record.artifacts.first(where: { $0.kind == .audio }) else { return nil }
    return await waveform(for: audio)?.duration
  }

  public func waveform(for artifact: Artifact) async -> Waveform? {
    if let cached = waveforms[artifact.id] { return cached }
    let url = artifact.url
    let result = await Task.detached(priority: .userInitiated) {
      try? Waveform.read(url: url, bins: 600)
    }.value
    if let result { waveforms[artifact.id] = result }
    return result
  }

  private func startTicking() {
    stopTicking()
    let timer = Timer(timeInterval: 1.0 / 30, repeats: true) { [weak self] _ in
      MainActor.assumeIsolated { self?.tick() }
    }
    RunLoop.main.add(timer, forMode: .common)
    ticker = timer
  }
  private func stopTicking() {
    ticker?.invalidate()
    ticker = nil
  }
  private func tick() {
    if loopSelection, let selection, player.currentTime >= selection.end {
      try? player.seek(to: selection.start)
    }
    sync()
    if !player.isPlaying { stopTicking() }
  }
  private func sync() {
    isPlaying = player.isPlaying
    currentTime = player.currentTime
    duration = player.duration
  }
}
