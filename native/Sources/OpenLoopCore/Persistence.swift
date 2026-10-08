import CSQLite
import Foundation

// Owned by the core actor. Every mutation uses a short SQLite transaction;
// no cached workspace can overwrite another GUI/CLI process's changes.
final class Persistence {
  private var db: OpaquePointer?
  private let encoder = JSONEncoder()
  private let decoder = JSONDecoder()
  init(directory: URL) throws {
    try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
    guard
      sqlite3_open_v2(
        directory.appendingPathComponent("openloop.sqlite3").path, &db,
        SQLITE_OPEN_READWRITE | SQLITE_OPEN_CREATE | SQLITE_OPEN_FULLMUTEX, nil) == SQLITE_OK
    else {
      let message = db.map { String(cString: sqlite3_errmsg($0)) } ?? "Cannot open SQLite"
      sqlite3_close(db)
      db = nil
      throw CoreError.persistence(message)
    }
    sqlite3_busy_timeout(db, 5000)
    _ = try rows("PRAGMA journal_mode=WAL")
    try execute(
      "CREATE TABLE IF NOT EXISTS native_metadata (key TEXT PRIMARY KEY, value TEXT NOT NULL)")
    try execute(
      "CREATE TABLE IF NOT EXISTS native_objects (kind TEXT NOT NULL, id TEXT NOT NULL, payload TEXT NOT NULL, PRIMARY KEY(kind,id))"
    )
    try migrateLegacy()
  }
  deinit { sqlite3_close(db) }
  func execute(_ sql: String, _ values: [String] = []) throws {
    let statement = try prepare(sql, values)
    defer { sqlite3_finalize(statement) }
    guard sqlite3_step(statement) == SQLITE_DONE else { throw error() }
  }
  func rows(_ sql: String, _ values: [String] = []) throws -> [[String: String]] {
    let statement = try prepare(sql, values)
    defer { sqlite3_finalize(statement) }
    var result: [[String: String]] = []
    while true {
      let status = sqlite3_step(statement)
      if status == SQLITE_DONE { return result }
      guard status == SQLITE_ROW else { throw error() }
      var row: [String: String] = [:]
      for i in 0..<sqlite3_column_count(statement) {
        if let text = sqlite3_column_text(statement, i) {
          row[String(cString: sqlite3_column_name(statement, i))] = String(cString: text)
        }
      }
      result.append(row)
    }
  }
  private func prepare(_ sql: String, _ values: [String]) throws -> OpaquePointer {
    var statement: OpaquePointer?
    guard sqlite3_prepare_v2(db, sql, -1, &statement, nil) == SQLITE_OK, let statement else {
      throw error()
    }
    for (i, value) in values.enumerated() {
      let code = value.withCString {
        sqlite3_bind_text(
          statement, Int32(i + 1), $0, -1, unsafeBitCast(-1, to: sqlite3_destructor_type.self))
      }
      if code != SQLITE_OK {
        sqlite3_finalize(statement)
        throw error()
      }
    }
    return statement
  }
  private func error() -> CoreError { .persistence(String(cString: sqlite3_errmsg(db))) }
  func transaction<T>(_ body: () throws -> T) throws -> T {
    try execute("BEGIN IMMEDIATE")
    do {
      let value = try body()
      try execute("COMMIT")
      return value
    } catch {
      if sqlite3_get_autocommit(db) == 0 { try execute("ROLLBACK") }
      throw error
    }
  }
  func recoverInterruptedTasks() throws {
    for var task in try all("task", as: GenerationTask.self) where task.state == .running {
      task.state = .failed
      task.error = "OpenLoop exited before this Generation Task completed. Retry to generate again."
      try save("task", id: task.id, value: task)
    }
  }
  func save<T: Encodable>(_ kind: String, id: String, value: T) throws {
    let payload = String(decoding: try encoder.encode(value), as: UTF8.self)
    try execute(
      "INSERT INTO native_objects(kind,id,payload) VALUES(?,?,?) ON CONFLICT(kind,id) DO UPDATE SET payload=excluded.payload",
      [kind, id, payload])
  }
  func all<T: Decodable>(_ kind: String, as type: T.Type) throws -> [T] {
    try rows("SELECT payload FROM native_objects WHERE kind=? ORDER BY rowid", [kind]).map { row in
      guard let payload = row["payload"] else {
        throw CoreError.persistence("Missing native payload")
      }
      return try decoder.decode(type, from: Data(payload.utf8))
    }
  }
  func get<T: Decodable>(_ kind: String, id: String, as type: T.Type) throws -> T {
    let rows = try rows("SELECT payload FROM native_objects WHERE kind=? AND id=?", [kind, id])
    guard let payload = rows.first?["payload"] else {
      throw CoreError.notFound("Unknown \(kind): \(id)")
    }
    return try decoder.decode(type, from: Data(payload.utf8))
  }
  func remove(_ kind: String, id: String) throws {
    try execute("DELETE FROM native_objects WHERE kind=? AND id=?", [kind, id])
  }
}
