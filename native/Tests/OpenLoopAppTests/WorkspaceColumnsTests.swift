import Testing

@testable import OpenLoopAppKit

@Test func workspaceColumnsStayWithinTheInspectorProposal() {
  for width in [0.0, 5, 300, 650, 707, 900, 1400] {
    for preferred in [-100.0, 320, 370, 520, 2000] {
      let columns = WorkspaceColumns(width: width, preferred: preferred)
      #expect(columns.compose >= 0)
      #expect(columns.takes >= 0)
      #expect(columns.compose <= 520)
      #expect(columns.compose + columns.takes + columns.divider == width)
      if width >= 387 { #expect(columns.takes >= 380) }
      if width >= 707 { #expect(columns.compose >= 320) }
    }
  }
}

@Test func workspaceColumnsPreserveThePreferredWidthWhenThereIsRoom() {
  #expect(WorkspaceColumns(width: 900, preferred: 370).compose == 370)
  #expect(WorkspaceColumns(width: 1400, preferred: 600).compose == 520)
  #expect(WorkspaceColumns(width: 900, preferred: 200).compose == 320)
  #expect(WorkspaceColumns(width: 650, preferred: 370).compose == 263)
}
