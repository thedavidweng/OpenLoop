import OpenLoopCore
import SwiftUI

struct ProfileSection: View {
  @Environment(WorkspaceModel.self) private var model
  @State private var creating = false
  @State private var renaming: GenerationProfile?
  @State private var deleting: GenerationProfile?
  @State private var name = ""

  var body: some View {
    Section("Profile") {
      Picker(
        "Saved defaults",
        selection: Binding(
          get: { model.selectedProfile?.id ?? "" },
          set: { id in
            if id.isEmpty {
              model.draft?.profileID = nil
              model.draft?.profileName = nil
            } else {
              Task { await model.chooseProfile(id: id) }
            }
          })
      ) {
        Text("Custom").tag("")
        ForEach(model.profiles) { profile in
          Text(profile.name).tag(profile.id)
        }
      }
      HStack {
        Button("Save as Profile") {
          name = ""
          creating = true
        }
        Menu("Manage Profiles") {
          ForEach(model.profiles) { profile in
            Menu(profile.name) {
              Button("Rename") {
                name = profile.name
                renaming = profile
              }
              Button("Delete", role: .destructive) { deleting = profile }
            }
          }
        }
        .disabled(model.profiles.isEmpty)
      }
      Text("Saves model, duration and audio format. Prompts and advanced options stay in Compose.")
        .font(.caption)
        .foregroundStyle(.secondary)
      if model.draft?.isRegionEdit == true {
        Text("Finish the region edit before switching profiles.")
          .font(.caption)
      }
    }
    .disabled(model.draft?.isRegionEdit == true)
    .alert("Save Profile", isPresented: $creating) {
      TextField("Profile name", text: $name)
      Button("Save") {
        let value = name.trimmingCharacters(in: .whitespacesAndNewlines)
        Task { await model.createProfile(name: value) }
      }
      .disabled(name.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty)
      Button("Cancel", role: .cancel) {}
    }
    .alert("Rename Profile", isPresented: $renaming.isPresent) {
      TextField("Profile name", text: $name)
      Button("Rename") {
        if let profile = renaming {
          let value = name.trimmingCharacters(in: .whitespacesAndNewlines)
          Task { await model.renameProfile(id: profile.id, name: value) }
        }
      }
      .disabled(name.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty)
      Button("Cancel", role: .cancel) {}
    }
    .confirmationDialog(
      "Delete profile?", isPresented: $deleting.isPresent, titleVisibility: .visible
    ) {
      Button("Delete Profile", role: .destructive) {
        if let profile = deleting { Task { await model.deleteProfile(id: profile.id) } }
      }
    } message: {
      Text("Completed Takes and their recorded profile names are retained.")
    }
  }
}
