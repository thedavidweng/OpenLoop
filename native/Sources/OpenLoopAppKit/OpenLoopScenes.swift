import AppKit
import OpenLoopCore
import SwiftUI

public struct OpenLoopScenes: Scene {
  let model: WorkspaceModel
  let playback: PlaybackModel
  let delegate: OpenLoopAppDelegate

  public init(model: WorkspaceModel, playback: PlaybackModel, delegate: OpenLoopAppDelegate) {
    self.model = model
    self.playback = playback
    self.delegate = delegate
  }

  public var body: some Scene {
    Window("OpenLoop", id: "main") {
      RootView()
        .environment(model)
        .environment(playback)
        // Must cover the sidebar, Compose, Takes and inspector minimum widths;
        // a smaller window makes the split view overflow and clip both edges.
        .frame(minWidth: 1160, minHeight: 600)
        .task {
          delegate.model = model
          model.onTakeCompleted = { Notifications.takeCompleted($0) }
          Notifications.requestAuthorization()
          let environment = ProcessInfo.processInfo.environment
          await model.connect(
            directory: environment["OPENLOOP_DATA_DIR"].map { URL(fileURLWithPath: $0) }
              ?? OpenLoopCore.defaultDirectory,
            bundledUV: environment["OPENLOOP_UV"].map { URL(fileURLWithPath: $0) })
        }
    }
    .defaultSize(width: 1240, height: 780)
    .commands { OpenLoopCommands(model: model, playback: playback) }

    SwiftUI.Settings {
      SettingsView()
        .environment(model)
        .environment(playback)
    }
  }
}

struct RootView: View {
  @Environment(WorkspaceModel.self) private var model
  @Environment(PlaybackModel.self) private var playback

  var body: some View {
    @Bindable var model = model
    Group {
      if let failure = model.connectionError {
        ContentUnavailableView {
          Label("OpenLoop could not open its library", systemImage: "exclamationmark.triangle")
        } description: {
          Text(failure)
        } actions: {
          Button("Try Again") { Task { await model.connect() } }
        }
      } else if !model.isConnected {
        ProgressView("Opening library…")
      } else {
        NavigationSplitView {
          SidebarView()
            .navigationSplitViewColumnWidth(min: 180, ideal: 220, max: 320)
        } detail: {
          switch model.sidebar {
          case .history: HistoryView()
          case .unfiled: ProjectWorkspaceView(projectID: nil)
          case .project(let id): ProjectWorkspaceView(projectID: id).id(id)
          case nil:
            ContentUnavailableView(
              "Choose a Project", systemImage: "music.note.list",
              description: Text("Select a Project or History in the sidebar."))
          }
        }
      }
    }
    .sheet(item: $model.setupConfigurationID.identified) { item in
      SetupSheet(configurationID: item.id)
    }
    .alert(
      "New Project", isPresented: $model.isCreatingProject,
      actions: { NewProjectPrompt() },
      message: { Text("Name the musical idea this Project collects.") }
    )
    .confirmationDialog(
      deletionTitle, isPresented: $model.pendingDeletion.isPresent, titleVisibility: .visible
    ) {
      Button("Delete", role: .destructive) {
        if let ids = model.pendingDeletion {
          playback.unload(unlessIn: Set(model.history.map(\.id)).subtracting(ids))
          Task { await model.deleteGenerations(ids: ids) }
        }
      }
    } message: {
      Text(
        "This deletes the records and their local audio and Artifact files. This cannot be undone.")
    }
    .errorAlert()
    .overlay(alignment: .bottom) { NoticeBanner() }
    .onReceive(NotificationCenter.default.publisher(for: NSApplication.didBecomeActiveNotification))
    {
      _ in Task { await model.refreshQuietly() }
    }
    .task {
      // Another process (CLI or GUI) may change the shared library at any time.
      while !Task.isCancelled {
        try? await Task.sleep(for: .seconds(8))
        await model.refreshQuietly()
      }
    }
    .onChange(of: model.history.map(\.id)) { _, ids in playback.unload(unlessIn: Set(ids)) }
  }

  private var deletionTitle: String {
    let count = model.pendingDeletion?.count ?? 0
    return count == 1 ? "Delete this Take?" : "Delete \(count) Takes?"
  }
}

private struct NewProjectPrompt: View {
  @Environment(WorkspaceModel.self) private var model
  @State private var name = ""
  var body: some View {
    TextField("Project name", text: $name)
    Button("Create") {
      let value = name.trimmingCharacters(in: .whitespacesAndNewlines)
      name = ""
      if !value.isEmpty { Task { await model.createProject(name: value) } }
    }
    .keyboardShortcut(.defaultAction)
    Button("Cancel", role: .cancel) { name = "" }
  }
}

struct NoticeBanner: View {
  @Environment(WorkspaceModel.self) private var model
  var body: some View {
    if let notice = model.notice {
      HStack(spacing: 10) {
        Image(systemName: "info.circle")
        Text(notice).fixedSize(horizontal: false, vertical: true)
        Button("Dismiss", systemImage: "xmark") { model.notice = nil }
          .labelStyle(.iconOnly)
          .buttonStyle(.borderless)
      }
      .padding(.horizontal, 14)
      .padding(.vertical, 9)
      .background(.regularMaterial, in: .rect(cornerRadius: 10))
      .shadow(radius: 4, y: 1)
      .padding(.bottom, 64)
      .frame(maxWidth: 560)
      .transition(.move(edge: .bottom).combined(with: .opacity))
      .task(id: notice) {
        try? await Task.sleep(for: .seconds(8))
        if model.notice == notice { model.notice = nil }
      }
      .accessibilityElement(children: .combine)
      .accessibilityAddTraits(.isStaticText)
    }
  }
}

// Shows Core/playback errors in whichever OpenLoop window is key.
private struct ErrorAlert: ViewModifier {
  @Environment(WorkspaceModel.self) private var model
  @Environment(PlaybackModel.self) private var playback
  @Environment(\.controlActiveState) private var activeState
  func body(content: Content) -> some View {
    let message = model.error ?? playback.error
    content.alert(
      "Something went wrong",
      isPresented: Binding(
        get: { message != nil && activeState == .key },
        set: {
          if !$0 {
            model.error = nil
            playback.error = nil
          }
        })
    ) {
      Button("OK", role: .cancel) {}
    } message: {
      Text(message ?? "")
    }
  }
}
extension View {
  func errorAlert() -> some View { modifier(ErrorAlert()) }
}

struct IdentifiedString: Identifiable {
  let id: String
}
// Exposed through Binding's dynamic member lookup, e.g. `$model.pendingDeletion.isPresent`.
extension Optional {
  var isPresent: Bool {
    get { self != nil }
    set { if !newValue { self = nil } }
  }
}
extension Optional where Wrapped == String {
  var identified: IdentifiedString? {
    get { map(IdentifiedString.init) }
    set { self = newValue?.id }
  }
}
