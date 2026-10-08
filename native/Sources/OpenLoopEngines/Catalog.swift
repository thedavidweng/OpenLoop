import Foundation
import OpenLoopCore

public struct License: Codable, Sendable {
  public var name: String
  public var url: URL
  public var notice: String
}
public struct RuntimeDescriptor: Codable, Sendable, Identifiable {
  public var id: String
  public var engineID: String
  public var operatingSystems: [String]
  public var architectures: [String]
  public var accelerators: [String]
  public var minimumMemoryGB: Int
  public var implementation: String
  public var sourceURL: URL
  public var revision: String
  public var license: License
  public func supportsCurrentMachine() -> Bool {
    #if arch(arm64)
      architectures.contains("arm64") && operatingSystems.contains("macOS")
    #else
      false
    #endif
  }
}
public struct EngineDescriptor: Codable, Sendable, Identifiable {
  public var id: String
  public var name: String
  public var bound: Bool
}
public struct ModelPack: Codable, Sendable, Identifiable {
  public var id: String
  public var engineID: String
  public var name: String
  public var runtimeIDs: [String]
  public var recommendedMemoryGB: Int
  public var installable: Bool
  public var license: License
}
public struct Configuration: Codable, Sendable, Identifiable {
  public var id: String
  public var name: String
  public var selection: Selection
  public var capabilities: Capabilities
  public var model: String
  public var languageModel: String?
  public var thinking: Bool
  public var recommendedMemoryGB: Int
}
public struct ModelFile: Codable, Sendable {
  public var repo: String
  public var remotePath: String
  public var localPath: String
  public var size: Int64
}
public struct EngineCatalog: Codable, Sendable {
  public var engines: [EngineDescriptor]
  public var runtimes: [RuntimeDescriptor]
  public var packs: [ModelPack]
  public var configurations: [Configuration]
  public func configuration(_ selection: Selection) throws -> Configuration {
    guard let value = configurations.first(where: { $0.selection == selection }),
      let pack = packs.first(where: {
        $0.id == selection.modelPackID && $0.engineID == selection.engineID
      }),
      pack.runtimeIDs.contains(selection.runtimeID), pack.installable,
      engines.contains(where: { $0.id == selection.engineID && $0.bound })
    else { throw CoreError.invalid("Unbound or incompatible Engine selection") }
    return value
  }
  public func selection(configurationID: String) throws -> Selection {
    guard let config = configurations.first(where: { $0.id == configurationID }) else {
      throw CoreError.invalid("Unknown configuration: \(configurationID)")
    }
    _ = try configuration(config.selection)
    return config.selection
  }
  public func recommendedConfigurations(memoryGB: Int) -> [Configuration] {
    configurations.filter { config in
      config.recommendedMemoryGB <= memoryGB
        && packs.contains { $0.id == config.selection.modelPackID && $0.installable }
    }
  }
  public static let firstParty: EngineCatalog = {
    let license = License(
      name: "MIT",
      url: URL(
        string:
          "https://github.com/ACE-Step/ACE-Step-1.5/blob/d5d958eebeaf4de20f29bcf122d161dc0397b146/LICENSE"
      )!,
      notice:
        "Review the model repository license before installation and use; generated-content rights are not guaranteed."
    )
    let announced = License(
      name: "Not yet verified", url: URL(string: "https://huggingface.co/MiniMaxAI")!,
      notice: "Unavailable for installation. Licensing must be verified before binding this Engine."
    )
    let caps = Capabilities(
      [.lyrics, .bpm, .key, .timeSignature, .referenceAudio, .cover, .repaint, .reproducibility],
      maximumDuration: 600)
    let configs = [
      ("lite", "Lite", "standard", "acestep-v15-turbo", Optional<String>.none, false),
      ("turbo", "Turbo", "standard", "acestep-v15-turbo", "acestep-5Hz-lm-0.6B", true),
      ("pro", "XL Turbo", "xl", "acestep-v15-xl-turbo", "acestep-5Hz-lm-1.7B", true),
    ].map { slot, name, pack, model, lm, thinking in
      let id = "ace-step/" + slot
      return Configuration(
        id: id, name: name,
        selection: .init(
          engineID: "ace-step", runtimeID: "ace-step/uv", modelPackID: "ace-step/" + pack,
          configurationID: id), capabilities: caps, model: model, languageModel: lm,
        thinking: thinking, recommendedMemoryGB: 24)
    }
    return EngineCatalog(
      engines: [
        .init(id: "ace-step", name: "ACE-Step 1.5", bound: true),
        .init(id: "minimax-music3", name: "MiniMax Music 3", bound: false),
      ],
      runtimes: [
        .init(
          id: "ace-step/uv", engineID: "ace-step", operatingSystems: ["macOS"],
          architectures: ["arm64"], accelerators: ["MLX", "MPS"], minimumMemoryGB: 24,
          implementation: "bundled-uv-python",
          sourceURL: URL(
            string:
              "https://codeload.github.com/ACE-Step/ACE-Step-1.5/tar.gz/d5d958eebeaf4de20f29bcf122d161dc0397b146"
          )!, revision: "d5d958eebeaf4de20f29bcf122d161dc0397b146", license: license)
      ],
      packs: [
        .init(
          id: "ace-step/standard", engineID: "ace-step", name: "Standard",
          runtimeIDs: ["ace-step/uv"], recommendedMemoryGB: 24, installable: true, license: license),
        .init(
          id: "ace-step/xl", engineID: "ace-step", name: "XL", runtimeIDs: ["ace-step/uv"],
          recommendedMemoryGB: 24, installable: true, license: license),
        .init(
          id: "minimax-music3/turbo", engineID: "minimax-music3", name: "Turbo (announced)",
          runtimeIDs: [], recommendedMemoryGB: 16, installable: false, license: announced),
      ],
      configurations: configs)
  }()
  public static func modelFiles(packID: String) throws -> [ModelFile] {
    guard let url = Bundle.module.url(forResource: "model-files", withExtension: "json") else {
      throw CoreError.persistence("Missing bundled model manifest")
    }
    let files = try JSONDecoder().decode([String: [ModelFile]].self, from: Data(contentsOf: url))
    guard let pack = files[packID] else { throw CoreError.invalid("Unknown Model Pack: \(packID)") }
    return pack
  }
}
