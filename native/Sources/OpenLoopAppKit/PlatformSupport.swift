import AppKit
import OpenLoopCore
import SwiftUI
import UniformTypeIdentifiers
@preconcurrency import UserNotifications

enum Platform {
  static func reveal(_ artifact: Artifact) {
    NSWorkspace.shared.activateFileViewerSelecting([artifact.url])
  }
  static func open(_ url: URL) { NSWorkspace.shared.open(url) }

  @MainActor
  static func export(_ artifact: Artifact, record: GenerationRecord, model: WorkspaceModel) async {
    var preset: AudioExportPreset?
    if artifact.kind == .audio {
      guard let choice = chooseExportPreset(allowOriginal: true) else { return }
      if choice > 0 { preset = AudioExportPreset.allCases[choice - 1] }
    }
    let panel = NSSavePanel()
    panel.canCreateDirectories = true
    let name = suggestedName(for: artifact, record: record)
    panel.nameFieldStringValue =
      preset.map {
        (name as NSString).deletingPathExtension + "." + $0.format
      } ?? name
    if let type = UTType(filenameExtension: preset?.format ?? artifact.url.pathExtension) {
      panel.allowedContentTypes = [type]
    }
    guard panel.runModal() == .OK, let destination = panel.url else { return }
    // NSSavePanel confirms replacement; Core publishes only after conversion succeeds.
    await model.export(
      generationID: record.id, artifactID: artifact.id, to: destination, preset: preset,
      replaceExisting: true)
  }

  @MainActor
  static func exportSelected(ids: Set<String>, model: WorkspaceModel) async {
    guard let choice = chooseExportPreset(allowOriginal: false) else { return }
    let preset = AudioExportPreset.allCases[choice]
    let panel = NSOpenPanel()
    panel.message = "Choose a folder for the selected Takes"
    panel.canChooseDirectories = true
    panel.canChooseFiles = false
    panel.canCreateDirectories = true
    guard panel.runModal() == .OK, let directory = panel.url else { return }
    await model.exportGenerations(ids: ids, to: directory, preset: preset)
  }

  @MainActor
  private static func chooseExportPreset(allowOriginal: Bool) -> Int? {
    let alert = NSAlert()
    alert.messageText = "Export audio"
    alert.informativeText =
      "Convert locally with Generation Record metadata. FLAC stores integer PCM; floating-point WAV is quantized. Original file preserves all source bytes."
    alert.addButton(withTitle: "Continue")
    alert.addButton(withTitle: "Cancel")
    let choices =
      (allowOriginal ? ["Original file (no conversion)"] : [])
      + AudioExportPreset.allCases.map(\.title)
    let picker = NSPopUpButton(frame: NSRect(x: 0, y: 0, width: 340, height: 28))
    picker.addItems(withTitles: choices)
    picker.setAccessibilityLabel("Export format and preset")
    alert.accessoryView = picker
    guard alert.runModal() == .alertFirstButtonReturn else { return nil }
    return picker.indexOfSelectedItem
  }

  static func suggestedName(for artifact: Artifact, record: GenerationRecord) -> String {
    let words = record.request.prompt.split(whereSeparator: { !$0.isLetter && !$0.isNumber })
      .prefix(6)
    let stem = words.isEmpty ? "OpenLoop Take" : words.joined(separator: " ")
    let suffix = artifact.kind == .audio ? "" : " \(artifact.kind.rawValue)"
    return "\(stem)\(suffix).\(artifact.url.pathExtension)"
  }

  // Finder and DAWs accept file URLs; the item is the original Output File, never a temporary copy.
  static func dragProvider(for artifact: Artifact?) -> NSItemProvider {
    guard let artifact, artifact.exists, let provider = NSItemProvider(contentsOf: artifact.url)
    else {
      return NSItemProvider()
    }
    provider.suggestedName = artifact.url.lastPathComponent
    return provider
  }
}

@MainActor
enum Notifications {
  // UNUserNotificationCenter requires a bundled app; `swift run` builds are skipped.
  static var available: Bool {
    Bundle.main.bundleIdentifier != nil && Bundle.main.bundleURL.pathExtension == "app"
  }
  static func requestAuthorization() {
    guard available else { return }
    UNUserNotificationCenter.current().requestAuthorization(options: [.alert, .sound]) { _, _ in }
  }
  static func takeCompleted(_ record: GenerationRecord) {
    guard available, !NSApp.isActive else { return }
    let content = UNMutableNotificationContent()
    content.title = "Take ready"
    content.body = record.request.prompt
    content.sound = .default
    UNUserNotificationCenter.current().add(
      UNNotificationRequest(identifier: record.id, content: content, trigger: nil))
  }
}

@MainActor
public final class OpenLoopAppDelegate: NSObject, NSApplicationDelegate {
  public var model: WorkspaceModel?
  private var terminating = false

  public func applicationShouldTerminateAfterLastWindowClosed(_ sender: NSApplication) -> Bool {
    true
  }

  public func applicationShouldTerminate(_ sender: NSApplication) -> NSApplication.TerminateReply {
    guard let model, !terminating else { return .terminateNow }
    if model.activity != .idle {
      let alert = NSAlert()
      alert.messageText =
        model.activity == .generating ? "A Take is still generating" : "A download is in progress"
      alert.informativeText =
        model.activity == .generating
        ? "Quitting cancels the Generation Task. Completed Takes are kept, and you can retry the rest later."
        : "Quitting stops the download. Downloaded files are kept and resume next time."
      alert.addButton(withTitle: "Quit")
      alert.addButton(withTitle: "Cancel")
      guard alert.runModal() == .alertFirstButtonReturn else { return .terminateCancel }
    }
    terminating = true
    Task {
      await model.shutdown()
      sender.reply(toApplicationShouldTerminate: true)
    }
    return .terminateLater
  }
}
