import Darwin
import Foundation

// Holding this OS lock proves an executor is alive across GUI/CLI processes.
final class GenerationLease {
  private let descriptor: Int32
  init(directory: URL) throws {
    descriptor = open(
      directory.appendingPathComponent("native-generation.lock").path, O_CREAT | O_RDWR,
      S_IRUSR | S_IWUSR)
    guard descriptor >= 0 else { throw CoreError.persistence("Cannot open Generation Task lease") }
    guard flock(descriptor, LOCK_EX | LOCK_NB) == 0 else {
      close(descriptor)
      throw CoreError.conflict("Another OpenLoop process is executing a Generation Task")
    }
  }
  deinit {
    flock(descriptor, LOCK_UN)
    close(descriptor)
  }
}
