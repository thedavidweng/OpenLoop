import AVFoundation
import Foundation
import OpenLoopAudio
import OpenLoopCore
import Testing

@Test func waveformDecodesStereoPeaksWithoutAudioHardware() throws {
  let root = try temporaryDirectory()
  defer { try? FileManager.default.removeItem(at: root) }
  let url = root.appendingPathComponent("fixture.wav")
  let format = try #require(AVAudioFormat(standardFormatWithSampleRate: 8000, channels: 2))
  let buffer = try #require(AVAudioPCMBuffer(pcmFormat: format, frameCapacity: 8))
  buffer.frameLength = 8
  let channels = try #require(buffer.floatChannelData)
  let left: [Float] = [0, 0.25, -0.5, 0.25, 0.75, 0.25, 0, 0]
  let right: [Float] = [0, 0.5, 0, 0, 0, 0, -1, 0]
  for i in 0..<8 {
    channels[0][i] = left[i]
    channels[1][i] = right[i]
  }
  do {
    let file = try AVAudioFile(forWriting: url, settings: format.settings)
    try file.write(from: buffer)
  }
  let waveform = try Waveform.read(url: url, bins: 4)
  #expect(waveform.peaks == [0.5, 0.5, 0.75, 1])
  #expect(waveform.duration == 0.001)
  #expect(throws: CoreError.self) { try AudioSelection(start: 10, end: 20, duration: 15) }
  #expect(try AudioSelection(start: 2, end: 5, duration: 10).duration == 3)
}
