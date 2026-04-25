# OpenLoop x OpenKara Sibling Product Design

## Goal

Make OpenLoop feel like a direct sibling product of OpenKara by reusing the same product shell, visual tokens, settings surface, onboarding rhythm, bootstrap status expression, and native menu structure while keeping OpenLoop-specific generation workflows in the main content area.

## Design Decision

We will use **strict shell reuse**.

That means OpenLoop should stop evolving its own separate shell language (`AppShell`, modal settings, standalone setup card, custom gradients) and instead adopt the same shell primitives that define OpenKara:

- window chrome / toolbar framing
- sidebar rail geometry and tokens
- main-content layering
- full-screen settings overlay pattern
- bootstrap banner pattern for model/backend readiness
- setup wizard rhythm and card language
- native menu event contract

The products should differ in workflow, not in product identity.

## Shared Product Surfaces

### 1. Shell and chrome

OpenLoop should use the same visual shell system as OpenKara:

- `WindowChrome` / `Toolbar` style top bar
- `SidebarRail` behavior and width tokens
- shared window-shell CSS variables
- same dark surface palette and motion language

OpenLoop-specific content will sit inside that shell rather than redefining the shell itself.

### 2. Sidebar

OpenLoop's left column maps to the same product role as OpenKara's library sidebar.

It should contain:

- generation history
- search / filter controls
- quick batch or utility actions relevant to generation history

It should not look like a different app. The layout, spacing, radii, and selection states should reuse OpenKara's sidebar system.

### 3. Main content

OpenLoop's center stage replaces OpenKara's playback stage with a generation workspace:

- prompt and lyrics entry
- generation controls
- in-flight task state
- result summary

The frame, padding, banner placement, and overall hierarchy should still read as the same family.

### 4. Preview / bottom controls

OpenLoop's preview player and export actions should occupy the same product role that OpenKara's playback controls occupy: a persistent, polished control surface attached to the shell rather than an isolated card.

### 5. Settings

OpenLoop should replace its standalone modal with an OpenKara-style overlay made of section cards.

OpenLoop sections should include:

- Models & Backend
- Generation Defaults
- General
- Danger Zone

The visual treatment, close affordance, spacing, section cards, and confirmation dialog style should match OpenKara.

### 6. Onboarding / setup

OpenLoop does not need library registration, but it should keep the same onboarding cadence as OpenKara:

1. Welcome / introduction
2. Device check
3. Model/backend preparation
4. Local paths / defaults
5. Completion

It should look like the same setup language, only with generation-specific content.

### 7. Bootstrap / model readiness

OpenLoop should use the same top-of-main-content status treatment as OpenKara's `ModelBootstrapBanner`.

In OpenLoop this banner represents the readiness of the local generation stack:

- model required
- downloading / preparing
- outdated
- failed
- ready

### 8. Native menu bar

OpenLoop should add the same style of native menu integration as OpenKara.

The event contract should mirror OpenKara's pattern, but with OpenLoop actions:

- open settings
- open setup
- toggle sidebar
- reveal output folder
- start a new generation

## Explicit Non-Goals

- Do not import OpenKara's karaoke-specific workflow into OpenLoop.
- Do not add library management to OpenLoop.
- Do not keep OpenLoop's current shell styling as a parallel system.
- Do not solve this with surface-level CSS tweaks alone.

## Outcome

After this refactor, a user should immediately recognize OpenLoop and OpenKara as products from the same line: same shell, same discipline, same settings and setup grammar — different core workflow.
