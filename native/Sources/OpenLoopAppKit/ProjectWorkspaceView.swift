import OpenLoopCore
import SwiftUI

struct ProjectWorkspaceView: View {
  let projectID: String?
  @Environment(WorkspaceModel.self) private var model
  @Environment(PlaybackModel.self) private var playback

  var body: some View {
    @Bindable var model = model
    HSplitView {
      ComposeView()
        .frame(minWidth: 320, idealWidth: 370, maxWidth: 520)
      VStack(spacing: 0) {
        TakesList(projectID: projectID)
        Divider()
        TransportBar(comparison: true)
      }
      .frame(minWidth: 380)
    }
    .navigationTitle(model.projectName(projectID) ?? "Unfiled Takes")
    .navigationSubtitle(subtitle)
    .inspector(isPresented: $model.showsInspector) {
      TakeInspector()
        .inspectorColumnWidth(min: 260, ideal: 300, max: 420)
    }
    .toolbar {
      ToolbarItem {
        Button("Inspector", systemImage: "sidebar.trailing") { model.showsInspector.toggle() }
          .help("Show or hide the Take inspector")
      }
    }
  }
  private var subtitle: String {
    let count = model.takes(projectID: projectID).count
    return count == 1 ? "1 Take" : "\(count) Takes"
  }
}

struct TakesList: View {
  let projectID: String?
  @Environment(WorkspaceModel.self) private var model
  @Environment(PlaybackModel.self) private var playback

  var body: some View {
    let items = model.takes(projectID: projectID)
    let attempts = model.attempts(projectID: projectID)
    List(selection: Binding(get: { model.selectedTakeID }, set: { model.selectedTakeID = $0 })) {
      if !attempts.isEmpty {
        Section("Needs attention") {
          ForEach(attempts) { AttemptRow(task: $0) }
        }
      }
      Section {
        ForEach(items) { item in
          TakeRow(item: item, number: number(of: item, in: items))
            .tag(item.id)
            .contextMenu { TakeActions(item: item) }
            .onDrag { Platform.dragProvider(for: item.audio) }
        }
      } header: {
        if !items.isEmpty { Text("Takes") }
      }
    }
    .overlay {
      if items.isEmpty && attempts.isEmpty && model.activity != .generating {
        ContentUnavailableView(
          "No Takes Yet", systemImage: "waveform",
          description: Text("Describe your idea in Compose, then generate one or more Takes."))
      }
    }
    .onKeyPress(.space) {
      playback.toggle(model.item(takeID: model.selectedTakeID)?.record)
      return .handled
    }
    .onChange(of: model.selectedTakeID) { _, id in
      if let record = model.item(takeID: id)?.record, playback.loadedRecordID != record.id,
        !(model.item(takeID: id)?.isMissing ?? true)
      {
        playback.load(record)
      }
    }
  }
  // Takes are numbered oldest-first within the Project so numbers stay stable.
  private func number(of item: TakeItem, in items: [TakeItem]) -> Int {
    items.count - (items.firstIndex(of: item) ?? 0)
  }
}

struct TakeRow: View {
  let item: TakeItem
  let number: Int
  @Environment(WorkspaceModel.self) private var model
  @Environment(PlaybackModel.self) private var playback

  var body: some View {
    let isLoaded = playback.loadedRecordID == item.record.id
    HStack(spacing: 10) {
      Button {
        playback.toggle(item.record)
        model.selectedTakeID = item.id
      } label: {
        Image(systemName: isLoaded && playback.isPlaying ? "pause.circle.fill" : "play.circle.fill")
          .font(.title2)
          .symbolRenderingMode(.hierarchical)
      }
      .buttonStyle(.borderless)
      .disabled(item.isMissing)
      .accessibilityLabel(
        isLoaded && playback.isPlaying ? "Pause Take \(number)" : "Play Take \(number)")
      VStack(alignment: .leading, spacing: 3) {
        HStack(spacing: 6) {
          Text("Take \(number)").font(.headline)
          if item.take.parentTakeID != nil {
            let lineage = Lineage(item.record.request)
            Image(systemName: lineage.icon)
              .foregroundStyle(.secondary)
              .help(lineage.help)
              .accessibilityLabel(lineage.label)
          }
          if item.record.isFavorite {
            Image(systemName: "star.fill").foregroundStyle(.yellow).accessibilityLabel("Favorite")
          }
          ComparisonBadge(takeID: item.id)
        }
        Text(item.record.request.prompt)
          .lineLimit(1)
          .foregroundStyle(.secondary)
        Text(
          "\(model.configurationName(item.record.request.selection)) · \(formatTime(item.record.request.duration)) · \(item.record.createdAt.formatted(date: .abbreviated, time: .shortened))"
        )
        .font(.caption)
        .foregroundStyle(.tertiary)
      }
      Spacer(minLength: 8)
      if item.isMissing {
        Label("File missing", systemImage: "exclamationmark.triangle")
          .font(.caption)
          .foregroundStyle(.orange)
      } else if let audio = item.audio {
        WaveformView(artifact: audio, isActive: false)
          .frame(width: 140, height: 28)
          .allowsHitTesting(false)
          .accessibilityHidden(true)
      }
    }
    .padding(.vertical, 3)
    .accessibilityElement(children: .combine)
    .accessibilityAction(named: "Play or Pause") { playback.toggle(item.record) }
  }
}

