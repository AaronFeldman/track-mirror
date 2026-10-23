# Development History

## Origin

Track Mirror began as an attempt to follow a friend's shared Spotify Listening Activity without starting a Jam. The desired behavior was to have one listener's Spotify session automatically follow another listener's currently playing tracks while preserving independent playback on the follower's own Spotify client.

## Proof-of-concept phase

The first working approach used the Spotify desktop client's Friend Activity panel on Linux. A local script (`~/.local/bin/follow-amanda`) combined desktop automation, image capture, OCR, and track-change detection to identify the selected friend's current track.

This phase demonstrated:

- Friend Activity could be observed continuously.
- Track changes could be detected in near real time.
- The detected song identity could be used as the basis for finding/playing the corresponding Spotify track.
- The experience is conceptually distinct from a Jam: the follower's own client performs playback.

## Product framing decisions

The project adopted the name **Track Mirror**.

The central design language was refined to describe the feature as **mirroring** rather than rebroadcasting. The project is intended to mirror track identity and playback state, not audio streams.

The repository owner specifically chose the architecture principle that the source listener's audio is never copied or relayed. The follower receives enough state to cause their own Spotify client to play the corresponding track.

## Architecture transition

OCR was accepted as a useful proof of concept but rejected as the preferred long-term architecture because it is fragile, screen-layout dependent, and awkward for general distribution.

The next direction became direct local Spotify-client integration, with Spicetify identified as a useful desktop integration path.

## Human-authored portability requirement

On October 22, 2026, the repository owner expressly directed that Track Mirror be designed with portability in mind across Linux, Windows 11, macOS, Android, and Apple mobile platforms. The current Linux/Spicetify implementation is therefore to be treated as one platform-specific adapter and test bed, not as the product's core architecture.

The repository owner's design requirement is that the core Track Mirror concepts remain platform-neutral: normalized source-listener state, track identity, playback state, timing/drift concepts, and mirroring logic should be separated from platform-specific source discovery, playback control, installation, filesystem paths, desktop automation, and UI integration.

This portability direction is a human product/architecture decision and should be preserved in the project record alongside other repository-owner decisions affecting the expressive structure, requirements, workflow, and design of Track Mirror.

## First successful live end-to-end mirroring test

On October 22, 2026, Track Mirror completed its first successful live end-to-end mirroring test without OCR and without using Spotify catalog search as the source of track identity.

The working path was:

1. The Spotify desktop client's **Listening activity** panel was detected in the rendered client DOM.
2. Track Mirror identified the selected friend, Amanda, and the visible track/artist text.
3. A nearby DOM probe discovered the exact embedded Spotify track URI (`spotify:track:...`) for the friend's activity row.
4. The playback layer was armed manually through the in-client mirroring control.
5. When Amanda's Listening Activity changed to a new track URI, Track Mirror detected the change and instructed the user's own Spotify client to play that URI.
6. The repository owner confirmed that the client switched tracks successfully.

This milestone is significant because it validates the core product behavior using metadata/state mirroring only: the source listener's audio was not copied, proxied, or rebroadcast. The follower's own Spotify client performed playback from the mirrored track identity.

A catalog-search approach was tested and abandoned for this path after Spotify returned HTTP 429 rate-limit responses. The successful architecture instead used the track URI already embedded in the local Spotify client DOM, avoiding OCR and avoiding repeated catalog searches.

## Selectable-friend control

After the first live test, the repository owner directed that the hard-coded Amanda target be replaced with a generic selectable-friend control. The playback extension was updated so the user can select among friends currently observed in Listening Activity, arm mirroring, and baseline the selected friend's current URI so stale activity is not immediately played.

This requirement is part of the repository owner's product design record rather than an implementation detail tied to one test account.

## Mobile-first next phase

On October 23, 2026, the repository owner expressly chose to make **Android and Apple phone versions the next development priority**, rather than spending the next phase primarily hardening the already-working desktop prototype.

That decision establishes Android and iOS/iPadOS as first-class product targets now, not merely future portability possibilities.

The resulting mobile design direction is:

- keep the existing Linux/Spicetify implementation as the proven desktop source/reference adapter;
- define one platform-neutral normalized mirror-event protocol;
- build Android and iOS/iPadOS follower/playback adapters around Spotify's supported App Remote SDKs;
- preserve the rule that the follower's own Spotify app performs playback;
- do not reintroduce catalog search when the source already provides an exact Spotify track URI;
- keep source observation, event transport, and follower playback independent so the same mobile apps can later consume a desktop-observed source, a cooperative Track Mirror source, or a future supported Spotify source mechanism.

Current Spotify developer interfaces do not expose another arbitrary friend's live Listening Activity to a mobile third-party app. Therefore the first mobile milestone was initially framed around the follower side: accept an exact Track Mirror event and prove playback through Spotify App Remote.

This mobile prioritization, the separation between source observation and mobile playback, and the requirement to use one shared event model are repository-owner product/architecture decisions. AI assistance is being used to research Spotify's current interfaces and to draft/implement the resulting code and documentation.

## Rust-first unified cross-platform decision

Later on October 23, 2026, before separate Android and iOS implementations progressed far, the repository owner asked whether Track Mirror should adopt a more unified codebase that also accounts for Windows 11 and desktop macOS.

After comparing Tauri/Rust and Kotlin/Compose Multiplatform, including toolkit licensing and long-term project-survival considerations, the repository owner stated a preference for Rust and directed development to proceed.

The resulting repository-owner architecture direction is:

