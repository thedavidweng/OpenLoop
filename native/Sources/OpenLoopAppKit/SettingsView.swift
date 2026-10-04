import AppKit
import OpenLoopCore
import OpenLoopEngines
import SwiftUI

struct SettingsView: View {
  var body: some View {
    TabView {
      Tab("General", systemImage: "gearshape") { GeneralSettings() }
      Tab("Models", systemImage: "cpu") { ModelSettings() }
      Tab("Advanced", systemImage: "wrench.and.screwdriver") { AdvancedSettings() }
    }
    .frame(width: 600, height: 460)
    .errorAlert()
  }
}

// Edits a local copy so users can review before saving; Core validates on save.
private struct SettingsEditor<Content: View>: View {
  @Environment(WorkspaceModel.self) private var model
  @State private var draft: WorkspaceSettings?
  let footer: String?
  @ViewBuilder let content: (Binding<WorkspaceSettings>) -> Content

  var body: some View {
    VStack(spacing: 0) {
      if let saved = model.settings {
        let binding = Binding(get: { draft ?? saved }, set: { draft = $0 })
        Form { content(binding) }
          .formStyle(.grouped)
        HStack {
          if let footer { Text(footer).font(.caption).foregroundStyle(.secondary) }
          Spacer()
          Button("Revert") { draft = nil }.disabled(draft == nil || draft == saved)
          Button("Save") {
            if let draft { Task { await model.saveSettings(draft) } }
            draft = nil
          }
          .keyboardShortcut(.defaultAction)
          .disabled(draft == nil || draft == saved)
        }
        .padding(16)
      } else {
        ProgressView()
      }
    }
  }
}

private struct GeneralSettings: View {
  @Environment(WorkspaceModel.self) private var model
  var body: some View {
    SettingsEditor(footer: nil) { settings in
      Section("New Takes") {
        Picker(
          "Default model",
          selection: Binding(
            get: { settings.wrappedValue.selection?.configurationID },
            set: { id in
              settings.wrappedValue.selection = id.flatMap {
                try? model.catalog.selection(configurationID: $0)
              }
            })
        ) {
          Text("Choose automatically").tag(String?.none)
          ForEach(model.configurations) { configuration in
            Text(model.configurationName(configuration.selection)).tag(Optional(configuration.id))
          }
        }
        LabeledContent("Default duration") {
          Stepper(
            formatTime(settings.wrappedValue.defaultDuration), value: settings.defaultDuration,
            in: 5...600,
            step: 5)
        }
        Picker("Default format", selection: settings.defaultAudioFormat) {
          Text("WAV").tag("wav")
          Text("FLAC").tag("flac")
          Text("MP3").tag("mp3")
        }
      }
      Section("Storage") {
        FolderRow(
          title: "Generated audio", url: settings.outputDirectory, placeholder: "OpenLoop library")
      }
    }
  }
}

private struct ModelSettings: View {
  @Environment(WorkspaceModel.self) private var model
  @State private var deleting: ModelPack?

  var body: some View {
    Form {
      Section("Engine Runtime") {
        LabeledContent("ACE-Step runtime") {
          Text(model.runtimeProvisioned == true ? "Installed" : "Not installed").foregroundStyle(
            .secondary)
        }
        HStack {
          Text("Settings that affect the local Engine apply the next time it starts.")
            .font(.caption).foregroundStyle(.secondary)
          Spacer()
          Button("Stop Local Engine") { Task { await model.stopEngine() } }
            .disabled(model.activity != .idle)
            .help("Stops the Engine OpenLoop started. An Engine started elsewhere is left running.")
        }
      }
      ForEach(model.catalog.engines) { engine in
        Section(engine.name) {
          ForEach(model.catalog.packs.filter { $0.engineID == engine.id }) { pack in
            PackRow(pack: pack, bound: engine.bound, onDelete: { deleting = pack })
          }
        }
      }
      if model.activity == .installing {
        Section {
          ProgressView(value: model.progress) { Text(model.statusMessage ?? "Installing…") }
          Button("Cancel Download") { model.cancelInstall() }
        }
      }
    }
    .formStyle(.grouped)
    .confirmationDialog(
      "Delete the “\(deleting?.name ?? "")” model?", isPresented: $deleting.isPresent,
      titleVisibility: .visible
    ) {
      Button("Delete Model", role: .destructive) {
        if let pack = deleting { Task { await model.deleteModel(packID: pack.id) } }
      }
    } message: {
      Text(
        "Downloaded model files are removed from this Mac. Files shared with other installed models are kept. Your Takes are not affected."
      )
    }
  }
}

