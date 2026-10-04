import Darwin
import Foundation
import OpenLoopCLIKit

@main
struct OpenLoopCommand {
  static func main() async {
    var arguments = Array(CommandLine.arguments.dropFirst())
    let json = removeFlag("--json", from: &arguments)
    do {
      let directory = try removeOption("--data-dir", from: &arguments).map {
        URL(fileURLWithPath: $0)
      }
      let uvPath = try removeOption("--uv", from: &arguments)
      if arguments.isEmpty || arguments == ["--help"] || arguments == ["help"] {
        print(OpenLoopCLI.usage)
        return
      }
      let executable = URL(fileURLWithPath: CommandLine.arguments[0]).standardizedFileURL
      let uv =
        uvPath.map { URL(fileURLWithPath: $0) }
        ?? executable.deletingLastPathComponent().appendingPathComponent("uv")
      let environment = try await openEnvironment(directory: directory, uv: uv)
      let cli = OpenLoopCLI(environment: environment)
      let execution = Task {
        try await cli.execute(arguments: arguments) { event in
          if json {
            let data = try JSONEncoder().encode(event)
            let output =
              event.kind == "error" ? FileHandle.standardError : FileHandle.standardOutput
            output.write(data + Data([10]))
          } else if event.kind == "result" {
            let encoder = JSONEncoder()
            encoder.outputFormatting = [.prettyPrinted, .sortedKeys]
            FileHandle.standardOutput.write(try encoder.encode(event.data) + Data([10]))
          } else {
            FileHandle.standardError.write(try JSONEncoder().encode(event.data) + Data([10]))
          }
        }
        try Task.checkCancellation()
      }
      signal(SIGINT, SIG_IGN)
      let interrupt = DispatchSource.makeSignalSource(signal: SIGINT, queue: .global())
      interrupt.setEventHandler { execution.cancel() }
      interrupt.resume()
      defer { interrupt.cancel() }
      try await execution.value
    } catch {
      let data: Data
      do {
        data =
          json
          ? try JSONEncoder().encode(CLIEvent.error(error)) : Data(error.localizedDescription.utf8)
      } catch {
        FileHandle.standardError.write(Data("Error encoding CLI error\n".utf8))
        exit(1)
      }
      FileHandle.standardError.write(data + Data([10]))
      exit(error is CancellationError ? 130 : 1)
    }
  }
  private static func removeFlag(_ name: String, from args: inout [String]) -> Bool {
    guard let index = args.firstIndex(of: name) else { return false }
    args.remove(at: index)
    return true
  }
  private static func removeOption(_ name: String, from args: inout [String]) throws -> String? {
    guard let index = args.firstIndex(of: name) else { return nil }
    guard index + 1 < args.count, !args[index + 1].hasPrefix("--") else {
      throw CLIArgumentError.missing(name)
    }
    let value = args.remove(at: index + 1)
    args.remove(at: index)
    return value
  }
}
enum CLIArgumentError: Error, LocalizedError {
  case missing(String)
  var errorDescription: String? {
    switch self {
    case .missing(let flag): "Missing value for \(flag)"
    }
  }
}
