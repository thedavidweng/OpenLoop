import Foundation
import OpenLoopCore

// Generation transport never follows redirects away from the loopback process.
final class LoopbackRedirects: NSObject, URLSessionTaskDelegate, Sendable {
  func urlSession(
    _ session: URLSession, task: URLSessionTask,
    willPerformHTTPRedirection response: HTTPURLResponse,
    newRequest request: URLRequest, completionHandler: @escaping (URLRequest?) -> Void
  ) {
    completionHandler(nil)
  }
}
struct LocalHTTP: Sendable {
  let port: Int
  private let session: URLSession
  init(port: Int) throws {
    guard (1024...65535).contains(port) else { throw CoreError.invalid("Invalid local port") }
    self.port = port
    let config = URLSessionConfiguration.ephemeral
    config.connectionProxyDictionary = [:]
    config.timeoutIntervalForRequest = 900
    self.session = URLSession(
      configuration: config, delegate: LoopbackRedirects(), delegateQueue: nil)
  }
  func data(
    _ path: String, body: JSONValue? = nil, query: [URLQueryItem] = [], timeout: Double = 900
  ) async throws -> Data {
    var components = URLComponents()
    components.scheme = "http"
    components.host = "127.0.0.1"
    components.port = port
    components.path = path
    if !query.isEmpty { components.queryItems = query }
    guard let url = components.url else { throw CoreError.invalid("Invalid local endpoint") }
    var request = URLRequest(url: url)
    request.timeoutInterval = timeout
    if let body {
      request.httpMethod = "POST"
      request.httpBody = try JSONEncoder().encode(body)
      request.setValue("application/json", forHTTPHeaderField: "Content-Type")
    }
    let (data, response) = try await session.data(for: request)
    guard let http = response as? HTTPURLResponse, (200...299).contains(http.statusCode) else {
      throw CoreError.engine("Local Engine HTTP request failed: \(path)")
    }
    return data
  }
  func envelope(_ path: String, body: JSONValue) async throws -> JSONValue {
    let response = try JSONDecoder().decode(JSONValue.self, from: await data(path, body: body))
    guard let code = response["code"]?.number, code == 0 || code == 200,
      response["error"] == nil || response["error"] == .null, let data = response["data"]
    else { throw CoreError.engine("Engine error: \(response)") }
    return data
  }
}
extension JSONValue {
  subscript(_ key: String) -> JSONValue? {
    if case .object(let object) = self { object[key] } else { nil }
  }
  var string: String? { if case .string(let value) = self { value } else { nil } }
  var number: Double? {
    switch self {
    case .number(let value): value
    case .integer(let value): Double(value)
    default: nil
    }
  }
  var integer: Int64? {
    switch self {
    case .integer(let value): value
    case .number(let value): Int64(exactly: value)
    default: nil
    }
  }
  var array: [JSONValue]? { if case .array(let value) = self { value } else { nil } }
}
