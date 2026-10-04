import Foundation
import OpenLoopCore

public struct OpenLoopEnvironment: Sendable {
  public let core: OpenLoopCore
  public let catalog: EngineCatalog
  public let runtime: AceRuntime
  public let installer: ModelInstaller
  public init(core: OpenLoopCore, catalog: EngineCatalog, runtime: AceRuntime) {
    self.core = core
    self.catalog = catalog
    self.runtime = runtime
    self.installer = ModelInstaller(core: core, catalog: catalog)
  }
  public static func open(directory: URL = OpenLoopCore.defaultDirectory, bundledUV: URL)
    async throws -> OpenLoopEnvironment
  {
    let catalog = EngineCatalog.firstParty
    let settings = try await OpenLoopCore(directory: directory, engines: []).settings()
    let runtime = AceRuntime(
      directory: directory, bundledUV: bundledUV, settings: settings, catalog: catalog)
    let adapter = AceStepEngine(runtime: runtime, port: settings.backendPort, catalog: catalog)
    let core = try OpenLoopCore(directory: directory, engines: [adapter])
    return OpenLoopEnvironment(core: core, catalog: catalog, runtime: runtime)
  }
}
