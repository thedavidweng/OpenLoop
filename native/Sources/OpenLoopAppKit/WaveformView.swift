import OpenLoopAudio
import OpenLoopCore
import SwiftUI

// Click to seek, drag to select a region. Arrow keys seek when focused (VoiceOver: adjustable).
struct WaveformView: View {
  let artifact: Artifact
  let isActive: Bool
  @Environment(PlaybackModel.self) private var playback
  @State private var waveform: Waveform?
  @State private var failed = false
  @State private var dragStart: Double?

  var body: some View {
    GeometryReader { geometry in
      let width = max(geometry.size.width, 1)
      let duration =
        isActive && playback.duration > 0 ? playback.duration : (waveform?.duration ?? 0)
      ZStack(alignment: .leading) {
        Canvas { context, size in
          guard let peaks = waveform?.peaks, !peaks.isEmpty else { return }
          let step = size.width / CGFloat(peaks.count)
          let mid = size.height / 2
          var path = Path()
          for (index, peak) in peaks.enumerated() {
            let height = max(1, CGFloat(peak) * size.height * 0.95)
            path.addRect(
              CGRect(
                x: CGFloat(index) * step, y: mid - height / 2, width: max(step - 0.5, 0.5),
                height: height))
          }
          context.fill(path, with: .color(isActive ? .accentColor : .secondary))
        }
        if isActive, let selection = playback.selection, duration > 0 {
          Rectangle()
            .fill(Color.accentColor.opacity(0.18))
            .frame(width: CGFloat((selection.end - selection.start) / duration) * width)
            .offset(x: CGFloat(selection.start / duration) * width)
        }
        if isActive, duration > 0 {
          Rectangle()
            .fill(Color.primary)
            .frame(width: 1.5)
            .offset(x: CGFloat(playback.currentTime / duration) * width)
        }
        if waveform == nil {
          Text(failed ? "Waveform unavailable" : "Reading audio…")
            .font(.caption)
            .foregroundStyle(.secondary)
            .frame(maxWidth: .infinity)
        }
      }
      .contentShape(Rectangle())
      .gesture(
        DragGesture(minimumDistance: 0)
          .onChanged { value in
            guard isActive, duration > 0 else { return }
            let start = time(at: value.startLocation.x, width: width, duration: duration)
            let current = time(at: value.location.x, width: width, duration: duration)
            if abs(value.translation.width) > 3 {
              dragStart = start
              playback.select(start: start, end: current)
            }
          }
          .onEnded { value in
            guard isActive, duration > 0 else { return }
            if dragStart == nil {
              playback.clearSelection()
              playback.seek(to: time(at: value.location.x, width: width, duration: duration))
            }
            dragStart = nil
          })
    }
    .task(id: artifact.id) {
      waveform = await playback.waveform(for: artifact)
      failed = waveform == nil
    }
    .accessibilityElement()
    .accessibilityLabel("Waveform")
    .accessibilityValue(
      isActive
        ? "\(formatTime(playback.currentTime)) of \(formatTime(playback.duration))" : "Not loaded"
    )
    .accessibilityAdjustableAction { direction in
      guard isActive else { return }
      playback.skip(by: direction == .increment ? 5 : -5)
    }
  }
  private func time(at x: CGFloat, width: CGFloat, duration: Double) -> Double {
    Double(min(max(0, x / width), 1)) * duration
  }
}

func formatTime(_ seconds: Double) -> String {
  guard seconds.isFinite else { return "0:00" }
  let total = Int(seconds.rounded(.down))
  return String(format: "%d:%02d", total / 60, total % 60)
}
