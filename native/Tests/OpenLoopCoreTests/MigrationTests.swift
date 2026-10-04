import CSQLite
import Foundation
import Testing

@testable import OpenLoopCore

func legacyDatabase(root: URL, sql: String) throws {
  var db: OpaquePointer?
  #expect(sqlite3_open(root.appendingPathComponent("openloop.sqlite3").path, &db) == SQLITE_OK)
  defer { sqlite3_close(db) }
  guard sqlite3_exec(db, sql, nil, nil, nil) == SQLITE_OK else {
    throw CoreError.persistence(String(cString: sqlite3_errmsg(db)))
  }
}
@Test func legacyMigrationPreservesCompletedHistorySettingsAndReproduction() async throws {
  let root = try temporaryDirectory()
  defer { try? FileManager.default.removeItem(at: root) }
  let audio = root.appendingPathComponent("legacy.wav")
  try Data("legacy audio".utf8).write(to: audio)
  try legacyDatabase(
    root: root,
    sql: """
      CREATE TABLE settings(key TEXT PRIMARY KEY,value TEXT,updated_at TEXT);
      INSERT INTO settings VALUES('backendPort','8123','2026-01-01T00:00:00Z');
      INSERT INTO settings VALUES('modelVariant','"pro"','2026-01-01T00:00:00Z');
      INSERT INTO settings VALUES('language','"zh-CN"','2026-01-01T00:00:00Z');
      CREATE TABLE projects(id TEXT,name TEXT,created_at TEXT);
      INSERT INTO projects VALUES('idea','Song idea','2026-01-01T00:00:00Z');
      CREATE TABLE generations(id TEXT,created_at TEXT,prompt TEXT,lyrics TEXT,model TEXT,lm_model TEXT,thinking INTEGER,inference_steps INTEGER,guidance_scale REAL,
          seed TEXT,status TEXT,output_path TEXT,project_id TEXT,is_favorite INTEGER);
      INSERT INTO generations VALUES('music','2026-01-01T00:00:00Z','piano','hello','acestep-v15-xl-turbo','acestep-5Hz-lm-1.7B',1,8,7.0,'42','completed','\(audio.path)','idea',1);
      INSERT INTO generations(id,created_at,status,output_path) VALUES('failed','2026-01-01T00:00:00Z','failed','');
      INSERT INTO generations(id,created_at,status,output_path) VALUES('cancelled','2026-01-01T00:00:00Z','cancelled','');
      """)
  let core = try OpenLoopCore(directory: root, engines: [])
  let state = try await core.workspace()
  #expect(state.settings.backendPort == 8123)
  #expect(state.settings.selection?.configurationID == "ace-step/pro")
  #expect(state.settings.language == "zh-CN")
  #expect(state.history.count == 1)
  #expect(state.history.first?.request.selection.configurationID == "ace-step/pro")
  #expect(state.history.first?.request.engineOptions.values["inferenceSteps"] == .integer(8))
  #expect(state.history.first?.seed == 42)
  #expect(state.history.first?.isFavorite == true)
  #expect(state.takes.first?.projectID == "idea")
  #expect(state.history.first?.artifacts.first?.url == audio)
  let reopened = try OpenLoopCore(directory: root, engines: [])
  #expect(try await reopened.workspace().history.count == 1)
  #expect(FileManager.default.fileExists(atPath: audio.path))
}
