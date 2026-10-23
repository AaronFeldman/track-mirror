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

The user specifically chose the architecture principle that the source listener's audio is never copied or relayed. The follower receives enough state to cause their own Spotify client to play the corresponding track.

## Architecture transition

OCR was accepted as a useful proof of concept but rejected as the preferred long-term architecture because it is fragile, screen-layout dependent, and awkward for general distribution.

The next direction is direct local Spotify-client integration, with Spicetify identified as a promising avenue to investigate because it can extend the Spotify desktop client and is open source.

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
- build native Android and iOS/iPadOS follower/playback adapters around Spotify's supported App Remote SDKs;
- preserve the rule that the follower's own Spotify app performs playback;
- do not reintroduce catalog search when the source already provides an exact Spotify track URI;
- keep source observation, event transport, and follower playback independent so the same mobile apps can later consume a desktop-observed source, a cooperative Track Mirror source, or a future supported Spotify source mechanism.

Current Spotify developer interfaces do not expose another arbitrary friend's live Listening Activity to a mobile third-party app. Therefore the first mobile milestone is deliberately the follower side: accept an exact Track Mirror event and prove native playback through Spotify App Remote. Transport from the existing desktop source adapter follows after native playback is validated.

This mobile prioritization, the separation between source observation and mobile playback, and the requirement to use one shared event model are repository-owner product/architecture decisions. AI assistance is being used to research Spotify's current interfaces and to draft/implement the resulting code and documentation.

## Authorship and provenance

The product concept, requested behavior, terminology, functional requirements, architectural constraints, portability requirements, mobile-priority decision, and iterative design choices were supplied and directed by the repository owner. AI assistance is being used as a development tool for drafting, research, organization, and implementation support.

This record should be updated when material product decisions, architecture changes, experiments, or implementation milestones occur. The record should distinguish repository-owner decisions and contributions from AI-generated implementation or prose, rather than overstating human authorship of material produced by AI assistance.
