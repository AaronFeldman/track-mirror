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

The immediate MediaSession investigation is to determine why Spotify can advertise Android play-from-URI capability while an external exact-track request can still fail, and what standard Android path Spotify does honor for exact selection.

Relevant surfaces include:

- `MediaSession` / `MediaSessionCompat`;
- `MediaController.TransportControls.playFromUri()`;
- `onPlayFromUri()`;
- `prepareFromUri()` / `onPrepareFromUri()`;
- `playFromMediaId()` / `onPlayFromMediaId()`;
- `playFromSearch()` / `onPlayFromSearch()`;
- `PlaybackState` advertised actions;
- `MediaBrowserService` or related service interfaces;
- Spotify URI/deep-link handling for exact `spotify:track:` identifiers;
- `ACTION_VIEW` handlers for `spotify:` and `open.spotify.com` track links;
- JNI/native playback handoff reached from those Android-layer entry points.

Static analysis findings are evidence about implementation structure; they do not by themselves prove runtime behavior. Material conclusions should be confirmed with a controlled emulator or physical-device test where practical.

## First-pass REA/JADX query plan

Once the exact installed Spotify APK/splits have been captured and hashed, use a narrow evidence-first sequence rather than decompiling everything manually.

### Phase A — package and component inventory

1. `inspect-android-package` on the base APK.
2. Record package/version/SDK facts and relevant exported activities/services/receivers.
3. Search manifest/component names for:
   - `MediaBrowserService`;
   - `MediaSession`;
   - `MediaButton`;
   - `android.intent.action.VIEW`;
   - `spotify` scheme handlers;
   - `open.spotify.com` app-link handlers.
4. Preserve the APK SHA-256 and REA evidence IDs before moving to method-level inspection.

### Phase B — MediaSession callback path

Search classes/methods and trace references for these names/strings, allowing for aliases/obfuscation:

- `onPlayFromUri`;
- `playFromUri`;
- `onPrepareFromUri`;
- `prepareFromUri`;
- `ACTION_PLAY_FROM_URI`;
- `ACTION_PREPARE_FROM_URI`;
- `onPlayFromMediaId`;
- `playFromMediaId`;
- `ACTION_PLAY_FROM_MEDIA_ID`;
- `onPlayFromSearch`;
- `playFromSearch`;
- `ACTION_PLAY_FROM_SEARCH`.

For each match, trace incoming and outgoing references far enough to answer:

1. Does Spotify actually override/consume the callback?
2. Does the callback reach a common playback dispatcher or stop at a stub/compatibility layer?
3. Is the incoming URI/query validated or rewritten?
4. Are caller identity, account state, session type, feature flags, foreground state, product type or context checked?
5. Does an advertised action originate in shared framework code even when the phone playback path later refuses the operation?

### Phase C — exact Spotify identifier handling

Search for:

- `spotify:track:`;
- `spotify:album:`;
- `spotify:playlist:`;
- `spotify:`;
- `open.spotify.com/track`;
- URI parsing/normalization classes reached from the callback paths;
- resource/type enums or parsers that distinguish track/album/playlist/artist.

Compare how an exact `spotify:track:` identifier flows through:

- MediaSession URI callback;
- MediaSession search callback;
- deep-link/activity handler;
- any internal playback/navigation dispatcher.

The central question is whether the deep-link path reaches a privileged/internal selection mechanism that the MediaSession URI callback does not.

### Phase D — search behavior

Inspect `onPlayFromSearch` enough to determine:

- whether a raw `spotify:track:<id>` query is recognized as a resource identifier;
- whether structured Android media-search extras are consumed;
- whether title/artist search is best-match only;
- whether search playback requires foreground/UI state or can complete entirely through the session.

This directly informs the experimental Track Mirror command `playFromSearch("spotify:track:<id>", null)`.

### Phase E — native/JNI boundary

Only move to Ghidra when a relevant managed method reaches a native declaration/JNI bridge or when the Java/Kotlin path ends before the decisive validation/dispatch logic.

At that point record:

- Java/Kotlin native declaration;
- owning class and DEX descriptor;
- native library loaded by that path;
- JNI symbol/registration evidence;
- smallest call chain needed to explain the Android-facing behavior.

Do not broadly reverse engineer Spotify's audio engine when the question can be answered at the Android/JNI boundary.

## Runtime confirmation matrix

Any static conclusion should be tested with the smallest corresponding runtime probe. Current experimental order:

1. reproduce `playFromUri(spotify:track:<id>)` once and verify resulting `MEDIA_ID`;
2. test `playFromSearch("spotify:track:<id>", null)` and verify exact `MEDIA_ID`;
3. test name-based `playFromSearch` only as a fallback and verify whether the exact intended URI was selected;
4. test targeted Spotify `ACTION_VIEW` exact-track deep linking and verify resulting `MEDIA_ID` plus foreground/task behavior;
5. if deep linking selects correctly, test a hybrid exact-link selection + MediaSession state/transport flow.

**Command dispatch is never success by itself.** For exact-track selection, the preferred proof is Spotify's post-command `MediaMetadata.METADATA_KEY_MEDIA_ID` equaling the requested `spotify:track:<id>`.

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

## Legal / contractual caution

This workflow is an engineering/research choice, not a conclusion that decompiling Spotify is contractually permitted. Spotify's current terms/guidelines contain reverse-engineering restrictions subject to applicable-law exceptions. Interoperability exceptions under applicable law can be fact-specific.

Accordingly:

- treat Spotify reverse engineering as interoperability research subject to separate legal review;
- prefer standard Android interfaces, public documentation and independent black-box behavior where they answer the question;
- use decompilation to understand interface behavior/gating rather than to copy Spotify implementation expression;
- do not make release/compliance claims solely from this engineering workflow.

## Relationship to the Android MediaSession spike

This workflow supplements the `android-mediasession-spike` experiment. It does not silently replace the existing runtime spike code or the requirement for physical-device confirmation.

If reverse engineering indicates that Spotify does not implement a useful exact-track MediaSession callback, the result should guide the next experiment rather than forcing continued testing of an unsupported path. If static analysis suggests a viable MediaSession/deep-link/native handoff, the smallest possible runtime test should be used to confirm it.

## Provenance

The repository owner selected this REA-first workflow after considering direct Ghidra-based decompilation and a JADX-first manual approach. The adopted preference is:

**REA orchestration → JADX for Android/Dex analysis → Ghidra where native/JNI analysis is needed → controlled runtime confirmation.**

AI assistance may perform or assist with the subsequent research and implementation, but this tool/workflow selection is recorded as the repository owner's decision.
