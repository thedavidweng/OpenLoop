import OpenLoopCore
import SwiftUI

struct TakeInspector: View {
  @Environment(WorkspaceModel.self) private var model
  @Environment(PlaybackModel.self) private var playback

  var body: some View {
    if let item = model.item(takeID: model.selectedTakeID) {
      RecordDetails(item: item)
    } else {
      ContentUnavailableView(
        "No Take Selected", systemImage: "waveform",
        description: Text("Select a Take to see its settings, files, and iteration options."))
    }
  }
}

struct RecordDetails: View {
  let item: TakeItem
  @Environment(WorkspaceModel.self) private var model
  @Environment(PlaybackModel.self) private var playback

  var body: some View {
    let record = item.record
    let request = record.request
    Form {
      Section {
        HStack {
          Button("Reproduce", systemImage: "arrow.counterclockwise") {
            Task { await model.iterate(takeID: item.id, reproduce: true) }
          }
          .disabled(!model.canReproduce(record) || model.activity == .generating)
          .help(
            model.canReproduce(record)
              ? "Load this Take’s exact seed and settings into Compose"
              : "Exact reproduction needs the seed the Engine actually used, which was not reported for this Take"
          )
          Button("Variation", systemImage: "arrow.triangle.branch") {
            Task { await model.iterate(takeID: item.id, reproduce: false) }
          }
          .disabled(model.activity == .generating)
          .help("Load these settings into Compose as a new variation of this Take")
        }
        if model.canEdit(item, .repaint) || model.canEdit(item, .extend) {
          HStack { RegionEditActions(item: item, showsIcons: true) }
          if model.canEdit(item, .repaint), playback.editSelection(for: record.id) == nil {
            Text("To repaint, play this Take and drag across the waveform to select a part.")
              .font(.caption).foregroundStyle(.secondary)
          }
        }
        if !model.canReproduce(record) {
          Text("Exact reproduction is unavailable because the actual seed was not recorded.")
            .font(.caption).foregroundStyle(.secondary)
        }
        if model.sidebar != .history, model.selectedTakeID == item.id {
          Picker(
            "Compare with",
            selection: Binding(
              get: { model.comparisonTakeID },
              set: { model.comparisonTakeID = $0 })
          ) {
            Text("None").tag(String?.none)
            ForEach(model.takes(projectID: item.take.projectID).filter { $0.id != item.id }) {
              other in
              Text(
                other.record.createdAt.formatted(date: .omitted, time: .shortened) + " · "
                  + other.record.request.prompt.prefix(24)
              )
              .tag(Optional(other.id))
            }
          }
        }
      }
      Section("Prompt") {
        Text(request.prompt).textSelection(.enabled)
        if !request.lyrics.isEmpty {
          DisclosureGroup("Lyrics") {
            Text(request.lyrics).font(.body.monospaced()).textSelection(.enabled)
          }
        }
      }
      Section("Settings") {
        LabeledContent("Model", value: model.configurationName(request.selection))
        LabeledContent("Duration", value: formatTime(request.duration))
        LabeledContent("Seed", value: record.seed.map { String($0) } ?? "Not reported")
        if let region = request.editRegion {
          LabeledContent(
            request.operation == .extend ? "Extended" : "Repainted",
            value: "\(formatTime(region.start))–\(formatTime(region.end))")
        }
        if let bpm = request.bpm { LabeledContent("Tempo", value: "\(bpm) BPM") }
        if let key = request.key { LabeledContent("Key", value: key) }
        if let signature = request.timeSignature {
          LabeledContent("Time signature", value: signature)
        }
        if !request.engineOptions.values.isEmpty {
          LabeledContent("Advanced", value: "\(request.engineOptions.values.count) custom")
        }
        LabeledContent(
          "Created", value: record.createdAt.formatted(date: .abbreviated, time: .shortened))
        if let project = model.projectName(item.take.projectID) {
          LabeledContent("Project", value: project)
        }
      }
      Section("Files") {
        ForEach(record.artifacts) { artifact in
          ArtifactRow(artifact: artifact, record: record)
        }
      }
      Section {
        Button(
          record.isFavorite ? "Remove from Favorites" : "Add to Favorites",
          systemImage: record.isFavorite ? "star.slash" : "star"
        ) {
          Task { await model.setFavorite(id: record.id, favorite: !record.isFavorite) }
        }
        Button("Delete Take…", systemImage: "trash", role: .destructive) {
          model.pendingDeletion = [record.id]
        }
      }
    }
    .formStyle(.grouped)
  }
}

struct ArtifactRow: View {
  let artifact: Artifact
  let record: GenerationRecord
  @Environment(WorkspaceModel.self) private var model

  var body: some View {
    HStack {
      Image(systemName: icon).frame(width: 18).foregroundStyle(.secondary)
      VStack(alignment: .leading) {
        Text(title)
        Text(
          artifact.exists
            ? artifact.url.lastPathComponent : "Missing: \(artifact.url.lastPathComponent)"
        )
        .font(.caption)
        .foregroundStyle(artifact.exists ? .secondary : Color.orange)
        .lineLimit(1)
        .truncationMode(.middle)
      }
      Spacer()
      Menu("Actions", systemImage: "ellipsis.circle") {
        Button("Show in Finder") { Platform.reveal(artifact) }
        Button("Export…") { Task { await Platform.export(artifact, record: record, model: model) } }
      }
      .labelStyle(.iconOnly)
      .menuStyle(.borderlessButton)
      .fixedSize()
      .disabled(!artifact.exists)
    }
    .onDrag { Platform.dragProvider(for: artifact) }
    .help("Drag to Finder or a DAW")
    .accessibilityElement(children: .combine)
  }
  private var title: String {
    switch artifact.kind {
    case .audio: "Audio"
    case .timedLyrics: "Timed lyrics"
    case .midi: "MIDI"
    case .score: "Score"
    case .stem: "Stem"
    case .metadata: "Engine metadata"
    }
  }
  private var icon: String {
    switch artifact.kind {
    case .audio: "waveform"
    case .timedLyrics: "text.quote"
    case .midi: "pianokeys"
    case .score: "music.note"
    case .stem: "square.stack.3d.up"
    case .metadata: "doc.text"
    }
  }
}
