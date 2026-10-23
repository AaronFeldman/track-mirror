# Track Mirror — Canonical Development Transcript

This is the canonical, human-readable development transcript for Track Mirror.

It exists so the project can be recovered and continued across ChatGPT sessions, devices, page resets, and development branches without depending on any one chat window.

## Transcript rules

- This file is **append-only in substance**. Existing historical entries should not be silently rewritten to change what happened.
- Each material development session should add a dated entry before the session is considered handed off.
- Entries should record: human decisions/instructions, implementation work, commands or tests that materially mattered, results, commits/branches/PRs, failures, unresolved issues, and the next concrete step.
- If text is copied exactly from a chat, label it **Verbatim**.
- If an entry is reconstructed from Git history, CI, project state, or another session, label it **Reconstructed**. Do not present reconstructed material as a verbatim chat transcript.
- `PROJECT_STATE.md` remains the concise canonical current-state record. This transcript is the chronological human-readable record of how that state was reached.
- `docs/DEVELOPMENT_HISTORY.md` remains the higher-level authorship/design history. This transcript is more granular and operational.
- The repository is public. Do **not** put passwords, API secrets, private tokens, client secrets, private legal/client information, or unrelated personal material in this transcript.
- Spotify client IDs and other values that are intentionally public application identifiers may be recorded only when needed, but secrets must never be recorded.
- When development occurs in more than one ChatGPT thread, the repository is the handoff mechanism. A receiving thread should read `PROJECT_STATE.md`, this file, and the active branch/PR before changing code.
- Prefer one active development thread at a time. When possible, use the same ChatGPT conversation from desktop and phone instead of starting a separate development conversation.

## 2026-10-23 — Canonical chat synchronization policy

**Verbatim user direction:**

> “can we simply synchronize the chat so we have one development chat? and in CLC style make sure we always have access to a human readable transcript going forward”

**Resulting workflow decision:**

- The current Track Mirror project conversation is treated as the primary development chat.
- On another device, the preferred workflow is to open this same conversation rather than create a parallel development thread.
- ChatGPT cannot literally merge or live-synchronize two already-separate chat threads. If a parallel thread is used, it must hand off through GitHub before development continues elsewhere.
- `PROJECT_STATE.md` plus this `DEVELOPMENT_TRANSCRIPT.md` form the CLC-style recovery pair: current state + chronological development record.
- Canonical filenames are used directly. Do not create `_LATEST`, `_FINAL`, `_RESTORED`, timestamped, or similar precautionary duplicates unless expressly requested.

## 2026-10-23 — Parallel phone-session handoff discovered

**Reconstructed from GitHub branch/PR/CI activity. This is not a verbatim phone-chat transcript.**

A separate phone development session created branch `desktop-native-playback` from `main` and opened PR #1, **“Add native desktop Spotify playback adapters.”**

The branch is four commits ahead of `main` at commit `33d3b3631bc3b0b56ac28850118e4c46dc2c2f42`.

Material changes on that branch:

- Added desktop playback command error handling.
- Implemented a desktop Spotify playback adapter inside the existing Rust/Tauri plugin boundary.
- Routed desktop `MirrorAction::PlayTrack` and `Pause` through the same playback adapter interface used by mobile.
- macOS path uses AppleScript to play an exact Spotify track URI and pause Spotify.
- Windows path opens an exact `spotify:track:` URI through the local Spotify URI handler.
- Linux path opens an exact Spotify track URI through `xdg-open`.
- Windows/Linux pause is explicitly not implemented yet rather than falsely reporting success.
- Added Windows and macOS compile-check jobs to GitHub Actions.

CI status observed during handoff:

- Framework-independent Rust core tests passed.
- macOS compile check failed because `src-tauri/icons/icon.png` was missing from the repository; the failure occurred in `tauri::generate_context!()` before testing the desktop adapter logic itself.
- Windows compile check failed because `src-tauri/icons/icon.ico` was missing from the repository; again, this was a Tauri packaging-resource failure before desktop adapter logic was validated.
- The Linux/Tauri check was still running at the time of the handoff inspection.

