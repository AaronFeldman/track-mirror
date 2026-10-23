# Track Mirror — Product Requirements

These requirements apply across Linux, Windows, macOS, Android, and iOS/iPadOS unless the repository owner expressly changes them.

The approved cross-platform visual/interaction reference is documented in `docs/UI_REFERENCE.md` and should be carried forward wherever platform conventions permit.

## Non-obstructive controls

Track Mirror controls must not permanently obscure Spotify controls, Spotify content, or Track Mirror content.

Preferred UI hierarchy:

1. A small persistent control/status surface in normal application chrome when the platform supports it (for example a top bar, menu bar, tray/menu item, toolbar, or app bar).
2. An on-demand modal, popover, sheet, or equivalent for quick controls such as source/friend selection and mirroring ON/OFF.
3. A dedicated Track Mirror screen/window for detailed status, configuration, diagnostics, device pairing, history, timing/drift information, and other expanded functions.

Permanent floating overlays that cover host-application content are not acceptable as the normal finished UI. A temporary overlay may be used only for debugging or an explicitly temporary experiment.

The requirement is functional, not tied to one toolkit: each platform should use its native or framework-appropriate equivalent while preserving unobstructed usable space.

## Visible Track Mirror identity

The primary Track Mirror control or application surface must visibly identify itself with the text **“Track Mirror”** in its normal, unclicked, non-hovered state.

An icon may accompany the name, but an icon alone is not sufficient for the primary Track Mirror control.

Platform expectations:

- Linux, Windows, and macOS desktop builds: the normal toolbar/top-bar/menu-bar application control should visibly include **Track Mirror** wherever the platform permits text in that control.
- Android and iOS/iPadOS builds: the normal app header, app bar, or equivalent primary control surface should visibly include **Track Mirror** without requiring a tap, long-press, or hover-equivalent interaction.
- Compact operating-system surfaces that inherently allow icons only, such as some tray/status areas, may use an icon there, but the ordinary Track Mirror application/control surface must still provide the visible text identity.

This requirement exists so the user can immediately recognize what the control belongs to without guessing the meaning of an icon.

## Self-dismissing quick controls

This is a mandatory cross-platform interaction requirement.

Track Mirror quick-control dialogs, popovers, and sheets must not require the user to press an **X**, Close, Save, Apply, or equivalent merely to finish an ordinary source-selection or mirroring-state workflow.

Changes take effect immediately, and the quick-control surface should dismiss itself when the user's intended interaction is complete.

The interface must make a strong distinction between **closing the controls** and **turning Track Mirror off**:

- closing or dismissing a dialog does not disable mirroring;
- mirroring changes state only through the explicit **Mirroring ON / Mirroring OFF** control;
- selecting a new friend/source takes effect immediately;
- if mirroring is already ON, choosing a new friend/source completes the interaction and should dismiss the quick-control surface automatically after a brief confirmation interval;
- if mirroring is OFF, choosing a friend/source may leave the quick-control surface open so the user can turn mirroring ON without reopening Track Mirror;
- pressing the explicit **Mirroring ON / Mirroring OFF** control completes the interaction and should dismiss the quick-control surface automatically;
- a short delay may be used so the user can perceive the resulting state before dismissal;
- a visible close control may remain as a fallback, but it must not be required in the ordinary workflow;
- no user should need to infer whether an X means “close this panel” or “turn Track Mirror off.”

This is an accessibility/usability requirement and applies to phone, tablet, and desktop implementations.

## Legacy Linux Spicetify proof of concept

The existing Spicetify implementation is a **working proof of concept and temporary usable Linux version**. It is retained so the repository owner can continue using Track Mirror while the new Linux Rust/Tauri implementation is developed and validated.

It is not the permanent Linux architecture.

The proof-of-concept implementation remains valuable as:

- evidence that the Track Mirror product concept works end to end;
- a reference for friend/source discovery and exact Spotify track-URI recovery;
- a temporary daily-use Linux implementation;
- a fallback/reference implementation during development of the replacement Linux build;
- the current approved reference for the compact Track Mirror control interaction described in `docs/UI_REFERENCE.md`.

The new Linux implementation should use the same Rust-core / replaceable-adapter architecture as the other supported platforms rather than inheriting Spicetify as a permanent architectural dependency.

Do not remove or break the working Spicetify proof of concept merely because the replacement exists in development. Cutover to the new Linux version should occur only after the replacement reproduces the needed functionality reliably and the repository owner approves the transition.

## Shared product behavior

Across all builds:

- mirror track identity/playback state, not Spotify audio;
- the follower's own Spotify client performs playback;
- preserve baseline-on-arm behavior so stale current activity is not immediately played;
- keep source selection, duplicate suppression, ordering, and other mirroring policy centralized in the Rust core where applicable;
- keep platform-specific source/playback mechanics behind adapters;
- preserve rollback/recovery paths for integrations that modify or wrap local Spotify behavior;
- prefer exact Spotify track identifiers already available from source state over repeated catalog search when practical;
- follow the approved Track Mirror UI reference and self-dismissing quick-control behavior wherever platform conventions allow.
