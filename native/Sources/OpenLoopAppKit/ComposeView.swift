import OpenLoopCore
import OpenLoopEngines
import SwiftUI
import UniformTypeIdentifiers

struct ComposeView: View {
  @Environment(WorkspaceModel.self) private var model
  @State private var importingReference = false

  private static let keys: [String] = [
    "C", "C#", "D", "Eb", "E", "F", "F#", "G", "Ab", "A", "Bb", "B",
  ]
  .flatMap { ["\($0) major", "\($0) minor"] }
  private static let timeSignatures = ["2", "3", "4", "6"]

  var body: some View {
    VStack(spacing: 0) {
      Form {
        engineSection
        if model.draft != nil {
          iterationBanner
          if isRegionEdit { editRegionSection }
          ideaSection
          shapeSection
          if shows(.bpm) || shows(.key) || shows(.timeSignature) { musicSection }
          if shows(.reproducibility) || shows(.referenceAudio) && !isRegionEdit { sourceSection }
          EngineAdvancedSection()
        }
      }
      .formStyle(.grouped)
      .disabled(model.activity == .generating)
      Divider()
      GenerateBar()
        .padding(12)
    }
    .fileImporter(isPresented: $importingReference, allowedContentTypes: [.audio]) { result in
      switch result {
      case .success(let url): model.draft?.references = [url]
      case .failure(let error): model.error = error.localizedDescription
      }
    }
  }

  private var isRegionEdit: Bool { model.draft?.isRegionEdit ?? false }
  private func shows(_ capability: Capability) -> Bool {
    ComposeRules.shows(capability, in: model.capabilities)
  }
  private func bind<T>(_ keyPath: WritableKeyPath<GenerationRequest, T>, _ fallback: T) -> Binding<
    T
  > {
    Binding(
      get: { model.draft?[keyPath: keyPath] ?? fallback },
      set: { model.draft?[keyPath: keyPath] = $0 })
  }

  @ViewBuilder private var engineSection: some View {
    Section {
      Picker(
        "Model",
        selection: Binding(
          get: { model.currentConfiguration?.id ?? "" },
          set: { id in Task { await model.chooseConfiguration(id: id) } })
      ) {
        if model.currentConfiguration == nil { Text("Choose…").tag("") }
        ForEach(model.catalog.engines) { engine in
          Section(engine.name) {
            let configurations = model.configurations.filter { $0.selection.engineID == engine.id }
            if engine.bound && !configurations.isEmpty {
              ForEach(configurations) { configuration in
                Text(configurationLabel(configuration)).tag(configuration.id)
              }
            } else {
              Text("\(engine.name) — not available yet")
                .tag("unavailable:\(engine.id)")
                .selectionDisabled()
            }
          }
        }
      }
      if let configuration = model.currentConfiguration {
        ReadinessRow(configuration: configuration)
      }
    } header: {
      Text("Engine")
    }
  }
  private func configurationLabel(_ configuration: Configuration) -> String {
    let installed =
      model.installation(packID: configuration.selection.modelPackID)?.state == .installed
    return installed ? configuration.name : "\(configuration.name) (not installed)"
  }

  @ViewBuilder private var iterationBanner: some View {
    if let parent = model.draft?.parentTakeID {
      Section {
        HStack {
          Label(bannerTitle, systemImage: bannerIcon)
          Spacer()
          if let item = model.item(takeID: parent) {
            Button("Show") { model.selectedTakeID = item.id }
          }
          Button("Start Fresh", systemImage: "xmark.circle.fill") { model.clearIteration() }
            .labelStyle(.iconOnly)
            .buttonStyle(.borderless)
            .help("Generate independently instead of as a variation")
        }
      }
    }
  }
  private var bannerTitle: String {
    switch model.draft?.operation {
    case .variation: "New variation of a Take"
    case .repaint: "Repainting part of a Take"
    case .extend: "Extending a Take"
    case .cover: "Covering a Take"
    case .generate, nil: "Iterating on a Take"
    }
  }
  private var bannerIcon: String {
    switch model.draft?.operation {
    case .repaint: "paintbrush"
    case .extend: "arrow.right.to.line"
    default: "arrow.triangle.branch"
    }
  }

  private func regionBinding(_ keyPath: WritableKeyPath<EditRegion, Double>) -> Binding<Double> {
    Binding(
      get: { model.draft?.editRegion?[keyPath: keyPath] ?? 0 },
      set: { model.draft?.editRegion?[keyPath: keyPath] = $0 })
  }

