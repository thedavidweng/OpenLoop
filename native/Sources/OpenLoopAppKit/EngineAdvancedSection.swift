import OpenLoopCore
import OpenLoopEngines
import SwiftUI

// Engine-specific expert controls. Each bound Engine gets a curated panel; there is no
// generic schema renderer (ADR-0007). Unknown Engines simply show no Advanced area.
struct EngineAdvancedSection: View {
  @Environment(WorkspaceModel.self) private var model

  var body: some View {
    switch model.draft?.selection.engineID {
    case "ace-step": AceStepAdvancedSection()
    default: EmptyView()
    }
  }
}

private struct AceStepAdvancedSection: View {
  @Environment(WorkspaceModel.self) private var model
  @State private var expanded = false
  private static let languages = [
    ("unknown", "Automatic"), ("en", "English"), ("zh", "Chinese"), ("ja", "Japanese"),
    ("ko", "Korean"), ("es", "Spanish"), ("fr", "French"), ("de", "German"), ("pt", "Portuguese"),
    ("it", "Italian"), ("ru", "Russian"),
  ]

  var body: some View {
    Section {
      DisclosureGroup("ACE-Step Advanced", isExpanded: $expanded) {
        TextField(
          "Negative prompt", text: string("negativePrompt"), prompt: Text("Sounds to avoid"),
          axis: .vertical)
        Picker("Vocal language", selection: stringValue("vocalLanguage", default: "unknown")) {
          ForEach(Self.languages, id: \.0) { Text($0.1).tag($0.0) }
        }
        if model.currentConfiguration?.languageModel != nil {
          Picker("Planning (language model)", selection: thinking) {
            Text("Model default").tag(Bool?.none)
            Text("On").tag(Bool?.some(true))
            Text("Off").tag(Bool?.some(false))
          }
          .help("Lets ACE-Step’s language model plan structure before generating audio")
        }
        LabeledContent("Inference steps") {
          Stepper(
            "\(Int(number("inferenceSteps", default: 8)))",
            value: numberBinding("inferenceSteps", default: 8), in: 1...200, step: 1)
        }
        LabeledContent("Guidance scale") {
          HStack {
            Slider(value: numberBinding("guidanceScale", default: 7), in: 0...15, step: 0.5)
            Text(number("guidanceScale", default: 7), format: .number.precision(.fractionLength(1)))
              .monospacedDigit()
              .frame(width: 32)
          }
        }
        Button("Reset to Defaults") { model.draft?.engineOptions = .init() }
      }
    } footer: {
      if expanded {
        Text("Expert options passed only to ACE-Step. Defaults suit most ideas.")
          .font(.caption).foregroundStyle(.secondary)
      }
    }
  }

  private func value(_ key: String) -> JSONValue? { model.draft?.engineOptions.values[key] }
  private func set(_ key: String, _ value: JSONValue?) {
    model.draft?.engineOptions.values[key] = value
  }
  private func number(_ key: String, default fallback: Double) -> Double {
    switch value(key) {
    case .number(let v): v
    case .integer(let v): Double(v)
    default: fallback
    }
  }
  private func numberBinding(_ key: String, default fallback: Double) -> Binding<Double> {
    Binding(
      get: { number(key, default: fallback) },
      set: { set(key, $0.rounded() == $0 ? .integer(Int64($0)) : .number($0)) })
  }
  private func string(_ key: String) -> Binding<String> {
    Binding(
      get: { if case .string(let v) = value(key) { v } else { "" } },
      set: { set(key, $0.isEmpty ? nil : .string($0)) })
  }
  private func stringValue(_ key: String, default fallback: String) -> Binding<String> {
    Binding(
      get: { if case .string(let v) = value(key) { v } else { fallback } },
      set: { set(key, $0 == fallback ? nil : .string($0)) })
  }
  private var thinking: Binding<Bool?> {
    Binding(
      get: { if case .bool(let v) = value("thinking") { v } else { nil } },
      set: { set("thinking", $0.map(JSONValue.bool)) })
  }
}
