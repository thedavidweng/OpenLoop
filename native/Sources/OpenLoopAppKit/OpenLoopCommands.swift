import OpenLoopCore
import SwiftUI

struct OpenLoopCommands: Commands {
  let model: WorkspaceModel
  let playback: PlaybackModel

  var body: some Commands {
    CommandGroup(replacing: .newItem) {
      Button("New Project…") { model.isCreatingProject = true }
        .keyboardShortcut("n")
        .disabled(!model.isConnected)
    }
    CommandGroup(after: .importExport) {
      Button("Export Take…") {
        if let record = focused, let audio = audio(record) {
          Task { await Platform.export(audio, record: record, model: model) }
        }
      }
      .keyboardShortcut("e")
      .disabled(focused.flatMap(audio) == nil)
      Button("Show in Finder") { if let audio = focused.flatMap(audio) { Platform.reveal(audio) } }
        .keyboardShortcut("r", modifiers: [.command, .option])
        .disabled(focused.flatMap(audio) == nil)
    }
    CommandGroup(after: .sidebar) {
      Button("History") { model.select(.history) }
        .keyboardShortcut("y")
      Button("Unfiled Takes") { model.select(.unfiled) }
        .keyboardShortcut("0")
      Divider()
    }
    CommandMenu("Generate") {
      Button("Generate") { Task { await model.generate() } }
        .keyboardShortcut(.return, modifiers: .command)
        .disabled(!model.canGenerate || model.sidebar == .history)
      Button("Cancel Generation") { Task { await model.cancel() } }
        .keyboardShortcut(".", modifiers: .command)
        .disabled(model.activity != .generating)
      Divider()
      Button("Reproduce Take Exactly") {
        if let id = focusedTakeID { Task { await model.iterate(takeID: id, reproduce: true) } }
      }
      .keyboardShortcut("r")
      .disabled(
        !(focused.map(model.canReproduce) ?? false) || focusedTakeID == nil
          || model.activity == .generating)
      Button("New Variation of Take") {
        if let id = focusedTakeID { Task { await model.iterate(takeID: id, reproduce: false) } }
      }
      .keyboardShortcut("r", modifiers: [.command, .shift])
      .disabled(focusedTakeID == nil || model.activity == .generating)
      Divider()
      Button("Set Up Models…") {
        model.setupConfigurationID =
          model.currentConfiguration?.id ?? model.configurations.first?.id
      }
      .disabled(model.activity != .idle || !model.isConnected)
    }
    CommandMenu("Take") {
      Button(focused?.isFavorite == true ? "Remove from Favorites" : "Add to Favorites") {
        if let record = focused {
          Task { await model.setFavorite(id: record.id, favorite: !record.isFavorite) }
        }
      }
      .keyboardShortcut("d")
      .disabled(focused == nil)
      Button("Stop Comparing") { model.comparisonTakeID = nil }
        .disabled(model.comparisonTakeID == nil)
      Divider()
      Button("Delete…") { model.pendingDeletion = Set(model.focusedRecords.map(\.id)) }
        .keyboardShortcut(.delete, modifiers: .command)
        .disabled(model.focusedRecords.isEmpty)
    }
    CommandMenu("Playback") {
      Button(playback.isPlaying ? "Pause" : "Play") {
        playback.toggle(playback.loadedRecordID == nil ? focused : nil)
      }
      .keyboardShortcut(.space, modifiers: .option)
      .disabled(playback.loadedRecordID == nil && focused.flatMap(audio)?.exists != true)
      Button("Switch A/B") {
        if let a = model.item(takeID: model.selectedTakeID),
          let b = model.item(takeID: model.comparisonTakeID)
        {
          playback.compare(a: a.record, b: b.record)
        }
      }
      .keyboardShortcut("b", modifiers: [.command, .shift])
      .disabled(model.comparisonTakeID == nil || model.selectedTakeID == nil)
      Divider()
      Button("Back 5 Seconds") { playback.skip(by: -5) }
        .keyboardShortcut(.leftArrow, modifiers: [.command, .option])
        .disabled(playback.loadedRecordID == nil)
      Button("Forward 5 Seconds") { playback.skip(by: 5) }
        .keyboardShortcut(.rightArrow, modifiers: [.command, .option])
        .disabled(playback.loadedRecordID == nil)
      Button("Return to Start") { playback.seek(to: playback.selection?.start ?? 0) }
        .keyboardShortcut(.leftArrow, modifiers: [.command, .option, .shift])
        .disabled(playback.loadedRecordID == nil)
      Divider()
      Toggle(
        "Loop Selection",
        isOn: Binding(get: { playback.loopSelection }, set: { playback.loopSelection = $0 })
      )
      .keyboardShortcut("l")
      .disabled(playback.selection == nil)
      Button("Clear Selection") { playback.clearSelection() }
        .disabled(playback.selection == nil)
    }
    InspectorCommands()
  }

  private var focused: GenerationRecord? {
    model.focusedRecords.count == 1 ? model.focusedRecords.first : nil
  }
  private var focusedTakeID: String? { focused.flatMap { model.takeID(forRecord: $0.id) } }
  private func audio(_ record: GenerationRecord) -> Artifact? {
    record.artifacts.first { $0.kind == .audio && $0.exists }
  }
}