private struct Lineage {
  let icon: String
  let help: String
  let label: String
  init(_ request: GenerationRequest) {
    switch request.operation {
    case .repaint: (icon, help, label) = ("paintbrush", "Repainted from another Take", "Repaint")
    case .extend:
      (icon, help, label) = ("arrow.right.to.line", "Extended from another Take", "Extension")
    default:
      (icon, help, label) = ("arrow.triangle.branch", "Variation of another Take", "Variation")
    }
  }
}

struct ComparisonBadge: View {
  let takeID: String
  @Environment(WorkspaceModel.self) private var model
  var body: some View {
    if model.comparisonTakeID == takeID {
      Text("B")
        .font(.caption2.bold())
        .padding(.horizontal, 5)
        .background(.orange.opacity(0.25), in: .capsule)
        .help("Comparison Take (B)")
        .accessibilityLabel("Comparison B")
    }
  }
}

struct AttemptRow: View {
  let task: GenerationTask
  @Environment(WorkspaceModel.self) private var model

  var body: some View {
    HStack(alignment: .top, spacing: 10) {
      Image(systemName: task.state == .cancelled ? "stop.circle" : "exclamationmark.triangle.fill")
        .foregroundStyle(task.state == .cancelled ? Color.secondary : Color.orange)
        .font(.title3)
      VStack(alignment: .leading, spacing: 3) {
        Text(task.state == .cancelled ? "Cancelled" : "Generation failed").font(.headline)
        Text(task.request.prompt).lineLimit(1).foregroundStyle(.secondary)
        if let error = task.error {
          Text(error).font(.caption).foregroundStyle(.secondary).lineLimit(3).textSelection(
            .enabled)
        }
        HStack {
          Button("Retry") { Task { await model.retry(taskID: task.id) } }
            .disabled(model.activity != .idle || model.runningElsewhere)
          Button("Edit in Compose") { model.openTaskInCompose(taskID: task.id) }
          Button("Dismiss") { model.dismiss(taskID: task.id) }
        }
        .controlSize(.small)
        .padding(.top, 2)
      }
    }
    .padding(.vertical, 4)
    .selectionDisabled()
    .accessibilityElement(children: .contain)
  }
}

// Repaint and Extend appear only when the Take's Engine supports them.
struct RegionEditActions: View {
  let item: TakeItem
  var showsIcons = false
  @Environment(WorkspaceModel.self) private var model
  @Environment(PlaybackModel.self) private var playback

  var body: some View {
    if model.canEdit(item, .repaint) {
      let selection = playback.editSelection(for: item.record.id)
      button("Repaint Selection", icon: "paintbrush") {
        await model.edit(
          takeID: item.id, .repaint, sourceDuration: playback.duration, selection: selection)
      }
      .disabled(selection == nil || item.isMissing || model.activity == .generating)
      .help(
        selection == nil
          ? "Play this Take, then drag across the waveform to choose the part to repaint"
          : "Regenerate only the selected part of this Take")
    }
    if model.canEdit(item, .extend) {
      button("Extend", icon: "arrow.right.to.line") {
        guard let duration = await playback.audioDuration(of: item.record) else {
          model.error = "The Take’s audio could not be read."
          return
        }
        await model.edit(takeID: item.id, .extend, sourceDuration: duration)
      }
      .disabled(item.isMissing || model.activity == .generating)
      .help("Continue this Take with new music after its end")
    }
  }
  @ViewBuilder private func button(
    _ title: String, icon: String, action: @escaping @MainActor () async -> Void
  ) -> some View {
    if showsIcons {
      Button(title, systemImage: icon) { Task { await action() } }
    } else {
      Button(title) { Task { await action() } }
    }
  }
}