- **Rust is the canonical language for portable Track Mirror state, protocol, synchronization, and mirroring-decision logic.**
- **Tauri 2 is the initial cross-platform application shell, but must remain replaceable.**
- The core must remain an ordinary Rust library with no Tauri, Spotify SDK, WebView, Kotlin, Swift, or operating-system dependency.
- Kotlin and Swift remain appropriate for thin native Spotify/mobile bridges where the platform SDK requires them.
- Windows 11 and macOS are included in architectural planning now, rather than being deferred until after separate mobile applications are built.
- Existing Android and iOS experiments are to be treated as adapter prototypes that can be folded into the common architecture rather than separate homes for Track Mirror's core behavior.
- The architecture should preserve a credible escape path if Tauri is someday replaced: the Rust core should survive without rewrite and can later be called from another shell or native bindings.

This is a repository-owner product and architecture decision. The specific Rust implementation, Tauri scaffold, tests, UI code, and explanatory prose are being produced with AI assistance and should not be mischaracterized as independently human-authored code.

## First Rust implementation milestone

The first Rust-first scaffold created:

- a root Cargo workspace;
- `crates/track-mirror-core` as a framework-independent Rust crate;
- the first shared mirror engine preserving baseline-on-arm, selected-listener filtering, exact-URI play decisions, pause actions, and duplicate/out-of-order suppression;
- unit tests for those behaviors;
- `src-tauri` as a thin command bridge around the Rust core;
- a deliberately minimal framework-free shared UI under `ui/`;
- `docs/RUST_FIRST_ARCHITECTURE.md` to lock down the core/adapter boundary;
- GitHub Actions to run the Rust core test suite on relevant repository changes.

The implementation deliberately does not place Spotify-specific playback code in the Rust core. Platform adapters consume `MirrorAction` decisions and translate them into the appropriate Spotify/native calls.

## First Rust-to-native mobile playback bridge

On October 23, 2026, development moved from separate mobile adapter prototypes to a common Tauri mobile plugin boundary driven by the Rust mirror engine.

The implementation added `plugins/spotify-playback`, a Tauri plugin whose Rust side exposes one platform-identical playback contract while Android and iOS perform only the native Spotify operations that cannot live in the framework-independent core.

The resulting flow is:

1. a normalized `MirrorEvent` enters the Rust `MirrorEngine`;
2. Rust alone decides whether the event is `Ignored`, establishes a `Baseline`, produces `PlayTrack`, or produces `Pause`;
3. `Ignored` and `Baseline` cause no Spotify call;
4. `PlayTrack` and `Pause` are dispatched through the Rust plugin boundary;
5. Kotlin on Android or Swift on iOS executes the corresponding Spotify App Remote command in the follower's own Spotify app.

This preserves baseline-on-arm, selected-listener filtering, event ordering, and duplicate suppression in one Rust implementation rather than duplicating those rules in Kotlin and Swift.

The Android adapter uses Spotify Android App Remote and a reproducible fetch script for Spotify's official App Remote binary. The binary itself is excluded from the repository and remains clearly identified as third-party Spotify material.

The iOS adapter uses Spotify iOS App Remote and the `trackmirror://spotify-callback` scheme for the authorization return path. If Spotify must be awakened, the adapter uses Spotify's own authorization/play mechanism for the exact mirrored URI; the Swift layer does not independently decide what track should be mirrored.

The shared development UI was also changed so a manually injected event follows the complete Rust decision path and, on mobile, can reach the native Spotify adapter. The first post-arm event still establishes a baseline; a subsequent changed exact URI is the event intended to prove native playback on device.

This is an implementation milestone, not yet a device-validation milestone. At this point the Rust/Tauri bridge is being compile-checked in repository CI, but Android and iOS native builds and real-device Spotify playback still require platform-specific build/test environments.

The code and implementation prose in this milestone were produced with AI assistance. The repository owner's human contribution being preserved here is the product concept and the architecture direction that Track Mirror use one Rust decision engine, a replaceable cross-platform shell, and thin native adapters rather than separate platform-specific implementations of the mirroring rules.

## Standing repository-owner provenance rule

On October 23, 2026, the repository owner expressly directed that Track Mirror take every reasonable opportunity to preserve the repository owner's material decisions as such in the project record.

Accordingly, material repository-owner decisions about product behavior, architecture, UX, accessibility, licensing, commercialization, launch strategy, testing methodology, workflow, platform priorities, naming, and similar project direction should be recorded explicitly and contemporaneously when practical. The record should identify them as repository-owner decisions rather than allowing them to disappear into implementation history.

This rule does not mean every incidental command, typo correction, or low-level implementation detail is treated as a human-authored design contribution. The provenance record should focus on substantive choices that shape what Track Mirror is, how it behaves, how it is distributed, or how development is directed.

AI-assisted research, analysis, coding, drafting, documentation, and implementation should continue to be identified separately and should not be misrepresented as independently human-authored material. When a substantive owner decision leads to AI-assisted implementation, the project record should preserve both sides of that distinction.

## Authorship and provenance

The product concept, requested behavior, terminology, functional requirements, architectural constraints, portability requirements, mobile-priority decision, Rust preference, framework-independence requirement, and iterative design choices were supplied and directed by the repository owner. AI assistance is being used as a development tool for drafting, research, organization, and implementation support.

This record should be updated when material product decisions, architecture changes, experiments, or implementation milestones occur. The record should distinguish repository-owner decisions and contributions from AI-generated implementation or prose, rather than overstating human authorship of material produced by AI assistance.