  @ViewBuilder private var editRegionSection: some View {
    let duration = model.draft?.duration ?? 0
    let region = model.draft?.editRegion
    Section {
      if model.draft?.operation == .repaint {
        LabeledContent("Start") {
          TextField(
            "Start", value: regionBinding(\.start),
            format: .number.precision(.fractionLength(0...2))
          )
          .labelsHidden()
          .multilineTextAlignment(.trailing)
          .frame(width: 80)
          .accessibilityLabel("Repaint start, seconds")
        }
        LabeledContent("End") {
          TextField(
            "End", value: regionBinding(\.end), format: .number.precision(.fractionLength(0...2))
          )
          .labelsHidden()
          .multilineTextAlignment(.trailing)
          .frame(width: 80)
          .accessibilityLabel("Repaint end, seconds")
        }
        Text(
          "Only \(formatTime(region?.start ?? 0))–\(formatTime(region?.end ?? 0)) of the \(formatTime(duration)) Take is regenerated. The rest stays as it is."
        )
        .font(.caption)
        .foregroundStyle(.secondary)
      } else {
        let start = region?.start ?? 0
        let maximum = model.capabilities?.maximumDuration ?? start
        LabeledContent("Continue from", value: formatTime(start))
        if maximum > start + 1 {
          LabeledContent("New length") {
            HStack {
              Slider(
                value: Binding(
                  get: { region?.end ?? start },
                  set: {
                    model.draft?.editRegion?.end = $0
                    model.draft?.duration = $0
                  }),
                in: min(start + 1, maximum)...maximum
              )
              .accessibilityValue("\(Int(region?.end ?? start)) seconds")
              Text(formatTime(region?.end ?? start))
                .monospacedDigit()
                .frame(width: 44, alignment: .trailing)
            }
          }
        }
        Text("Adds \(formatTime(region?.length ?? 0)) of new music after the end of the Take.")
          .font(.caption)
          .foregroundStyle(.secondary)
      }
      if let source = model.draft?.references.first {
        LabeledContent("Source", value: source.lastPathComponent)
      }
    } header: {
      Text(model.draft?.operation == .repaint ? "Repaint Region" : "Extension")
    }
  }

  @ViewBuilder private var ideaSection: some View {
    Section("Idea") {
      LabeledContent("Prompt") {
        TextEditor(text: bind(\.prompt, ""))
          .font(.body)
          .frame(minHeight: 70)
          .scrollContentBackground(.hidden)
          .accessibilityLabel("Prompt")
      }
      .labelsHidden()
      .overlay(alignment: .topLeading) {
        if model.draft?.prompt.isEmpty ?? true {
          Text("Describe the music: genre, mood, instruments, voice…")
            .foregroundStyle(.tertiary)
            .padding(.leading, 5)
            .allowsHitTesting(false)
            .accessibilityHidden(true)
        }
      }
      if shows(.lyrics) {
        DisclosureGroup("Lyrics") {
          TextEditor(text: bind(\.lyrics, ""))
            .font(.body.monospaced())
            .frame(minHeight: 110)
            .scrollContentBackground(.hidden)
            .accessibilityLabel("Lyrics")
        }
      }
    }
  }

  @ViewBuilder private var shapeSection: some View {
    let maximum = model.capabilities?.maximumDuration ?? 600
    Section("Takes") {
      if !isRegionEdit {
        LabeledContent("Duration") {
          HStack {
            Slider(value: bind(\.duration, 30), in: 5...max(5, maximum), step: 5)
              .accessibilityLabel("Duration")
              .accessibilityValue("\(Int(model.draft?.duration ?? 30)) seconds")
            Text(formatTime(model.draft?.duration ?? 30))
              .monospacedDigit()
              .frame(width: 44, alignment: .trailing)
          }
        }
      }
      Stepper(value: bind(\.takeCount, 1), in: 1...8) {
        LabeledContent("Takes per generation", value: "\(model.draft?.takeCount ?? 1)")
      }
      Picker("Format", selection: bind(\.audioFormat, "wav")) {
        Text("WAV").tag("wav")
        Text("FLAC").tag("flac")
        Text("MP3").tag("mp3")
      }
    }
  }