// Shared actions for Take rows, the inspector, and History.
struct TakeActions: View {
  let item: TakeItem
  @Environment(WorkspaceModel.self) private var model
  @Environment(PlaybackModel.self) private var playback

  var body: some View {
    Button(playback.loadedRecordID == item.record.id && playback.isPlaying ? "Pause" : "Play") {
      playback.toggle(item.record)
    }
    .disabled(item.isMissing)
    if model.selectedTakeID != item.id && model.sidebar != .history {
      Button("Compare with Selected Take") { model.comparisonTakeID = item.id }
    }
    Divider()
    Button("Reproduce Exactly") { Task { await model.iterate(takeID: item.id, reproduce: true) } }
      .disabled(!model.canReproduce(item.record) || model.activity == .generating)
    Button("New Variation") { Task { await model.iterate(takeID: item.id, reproduce: false) } }
      .disabled(model.activity == .generating)
    RegionEditActions(item: item)
    Divider()
    Button(item.record.isFavorite ? "Remove from Favorites" : "Add to Favorites") {
      Task { await model.setFavorite(id: item.record.id, favorite: !item.record.isFavorite) }
    }
    if let audio = item.audio {
      Button("Show in Finder") { Platform.reveal(audio) }.disabled(item.isMissing)
      Button("Export…") { Task { await Platform.export(audio, record: item.record, model: model) } }
        .disabled(item.isMissing)
    }
    Divider()
    Button("Delete Take…", role: .destructive) { model.pendingDeletion = [item.record.id] }
  }
}

struct TransportBar: View {
  let comparison: Bool
  @Environment(WorkspaceModel.self) private var model
  @Environment(PlaybackModel.self) private var playback

  var body: some View {
    @Bindable var playback = playback
    let a = model.item(takeID: model.selectedTakeID)
    let b = model.item(takeID: model.comparisonTakeID)
    HStack(spacing: 12) {
      Button(
        playback.isPlaying ? "Pause" : "Play",
        systemImage: playback.isPlaying ? "pause.fill" : "play.fill"
      ) {
        playback.toggle(playback.loadedRecordID == nil ? a?.record : nil)
      }
      .labelStyle(.iconOnly)
      .font(.title2)
      .buttonStyle(.borderless)
      .disabled(playback.loadedRecordID == nil && (a == nil || a?.isMissing == true))
      Text("\(formatTime(playback.currentTime)) / \(formatTime(playback.duration))")
        .monospacedDigit()
        .font(.callout)
        .foregroundStyle(.secondary)
        .accessibilityLabel("Position")
      if let artifact = playback.loadedArtifact {
        WaveformView(artifact: artifact, isActive: true)
          .frame(height: 44)
      } else {
        Text("Select a Take to listen")
          .foregroundStyle(.secondary)
          .frame(maxWidth: .infinity)
      }
      if playback.selection != nil {
        Toggle("Loop Selection", systemImage: "repeat", isOn: $playback.loopSelection)
          .toggleStyle(.button)
          .labelStyle(.iconOnly)
          .help("Loop the selected region (⌘L)")
        Button("Clear Selection", systemImage: "xmark") { playback.clearSelection() }
          .labelStyle(.iconOnly)
          .buttonStyle(.borderless)
      }
      if comparison {
        Divider().frame(height: 28)
        if let a, let b, !a.isMissing, !b.isMissing {
          Picker(
            "A/B",
            selection: Binding(
              get: { playback.loadedRecordID == b.record.id ? ComparisonSide.b : .a },
              set: { side in
                if side == .b, playback.loadedRecordID != b.record.id {
                  playback.compare(a: a.record, b: b.record)
                } else if side == .a, playback.loadedRecordID != a.record.id {
                  playback.compare(a: a.record, b: b.record)
                }
              })
          ) {
            Text("A").tag(ComparisonSide.a)
            Text("B").tag(ComparisonSide.b)
          }
          .pickerStyle(.segmented)
          .labelsHidden()
          .frame(width: 80)
          .help(
            "Switch between the selected Take (A) and comparison Take (B) at the same position (⇧⌘B)"
          )
          Button("Stop Comparing", systemImage: "xmark.circle") { model.comparisonTakeID = nil }
            .labelStyle(.iconOnly)
            .buttonStyle(.borderless)
        } else {
          Text("A/B: choose “Compare with Selected Take”")
            .font(.caption)
            .foregroundStyle(.tertiary)
            .lineLimit(2)
            .frame(maxWidth: 150)
        }
      }
    }
    .padding(.horizontal, 14)
    .padding(.vertical, 10)
    .background(.bar)
  }
}
