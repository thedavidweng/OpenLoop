import SwiftUI

@main
struct OpenLoopApp: App {
  @State private var workspace = WorkspaceModel()
  var body: some Scene {
    WindowGroup("OpenLoop") {
      // Deliberately blank: the native creative-workflow UI is the next handoff.
      EmptyView()
        .environment(workspace)
        .task { await workspace.connect() }
    }
  }
}