  @ViewBuilder private var musicSection: some View {
    Section("Music") {
      if shows(.bpm) {
        TextField("Tempo (BPM)", value: bind(\.bpm, nil), format: .number, prompt: Text("Auto"))
      }
      if shows(.key) {
        Picker("Key", selection: bind(\.key, nil)) {
          Text("Auto").tag(String?.none)
          ForEach(Self.keys, id: \.self) { Text($0).tag(Optional($0)) }
        }
      }
      if shows(.timeSignature) {
        Picker("Time signature", selection: bind(\.timeSignature, nil)) {
          Text("Auto").tag(String?.none)
          ForEach(Self.timeSignatures, id: \.self) { Text("\($0) beats").tag(Optional($0)) }
        }
      }
    }
  }

  @ViewBuilder private var sourceSection: some View {
    Section("Variation") {
      if shows(.reproducibility) {
        Toggle(
          "Fixed seed",
          isOn: Binding(
            get: { model.draft?.seed != nil },
            set: {
              model.draft?.seed =
                $0 ? (model.draft?.seed ?? Int64.random(in: 0...Int64(Int32.max))) : nil
            })
        )
        .help("Use the same seed and settings to reproduce a Take exactly")
        if model.draft?.seed != nil {
          TextField("Seed", value: bind(\.seed, nil), format: .number.grouping(.never))
        }
      }
      if shows(.referenceAudio) && !isRegionEdit {
        LabeledContent("Reference audio") {
          if let reference = model.draft?.references.first {
            HStack {
              Text(reference.lastPathComponent).lineLimit(1).truncationMode(.middle)
              Button("Remove", systemImage: "xmark.circle.fill") { model.draft?.references = [] }
                .labelStyle(.iconOnly)
                .buttonStyle(.borderless)
            }
          } else {
            Button("Choose…") { importingReference = true }
          }
        }
        .dropDestination(for: URL.self) { urls, _ in
          guard let url = urls.first(where: \.isFileURL) else { return false }
          model.draft?.references = [url]
          return true
        }
      }
    }
  }
}

struct ReadinessRow: View {
  let configuration: Configuration
  @Environment(WorkspaceModel.self) private var model

  var body: some View {
    let readiness = model.readiness(for: configuration)
    switch readiness {
    case .ready:
      Label("Installed and ready", systemImage: "checkmark.circle.fill")
        .foregroundStyle(.secondary)
    case .installing:
      VStack(alignment: .leading) {
        Text(model.statusMessage ?? "Installing…").font(.callout)
        ProgressView(value: model.progress)
      }
    case .unsupported(let reason):
      Label(reason, systemImage: "xmark.octagon").foregroundStyle(.red)
    case .needsRuntime, .needsModel:
      HStack {
        Label(
          readiness == .needsRuntime ? "Engine runtime not installed" : "Model not installed",
          systemImage: "arrow.down.circle")
        Spacer()
        Button("Set Up…") { model.setupConfigurationID = configuration.id }
      }
    }
    if configuration.recommendedMemoryGB > model.physicalMemoryGB {
      Label(
        "Recommended for \(configuration.recommendedMemoryGB) GB of memory; this Mac has \(model.physicalMemoryGB) GB.",
        systemImage: "memorychip"
      )
      .font(.callout)
      .foregroundStyle(.orange)
    }
  }
}

struct GenerateBar: View {
  @Environment(WorkspaceModel.self) private var model

  var body: some View {
    if model.activity == .generating {
      HStack(spacing: 10) {
        VStack(alignment: .leading, spacing: 4) {
          Text(model.statusMessage ?? "Generating…").font(.callout).lineLimit(1)
          ProgressView(value: model.progress).progressViewStyle(.linear)
        }
        Button("Cancel", role: .cancel) { Task { await model.cancel() } }
          .help("Cancel Generation (⌘.)")
      }
      .accessibilityElement(children: .contain)
    } else {
      VStack(spacing: 6) {
        if model.runningElsewhere {
          Text("Another OpenLoop window or the CLI is generating. Wait for it to finish.")
            .font(.caption).foregroundStyle(.secondary)
        } else if model.draft?.prompt.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
          ?? true
        {
          Text("Write a prompt to generate.").font(.caption).foregroundStyle(.secondary)
        }
        Button {
          Task { await model.generate() }
        } label: {
          let count = model.draft?.takeCount ?? 1
          Label(
            count == 1 ? "Generate Take" : "Generate \(count) Takes",
            systemImage: "waveform.badge.plus"
          )
          .frame(maxWidth: .infinity)
        }
        .buttonStyle(.borderedProminent)
        .controlSize(.large)
        .disabled(!model.canGenerate)
        .help("Generate (⌘↩)")
      }
    }
  }
}
