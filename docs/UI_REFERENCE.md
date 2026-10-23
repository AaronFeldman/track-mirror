# Track Mirror — Cross-Platform UI Reference

Date adopted: 2026-10-23

This document records the repository owner's approved reference interaction pattern for Track Mirror controls. It applies to Linux, Windows, macOS, Android, and iOS/iPadOS wherever the platform permits an equivalent implementation.

The approved visual reference came from the working Linux Spicetify proof of concept shown, tested, corrected, and approved in the Track Mirror project conversation on October 23, 2026. The executable legacy reference is `spicetify/track-mirror-playback.js`.

## Reference pattern

### Persistent entry point

The normal, unclicked control must be visible in ordinary application chrome rather than floating over content.

The canonical reference control is a **single clickable state glyph + Track Mirror label**:

- **▷ Track Mirror** means mirroring is OFF / ready but not active.
- **⇄ Track Mirror** means mirroring is ON / actively mirroring the selected source.

The glyph and text are one control and one click/tap target. The state symbol must not be visually detached from a separate hidden or adjacent clickable element.

The state glyph should be substantially more visually prominent than ordinary body text so the control announces itself as interactive. In the tested Linux Spicetify reference, the state glyph is approximately 26 px while the `Track Mirror` label remains ordinary compact control text. Other platforms may scale this proportionally to native density and accessibility settings rather than copying the pixel size mechanically.

The primary Track Mirror control must not be icon-only when the platform provides room for text. The words **Track Mirror** remain visible in the normal, unclicked state.

The glyph is a redundant status cue, not the sole way of understanding state. Explicit **Mirroring ON / Mirroring OFF** wording remains inside the quick-control surface.

### Quick-control surface

Activating the Track Mirror entry opens a compact modal, popover, sheet, or native equivalent containing the essential controls only:

1. **Track Mirror** as the visible title.
2. **Friend to mirror** / source selector.
3. A large, visually obvious **Mirroring ON / Mirroring OFF** control.
4. A short live status line describing the selected source and current state.
5. Brief helper text only when it reduces ambiguity.

The quick-control surface must not become a permanent overlay or obscure host-application content after the interaction is complete.

## Completion and dismissal behavior

Quick controls are action-oriented, not a settings form that requires a separate Save or Close step.

- Changes take effect immediately.
- The quick-control surface should dismiss itself when the user's intended interaction is complete.
- Pressing **Mirroring ON / Mirroring OFF** completes the interaction and should dismiss the surface automatically.
- If mirroring is already ON, selecting a different friend/source immediately retargets mirroring and completes the interaction, so the surface should dismiss automatically.
- If mirroring is OFF, selecting a friend/source should take effect immediately but the surface may remain open so the user can still press **Mirroring ON** without reopening Track Mirror.
- A short delay may be used so the user can perceive the changed state before dismissal.
- A visible X/close gesture may remain as a fallback, but ordinary use must not require it.
- Closing/dismissing the quick-control surface must never change mirroring state.
- Mirroring changes state only through the explicit **Mirroring ON / Mirroring OFF** control.

This distinction is mandatory because an X can reasonably be interpreted as dismissing Track Mirror itself rather than merely closing a transient panel.

## Non-obstruction rule

Track Mirror controls and diagnostics must not permanently cover Spotify controls, Spotify content, or Track Mirror content.

Do not use permanent floating overlays for normal user interaction. Diagnostic information belongs in logs, a dedicated diagnostics screen, or an on-demand surface.

## Platform adaptation

The visual structure and state meaning should be carried forward rather than copied mechanically.

### Linux / Windows / macOS

Preferred pattern:

- toolbar/top-bar/menu-bar/application-chrome entry showing the state glyph plus **Track Mirror** as one clickable control;
- **▷** communicates OFF and **⇄** communicates ON when the platform/font renders those glyphs clearly;
- the state glyph is deliberately prominent enough to read as part of an interactive control;
- click opens a compact popover/modal;
- friend/source selection and Mirroring ON/OFF live in that quick-control surface;
- completed interactions auto-dismiss the surface.

A system tray/status icon may be icon-only if the OS surface requires it, but the ordinary Track Mirror application/control surface must still expose the product name visibly and must provide an equivalent ON/OFF state cue.

### Android

Preferred pattern:

- app bar/header or primary quick-access surface visibly identifies **Track Mirror**;
- where a compact persistent control is shown, it should use the same OFF/ON meaning as **▷ Track Mirror** / **⇄ Track Mirror**, or the closest unambiguous native equivalent;
- the glyph/icon and label form one tap target rather than adjacent unrelated elements;
- quick control may use a bottom sheet, dialog, or compact screen appropriate to Android conventions;
- source selection and Mirroring ON/OFF take effect immediately;
- completed interactions close the quick-control surface automatically.

### iPhone / iPad

Preferred pattern:

- navigation/app header or primary quick-access surface visibly identifies **Track Mirror**;
- where a compact persistent control is shown, it should use the same OFF/ON meaning as **▷ Track Mirror** / **⇄ Track Mirror**, or the closest unambiguous Apple-platform equivalent;
- the glyph/icon and label form one tap target rather than adjacent unrelated elements;
- quick control may use a sheet, popover, or compact view appropriate to Apple platform conventions;
- source selection and Mirroring ON/OFF take effect immediately;
- completed interactions dismiss the quick-control surface automatically.

## Accessibility and clarity

The reference interaction is intentionally optimized for users who may not infer hidden UI conventions.

Required principles:

- visible product identity rather than icon-only identification;
- redundant state communication: prominent state glyph plus explicit ON/OFF wording in the quick controls;
- the visible glyph and label must belong to the actual clickable/tappable control;
- state symbols must be large enough to read as intentional interactive UI, not tiny decoration;
- large, explicit ON/OFF wording rather than ambiguous symbolic state alone;
- immediate action feedback;
- no unnecessary Save/Apply/Close step after a completed change sequence;
- no reliance on an X to complete the ordinary workflow;
- closing a panel is never equivalent to disabling Track Mirror;
- allow a natural multi-step sequence such as selecting a source and then turning mirroring ON without forcing the user to reopen the controls;
- concise language and predictable control placement;
- preserve usable host-app space.

## Reference implementation status

The legacy Spicetify proof of concept currently embodies the reference pattern most completely:

- **▷ Track Mirror** when mirroring is OFF;
- **⇄ Track Mirror** when mirroring is ON;
- an approximately 26 px state glyph paired with compact `Track Mirror` text;
- glyph and text contained inside the actual clickable top-bar button rather than displayed beside a hidden click target;
- compact Track Mirror modal;
- friend selector;
- prominent Mirroring ON/OFF control;
- state/status text;
- no permanent Track Mirror overlays;
- immediate application of changes;
- automatic dismissal after a completed quick-control interaction.

Future Track Mirror UI work should start from this reference. A platform-native equivalent may replace the exact Unicode glyphs or measurements only when it preserves the same state meaning, obvious click/tap affordance, visible Track Mirror identity, and accessibility goals.
