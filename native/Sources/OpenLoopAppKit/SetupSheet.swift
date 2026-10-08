import OpenLoopCore
import OpenLoopEngines
import SwiftUI

struct SetupSheet: View {
  let configurationID: String
  @Environment(WorkspaceModel.self) private var model
  @Environment(\.dismiss) private var dismiss
  @State private var accepted = false

  var body: some View {
    if let configuration = model.configurations.first(where: { $0.id == configurationID }),
      let pack = model.pack(configuration.selection.modelPackID),
      let runtime = model.runtime(for: configuration)
    {
      content(configuration: configuration, pack: pack, runtime: runtime)
    } else {
      VStack {
        Text("This model is not available.")
        Button("Close") { dismiss() }
      }
      .padding(30)
    }
  }

  private func content(configuration: Configuration, pack: ModelPack, runtime: RuntimeDescriptor)
    -> some View
  {
    let readiness = model.readiness(for: configuration)
    let compatible = runtime.supportsCurrentMachine()
    let needsRuntime = model.runtimeProvisioned != true
    let modelInstalled = model.installation(packID: pack.id)?.state == .installed
    let installing = model.activity == .installing
    return VStack(alignment: .leading, spacing: 0) {
      VStack(alignment: .leading, spacing: 4) {
        Text("Set Up \(model.configurationName(configuration.selection))").font(.title2.bold())
        Text(
          "OpenLoop generates music entirely on this Mac. The Engine and model are downloaded once."
        )
        .foregroundStyle(.secondary)
      }
      .padding(20)
      Form {
        Section("Compatibility") {
          check(
            compatible, "Apple Silicon Mac running macOS",
            detail: compatible ? nil : "This Engine cannot run on this Mac.")
          let enough = model.physicalMemoryGB >= configuration.recommendedMemoryGB
          check(
            enough, "\(model.physicalMemoryGB) GB memory",
            detail: enough
              ? "Recommended: \(configuration.recommendedMemoryGB) GB or more."
              : "Recommended: \(configuration.recommendedMemoryGB) GB. Generation may be slow or fail.",
            warningOnly: true)
        }
        Section("Downloads") {
          LabeledContent("Engine runtime") {
            Text(
              needsRuntime
                ? "ACE-Step source @ \(runtime.revision.prefix(8)) + Python packages" : "Installed"
            )
            .foregroundStyle(needsRuntime ? .primary : .secondary)
          }
          LabeledContent("Model “\(pack.name)”") {
            Text(modelInstalled ? "Installed" : packSize(pack.id))
              .foregroundStyle(modelInstalled ? .secondary : .primary)
          }
          if let failure = model.installation(packID: pack.id)?.error, !installing {
            Text("Previous attempt failed: \(failure)").font(.caption).foregroundStyle(.orange)
          }
        }
        Section("Licenses") {
          ForEach(licenses(runtime: runtime, pack: pack), id: \.url) { license in
            VStack(alignment: .leading, spacing: 4) {
              HStack {
                Text(license.name).bold()
                Spacer()
                Link("View License", destination: license.url)
              }
              Text(license.notice).font(.callout).foregroundStyle(.secondary)
            }
          }
          Toggle("I have reviewed these license terms", isOn: $accepted)
            .disabled(installing)
        }
        if installing {
          Section("Progress") {
            VStack(alignment: .leading, spacing: 6) {
              ProgressView(value: model.progress) {
                Text(model.statusMessage ?? "Preparing…").lineLimit(1).truncationMode(.middle)
              }
              if let progress = model.progress {
                Text(progress, format: .percent.precision(.fractionLength(0)))
                  .font(.caption).monospacedDigit().foregroundStyle(.secondary)
              }
            }
          }
        }
      }
      .formStyle(.grouped)
      HStack {
        if installing {
          Button("Cancel Download", role: .cancel) { model.cancelInstall() }
        } else {
          Button("Not Now", role: .cancel) { dismiss() }
            .keyboardShortcut(.cancelAction)
        }
        Spacer()
        if readiness == .ready {
          Button("Done") { dismiss() }.keyboardShortcut(.defaultAction)
        } else {
          Button("Install") { model.install(configurationID: configuration.id) }
            .keyboardShortcut(.defaultAction)
            .disabled(!accepted || !compatible || installing || model.activity != .idle)
        }
      }
      .padding(20)
    }
    .frame(width: 560, height: 620)
    .interactiveDismissDisabled(installing)
    .onChange(of: readiness) { _, value in if value == .ready { dismiss() } }
  }

  private func check(_ ok: Bool, _ title: String, detail: String?, warningOnly: Bool = false)
    -> some View
  {
    HStack(alignment: .top) {
      Image(
        systemName: ok
          ? "checkmark.circle.fill"
          : warningOnly ? "exclamationmark.triangle.fill" : "xmark.octagon.fill"
      )
      .foregroundStyle(ok ? .green : warningOnly ? .orange : .red)
      .accessibilityHidden(true)
      VStack(alignment: .leading) {
        Text(title)
        if let detail { Text(detail).font(.caption).foregroundStyle(.secondary) }
      }
    }
    .accessibilityElement(children: .combine)
  }
  private func licenses(runtime: RuntimeDescriptor, pack: ModelPack) -> [License] {
    pack.license.url == runtime.license.url ? [runtime.license] : [runtime.license, pack.license]
  }
}

func packSize(_ packID: String) -> String {
  guard let files = try? EngineCatalog.modelFiles(packID: packID) else { return "Download" }
  let total = files.reduce(Int64(0)) { $0 + $1.size }
  return "\(ByteCountFormatter.string(fromByteCount: total, countStyle: .file)) download"
}
