import OpenLoopCore
import SwiftUI

// Cross-project view of completed Generation Records only; failed/cancelled tasks never appear.
struct HistoryView: View {
  @Environment(WorkspaceModel.self) private var model
  @Environment(PlaybackModel.self) private var playback
  @State private var search = ""
  @State private var favoritesOnly = false
  @State private var sortOrder = [KeyPathComparator(\GenerationRecord.createdAt, order: .reverse)]

  var body: some View {
    @Bindable var model = model
    VStack(spacing: 0) {
      Table(rows, selection: $model.historySelection, sortOrder: $sortOrder) {
        TableColumn("") { record in
          Image(systemName: record.isFavorite ? "star.fill" : "star")
            .foregroundStyle(record.isFavorite ? .yellow : .secondary)
            .onTapGesture {
              Task { await model.setFavorite(id: record.id, favorite: !record.isFavorite) }
            }
            .accessibilityLabel(record.isFavorite ? "Favorite" : "Not favorite")
            .accessibilityAddTraits(.isButton)
        }
        .width(22)
        TableColumn("Prompt", value: \.request.prompt) { record in
          HStack(spacing: 6) {
            if playback.loadedRecordID == record.id && playback.isPlaying {
              Image(systemName: "speaker.wave.2.fill").foregroundStyle(.tint).accessibilityLabel(
                "Playing")
            }
            Text(record.request.prompt).lineLimit(1)
            if !(record.artifacts.first { $0.kind == .audio }?.exists ?? false) {
              Label("File missing", systemImage: "exclamationmark.triangle")
                .labelStyle(.iconOnly)
                .foregroundStyle(.orange)
                .help("The audio file is missing. Delete this record to clear it.")
            }
          }
          .onDrag { Platform.dragProvider(for: record.artifacts.first { $0.kind == .audio }) }
        }
        .width(min: 160, ideal: 360)
        TableColumn("Project") { record in
          Text(model.projectName(record.request.projectID) ?? "—").foregroundStyle(.secondary)
        }
        .width(min: 80, ideal: 130)
        TableColumn("Model") { record in
          Text(model.configurationName(record.request.selection)).foregroundStyle(.secondary)
        }
        .width(min: 80, ideal: 140)
        TableColumn("Length", value: \.request.duration) { record in
          Text(formatTime(record.request.duration)).monospacedDigit()
        }
        .width(55)
        TableColumn("Created", value: \.createdAt) { record in
          Text(record.createdAt.formatted(date: .abbreviated, time: .shortened))
        }
        .width(min: 110, ideal: 140)
      }
      .contextMenu(forSelectionType: String.self) { ids in
        HistoryActions(ids: ids)
      } primaryAction: { ids in
        if let id = ids.first, let record = model.record(id: id) { playback.toggle(record) }
      }
      .onKeyPress(.space) {
        if let id = model.historySelection.first, let record = model.record(id: id) {
          playback.toggle(record)
        }
        return .handled
      }
      .overlay {
        if model.history.isEmpty {
          ContentUnavailableView(
            "No History", systemImage: "clock",
            description: Text("Completed Takes from every Project appear here."))
        } else if rows.isEmpty {
          ContentUnavailableView.search(text: search)
        }
      }
      Divider()
      TransportBar(comparison: false)
    }
    .navigationTitle("History")
    .navigationSubtitle(model.history.count == 1 ? "1 Take" : "\(model.history.count) Takes")
    .searchable(text: $search, prompt: "Search prompts and lyrics")
    .toolbar {
      ToolbarItemGroup {
        Toggle("Favorites", systemImage: "star", isOn: $favoritesOnly)
          .help("Show only favorites")
        Button("Delete", systemImage: "trash") { model.pendingDeletion = model.historySelection }
          .disabled(model.historySelection.isEmpty)
          .help("Delete selected Takes and their files")
        Menu("More", systemImage: "ellipsis.circle") {
          Button("Clear All History…", role: .destructive) {
            model.pendingDeletion = Set(model.history.map(\.id))
          }
          .disabled(model.history.isEmpty)
        }
      }
    }
    .inspector(isPresented: $model.showsInspector) {
      Group {
        if model.historySelection.count == 1, let id = model.historySelection.first,
          let item = model.item(takeID: model.takeID(forRecord: id))
        {
          RecordDetails(item: item)
        } else {
          ContentUnavailableView(
            model.historySelection.count > 1
              ? "\(model.historySelection.count) Takes Selected" : "No Selection",
            systemImage: "clock")
        }
      }
      .inspectorColumnWidth(min: 260, ideal: 300, max: 420)
    }
  }

  private var rows: [GenerationRecord] {
    let query = search.trimmingCharacters(in: .whitespacesAndNewlines)
    return model.history.filter { record in
      (!favoritesOnly || record.isFavorite)
        && (query.isEmpty || record.request.prompt.localizedCaseInsensitiveContains(query)
          || record.request.lyrics.localizedCaseInsensitiveContains(query))
    }
    .sorted(using: sortOrder)
  }
}

struct HistoryActions: View {
  let ids: Set<String>
  @Environment(WorkspaceModel.self) private var model
  @Environment(PlaybackModel.self) private var playback

  var body: some View {
    if ids.count == 1, let id = ids.first, let record = model.record(id: id) {
      let audio = record.artifacts.first { $0.kind == .audio }
      if let item = model.item(takeID: model.takeID(forRecord: id)) {
        TakeActions(item: item)
        Divider()
        Button("Show in Project") {
          model.select(item.take.projectID.map(SidebarItem.project) ?? .unfiled)
          model.selectedTakeID = item.id
        }
      } else if let audio {
        Button("Play") { playback.toggle(record) }.disabled(!audio.exists)
        Button("Show in Finder") { Platform.reveal(audio) }.disabled(!audio.exists)
        Button("Export…") { Task { await Platform.export(audio, record: record, model: model) } }
          .disabled(!audio.exists)
        Button("Delete…", role: .destructive) { model.pendingDeletion = [id] }
      }
    } else if !ids.isEmpty {
      Button("Add to Favorites") {
        Task { for id in ids { await model.setFavorite(id: id, favorite: true) } }
      }
      Button("Delete \(ids.count) Takes…", role: .destructive) { model.pendingDeletion = ids }
    }
  }
}
