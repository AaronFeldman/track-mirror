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

## Authorship and provenance

The product concept, requested behavior, terminology, functional requirements, architectural constraints, portability requirements, and iterative design choices were supplied and directed by the repository owner. AI assistance is being used as a development tool for drafting, research, organization, and implementation support.

This record should be updated when material product decisions, architecture changes, experiments, or implementation milestones occur. The record should distinguish repository-owner decisions and contributions from AI-generated implementation or prose, rather than overstating human authorship of material produced by AI assistance.
