import OpenLoopAppKit
import SwiftUI

@main
struct OpenLoopApp: App {
  @NSApplicationDelegateAdaptor(OpenLoopAppDelegate.self) private var delegate
  @State private var workspace = WorkspaceModel()
  @State private var playback = PlaybackModel()

  var body: some Scene {
    OpenLoopScenes(model: workspace, playback: playback, delegate: delegate)
  }
}
