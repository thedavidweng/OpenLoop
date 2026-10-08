import AVFoundation
import Foundation
import OpenLoopCore

public struct AudioSelection: Codable, Sendable, Equatable {
  public let start: Double
  public let end: Double
  public init(start: Double, end: Double, duration: Double) throws {
    guard start.isFinite, end.isFinite, duration.isFinite, start >= 0, end > start, end <= duration
    else { throw CoreError.invalid("Invalid audio selection") }
    self.start = start
    self.end = end
  }
  public var duration: Double { end - start }
}
public struct Waveform: Sendable, Equatable {
  public let duration: Double
  public let peaks: [Float]
  public static func read(url: URL, bins: Int = 512) throws -> Waveform {
    guard url.isFileURL, (1...16384).contains(bins) else {
      throw CoreError.invalid("Invalid waveform input")
    }
    let file = try AVAudioFile(forReading: url, commonFormat: .pcmFormatFloat32, interleaved: false)
    guard file.length > 0,
      let buffer = AVAudioPCMBuffer(pcmFormat: file.processingFormat, frameCapacity: 4096)
    else { throw CoreError.invalid("Audio contains no decodable samples") }
    var peaks = [Float](repeating: 0, count: bins)
    var offset: Int64 = 0
    while offset < file.length {
      try file.read(into: buffer)
      guard buffer.frameLength > 0, let channels = buffer.floatChannelData else {
        throw CoreError.invalid("Audio decoding made no progress")
      }
      for frame in 0..<Int(buffer.frameLength) {
        let bin = min(bins - 1, Int((offset + Int64(frame)) * Int64(bins) / file.length))
        for channel in 0..<Int(buffer.format.channelCount) {
          peaks[bin] = max(peaks[bin], abs(channels[channel][frame]))
        }
      }
      offset += Int64(buffer.frameLength)
    }
    return Waveform(duration: Double(file.length) / file.processingFormat.sampleRate, peaks: peaks)
  }
}
@MainActor
public final class TakePlayer {
  private var player: AVAudioPlayer?
  public private(set) var artifact: Artifact?
  public init() {}
  public var currentTime: Double { player?.currentTime ?? 0 }
  public var duration: Double { player?.duration ?? 0 }
  public var isPlaying: Bool { player?.isPlaying ?? false }
  public func load(_ artifact: Artifact) throws {
    guard artifact.kind == .audio, artifact.url.isFileURL, artifact.exists else {
      throw CoreError.invalid("Playable audio artifact is missing")
    }
    let next = try AVAudioPlayer(contentsOf: artifact.url)
    guard next.prepareToPlay() else {
      throw CoreError.engine("Audio playback could not be prepared")
    }
    player?.stop()
    player = next
    self.artifact = artifact
  }
  public func play() throws {
    guard let player, player.play() else { throw CoreError.engine("Audio could not start playing") }
  }
  public func pause() { player?.pause() }
  public func stop() {
    player?.stop()
    player?.currentTime = 0
  }
  public func seek(to seconds: Double) throws {
    guard let player, seconds.isFinite, seconds >= 0, seconds <= player.duration else {
      throw CoreError.invalid("Seek is outside the audio duration")
    }
    player.currentTime = seconds
  }
  public func switchTo(_ artifact: Artifact) throws {
    let time = currentTime
    let resume = isPlaying
    try load(artifact)
    try seek(to: min(time, duration))
    if resume { try play() }
  }
}
