# Track Mirror — Cross-Platform UI Reference

Date adopted: 2026-10-23

This document records the repository owner's approved reference interaction pattern for Track Mirror controls. It applies to Linux, Windows, macOS, Android, and iOS/iPadOS wherever the platform permits an equivalent implementation.

The approved visual reference came from the working Linux Spicetify proof of concept shown and approved in the Track Mirror project conversation on October 23, 2026. The executable legacy reference is `spicetify/track-mirror-playback.js`.

## Reference pattern

### Persistent entry point

The normal, unclicked control must be visible in ordinary application chrome rather than floating over content.

It should show:

- a compact Track Mirror icon/action glyph where appropriate; and
- the visible text **Track Mirror** without requiring hover, long-press, or a prior click.

The primary Track Mirror control must not be icon-only when the platform provides room for text.

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
- Selecting a friend/source is itself a completed action and should dismiss the quick-control surface automatically.
- Pressing **Mirroring ON / Mirroring OFF** is a completed action and should dismiss the quick-control surface automatically.
- A short delay may be used so the user can perceive the changed state before dismissal.
- A visible X/close gesture may remain as a fallback, but ordinary use must not require it.
- Closing/dismissing the quick-control surface must never change mirroring state.
- Mirroring changes state only through the explicit **Mirroring ON / Mirroring OFF** control.

This distinction is mandatory because an X can reasonably be interpreted as dismissing Track Mirror itself rather than merely closing a transient panel.

## Non-obstruction rule

Track Mirror controls and diagnostics must not permanently cover Spotify controls, Spotify content, or Track Mirror content.

Do not use permanent floating overlays for normal user interaction. Diagnostic information belongs in logs, a dedicated diagnostics screen, or an on-demand surface.

## Platform adaptation

The visual structure should be carried forward rather than copied mechanically.

### Linux / Windows / macOS

Preferred pattern:

- toolbar/top-bar/menu-bar/application-chrome entry showing **Track Mirror**;
- click opens a compact popover/modal;
- friend/source selection and Mirroring ON/OFF live in that quick-control surface;
- completed actions auto-dismiss the surface.

A system tray/status icon may be icon-only if the OS surface requires it, but the ordinary Track Mirror application/control surface must still expose the product name visibly.

### Android

Preferred pattern:

- app bar/header visibly identifies **Track Mirror**;
- quick control may use a bottom sheet, dialog, or compact screen appropriate to Android conventions;
- source selection and Mirroring ON/OFF take effect immediately;
- completed actions close the quick-control surface automatically.

### iPhone / iPad

Preferred pattern:

- navigation/app header visibly identifies **Track Mirror**;
- quick control may use a sheet, popover, or compact view appropriate to Apple platform conventions;
- source selection and Mirroring ON/OFF take effect immediately;
- completed actions dismiss the quick-control surface automatically.

## Accessibility and clarity

The reference interaction is intentionally optimized for users who may not infer hidden UI conventions.

Required principles:

- visible product identity rather than icon-only identification;
- large, explicit ON/OFF wording rather than ambiguous symbolic state;
- immediate action feedback;
- no unnecessary Save/Apply/Close step after a simple change;
- no reliance on an X to complete the ordinary workflow;
- closing a panel is never equivalent to disabling Track Mirror;
- concise language and predictable control placement;
- preserve usable host-app space.

## Reference implementation status

The legacy Spicetify proof of concept currently embodies the reference pattern most completely:

- visible play glyph plus **Track Mirror** in Spotify's top bar;
- compact Track Mirror modal;
- friend selector;
- prominent Mirroring ON/OFF control;
- state/status text;
- no permanent Track Mirror overlays;
- immediate application of changes;
- automatic dismissal after a completed quick action.

Future Track Mirror UI work should start from this reference unless a platform-native convention provides a clearly better implementation of the same usability requirements.
