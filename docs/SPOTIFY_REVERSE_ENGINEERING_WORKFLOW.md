# Spotify Reverse-Engineering Workflow

Date adopted: 2026-10-23

## Repository-owner decision

The repository owner chose **REA (Reverse Engineer Anything)** as the preferred orchestration workflow for Spotify reverse-engineering research related to Track Mirror.

This is a repository-owner technical/research decision. AI assistance may be used to install/configure tools, design searches, interpret results, draft notes, and implement resulting Track Mirror code, but the decision to adopt this workflow is attributed to the repository owner.

## Preferred analysis order

The default investigation sequence is:

1. **REA** as the coordinating reverse-engineering environment/workflow.
2. **JADX first** for Android APK/DEX Java/Kotlin analysis because it is the fastest way to search and navigate Android framework callbacks, obfuscated application classes, strings, cross-references, intents, services, and MediaSession-related code.
3. **Ghidra selectively** when Java/Kotlin analysis crosses into JNI/native code, when behavior is implemented in native `.so` libraries, or when JADX cannot adequately explain a relevant code path.
4. Runtime validation with Android/ADB or a physical device only after static analysis has narrowed the question enough to justify the test.

The objective is not indiscriminate decompilation. Research should be narrowly tied to Track Mirror engineering questions, especially Android playback/control behavior.

## Current primary research question

The immediate MediaSession investigation is to determine how Spotify's Android client handles Android media-control callbacks and exact track identifiers, including whether its active session meaningfully supports any of the following:

- `MediaSession` / `MediaSessionCompat`;
- `MediaController.TransportControls.playFromUri()`;
- `onPlayFromUri()`;
- `playFromMediaId()` / `onPlayFromMediaId()`;
- `playFromSearch()` / related callbacks;
- `PlaybackState` advertised actions;
- `MediaBrowserService` or related service interfaces;
- Spotify URI/deep-link handling for exact `spotify:track:` identifiers;
- JNI/native playback handoff reached from those Android-layer entry points.

Static analysis findings are evidence about implementation structure; they do not by themselves prove runtime behavior. Material conclusions should be confirmed with a controlled emulator or physical-device test where practical.

## Research-material handling

Spotify application binaries and extracted material are third-party research inputs, not Track Mirror source code.

Accordingly:

- do **not** commit Spotify APKs, split APKs, DEX files, extracted native `.so` libraries, decompiled source trees, proprietary assets, or other Spotify binary/code material to the Track Mirror repository;
- do **not** redistribute Spotify binaries or decompiled Spotify code with Track Mirror;
- keep any local extraction/reverse-engineering workspace outside the distributable Track Mirror source tree, or under an explicitly ignored local research path;
- repository documentation may record narrowly necessary facts, method/class names, behavioral conclusions, hashes/version identifiers, test results, and short technical observations needed to reproduce or audit the research without embedding proprietary source material;
- keep Track Mirror implementation independently authored and based on observed interfaces/behavior rather than copying Spotify implementation code.

## Evidence discipline

For reverse-engineering conclusions, preserve a clear chain from question to evidence:

1. Spotify app version/build being examined;
2. exact APK/split/native component analyzed;
3. tool used (REA/JADX/Ghidra/ADB);
4. relevant class, method, callback, string, symbol, or call-chain location;
5. what the evidence supports;
6. what remains inference or unverified runtime behavior;
7. runtime test result, if performed.

This allows Track Mirror's engineering record to distinguish decompiled/static evidence, runtime observation, inference, and product decisions.

## Relationship to the Android MediaSession spike

This workflow supplements the `android-mediasession-spike` experiment. It does not silently replace the existing runtime spike code or the requirement for physical-device confirmation.

If reverse engineering indicates that Spotify does not implement a useful exact-track MediaSession callback, the result should guide the next experiment rather than forcing continued testing of an unsupported path. If static analysis suggests a viable MediaSession/deep-link/native handoff, the smallest possible runtime test should be used to confirm it.

## Provenance

The repository owner selected this REA-first workflow after considering direct Ghidra-based decompilation and a JADX-first manual approach. The adopted preference is:

**REA orchestration → JADX for Android/Dex analysis → Ghidra where native/JNI analysis is needed → controlled runtime confirmation.**

AI assistance may perform or assist with the subsequent research and implementation, but this tool/workflow selection is recorded as the repository owner's decision.