The branch/PR should not be treated as merged canonical code until its CI failures are addressed and it is deliberately merged into `main`.

## 2026-10-23 — Recovered phone-session product directions

**Recovered from the separate phone conversation and cross-checked against the repository history. The quoted line below is verbatim; the remaining points are faithful summaries of the recovered user direction, not invented quotations.**

**Verbatim user direction:**

> “Get working”

Substantive phone-session decisions/instructions recovered from that development thread:

- Preserve the already-working Linux/Spicetify Track Mirror path while developing the new Rust/Tauri architecture. It is a proven implementation and fallback/reference path, not something to break or discard merely because the cross-platform implementation is being developed.
- Do not make Spotify's Web API the primary playback-control route for Track Mirror. Prefer local/native control of the listener's own Spotify client, using exact Spotify track URIs where available, consistent with the original Track Mirror design.
- Keep one shared Rust `MirrorAction` decision engine and place platform-specific execution behind adapters rather than duplicating Track Mirror's baseline, filtering, duplicate suppression, or ordering logic per platform.
- Desktop work on the phone session therefore targeted local/native Spotify playback on macOS, Windows, and Linux rather than a Web API playback implementation.

These directions are repository-owner product/architecture decisions. AI assistance produced implementation code, CI changes, branch/PR organization, and explanatory prose.

## 2026-10-23 — Legacy Spicetify proof-of-concept framing and UI requirement

**Verbatim user directions:**

> “I want to keep the old version to use until we've developed the new Linux version”

> “By the way on the Linux version the controls for track mirror obscure some other parts of the UI it would be good if it didn't do that”

> “Make that a requirement in all the builds going forward”

> “Well use it as proof of concept”

Resulting product decisions:

- The existing Spicetify implementation is a working **proof of concept and temporary usable Linux version** while the new Linux Rust/Tauri implementation is developed.
- It is not the permanent Linux architecture. The replacement Linux build should use the same Rust-core / replaceable-adapter architecture as the other platforms.
- The working proof of concept must remain available and should not be broken merely because replacement development is underway.
- Across every Track Mirror build, controls must not permanently cover or obstruct Spotify/app content. Normal app chrome, an on-demand modal/popover/sheet, and a dedicated settings/status screen are preferred over permanent floating overlays.
- The legacy Spicetify control was therefore changed from a fixed overlay to a documented Spicetify top-bar button that opens a React-backed modal containing friend selection, mirroring ON/OFF, and status.
- The revised extension was syntax-checked with `node --check` before repository update.
- `docs/PRODUCT_REQUIREMENTS.md` now records these requirements independently of any one platform or toolkit.

## 2026-10-23 — Proof-of-concept UI update ready for use

The contained Spicetify UI work was reviewed as a branch-only change before integration. The branch changed only:

- `spicetify/track-mirror-playback.js`;
- `PROJECT_STATE.md`;
- `DEVELOPMENT_TRANSCRIPT.md`;
- `docs/PRODUCT_REQUIREMENTS.md`.

No Rust/Tauri desktop-adapter code was mixed into this legacy proof-of-concept update.

The code uses current documented Spicetify extension patterns: `Spicetify.Topbar.Button`, `Spicetify.PopupModal.display`, and `Spicetify.React` for modal content. The new UI removes the permanent fixed overlay, keeps the existing mirroring behavior, and moves quick controls behind an on-demand top-bar entry.

Repository integration does not by itself update the already-installed local Spicetify extension. The local proof-of-concept installation must still be refreshed from the repository and `spicetify apply` run before the new control layout is visible in Spotify.

## Current handoff point

- The legacy Spicetify build is the working proof of concept / temporary usable Linux version.
- The proof-of-concept UI is ready in the repository with non-obstructive top-bar/modal controls.
- PR #1 (`desktop-native-playback`) remains separate unmerged Rust/Tauri desktop work.
- Android/iOS Rust-to-native Spotify bridge work remains part of the shared next-generation architecture.
- The new Linux Rust/Tauri build is to be developed in parallel and eventually replace the proof of concept only after validation and repository-owner approval.