private struct PackRow: View {
  let pack: ModelPack
  let bound: Bool
  let onDelete: () -> Void
  @Environment(WorkspaceModel.self) private var model

  var body: some View {
    let state = model.installation(packID: pack.id)?.state ?? .absent
    HStack(alignment: .top) {
      VStack(alignment: .leading, spacing: 2) {
        Text(pack.name)
        Text(subtitle(state)).font(.caption).foregroundStyle(.secondary)
        Link(pack.license.name, destination: pack.license.url).font(.caption)
      }
      Spacer()
      if !(bound && pack.installable) {
        Text("Not available").foregroundStyle(.secondary)
          .help(pack.license.notice)
      } else if state == .installed {
        Button("Delete…", role: .destructive, action: onDelete)
          .disabled(model.activity != .idle)
      } else if let configuration = model.configurations.first(where: {
        $0.selection.modelPackID == pack.id
      }) {
        Button(state == .failed || state == .downloading ? "Resume…" : "Install…") {
          model.setupConfigurationID = configuration.id
        }
        .disabled(model.activity != .idle)
      }
    }
  }
  private func subtitle(_ state: InstallationState) -> String {
    let memory = "Recommended \(pack.recommendedMemoryGB) GB memory"
    switch state {
    case .installed: return "Installed · \(memory)"
    case .downloading:
      return model.activity == .installing ? "Downloading…" : "Interrupted · \(memory)"
    case .failed: return "Install failed · \(memory)"
    case .absent:
      return bound && pack.installable ? "\(packSize(pack.id)) · \(memory)" : pack.license.notice
    }
  }
}

private struct AdvancedSettings: View {
  var body: some View {
    SettingsEditor(footer: "Changes here apply the next time the local Engine starts.") {
      settings in
      Section("Local Engine") {
        TextField("Port", value: settings.backendPort, format: .number.grouping(.never))
        TextField(
          "Model download server",
          value: settings.modelDownloadBaseURL, format: .url, prompt: Text("https://huggingface.co")
        )
      }
      Section("Folders") {
        FolderRow(title: "Models", url: settings.modelDirectory, placeholder: "OpenLoop library")
        FolderRow(
          title: "Engine runtime", url: settings.runtimeDirectory, placeholder: "OpenLoop library")
        FolderRow(title: "Engine logs", url: settings.logDirectory, placeholder: "OpenLoop library")
      }
    }
  }
}

private struct FolderRow: View {
  let title: String
  @Binding var url: URL?
  let placeholder: String

  var body: some View {
    LabeledContent(title) {
      HStack {
        Text(url?.path(percentEncoded: false) ?? placeholder)
          .lineLimit(1)
          .truncationMode(.middle)
          .foregroundStyle(.secondary)
        Button("Choose…") {
          let panel = NSOpenPanel()
          panel.canChooseDirectories = true
          panel.canChooseFiles = false
          panel.canCreateDirectories = true
          panel.directoryURL = url
          if panel.runModal() == .OK { url = panel.url }
        }
        if url != nil {
          Button("Use Default", systemImage: "arrow.uturn.backward") { url = nil }
            .labelStyle(.iconOnly)
            .buttonStyle(.borderless)
        }
      }
    }
  }
}
