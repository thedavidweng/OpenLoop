import OpenLoopCore
import SwiftUI

struct SidebarView: View {
  @Environment(WorkspaceModel.self) private var model
  @State private var renaming: Project?
  @State private var newName = ""
  @State private var deleting: Project?

  var body: some View {
    List(selection: Binding(get: { model.sidebar }, set: { model.select($0) })) {
      Section("Library") {
        Label("History", systemImage: "clock.arrow.circlepath")
          .badge(model.history.count)
          .tag(SidebarItem.history)
      }
      Section("Projects") {
        Label("Unfiled Takes", systemImage: "tray")
          .badge(model.takes(projectID: nil).count)
          .tag(SidebarItem.unfiled)
        ForEach(model.projects) { project in
          Label(project.name, systemImage: "music.note.list")
            .badge(model.takes(projectID: project.id).count)
            .tag(SidebarItem.project(project.id))
            .contextMenu {
              Button("Rename…") {
                newName = project.name
                renaming = project
              }
              Button("Delete Project…", role: .destructive) { deleting = project }
            }
        }
      }
    }
    .listStyle(.sidebar)
    .toolbar {
      ToolbarItem {
        Button("New Project", systemImage: "folder.badge.plus") { model.isCreatingProject = true }
          .help("New Project (⌘N)")
      }
    }
    .alert("Rename Project", isPresented: $renaming.isPresent) {
      TextField("Project name", text: $newName)
      Button("Rename") {
        if let project = renaming {
          let name = newName.trimmingCharacters(in: .whitespacesAndNewlines)
          if !name.isEmpty { Task { await model.renameProject(id: project.id, name: name) } }
        }
      }
      .keyboardShortcut(.defaultAction)
      Button("Cancel", role: .cancel) {}
    }
    .confirmationDialog(
      "Delete “\(deleting?.name ?? "")”?", isPresented: $deleting.isPresent,
      titleVisibility: .visible
    ) {
      Button("Delete Project", role: .destructive) {
        if let project = deleting { Task { await model.deleteProject(id: project.id) } }
      }
    } message: {
      Text("Its Takes stay in History and move to Unfiled Takes. No audio files are deleted.")
    }
  }
}
