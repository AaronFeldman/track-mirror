# KDE Connect Remote-Control Validation

Date: 2026-10-25

## Repository-owner clarification

The repository owner clarified that **KDE Connect is a personal convenience/test harness, not a Track Mirror product dependency or intended shipping user interface**.

Its value to the project is the information learned from the experiment: an external lightweight controller can successfully change the authoritative Track Mirror follow state on the desktop without duplicating Spotify source-observation or playback logic on the controller device.

This distinction is a repository-owner product/architecture decision. The implementation and this explanatory prose were produced with AI assistance.

## What was validated

Using KDE Connect Run Commands as the temporary external client, the live Spicetify proof of concept successfully accepted remote commands through the Track Mirror local control path:

```text
KDE Connect test client
  -> Track Mirror local control server
  -> loopback Spicetify bridge
  -> TrackMirrorPlayback
  -> selected friend / mirroring ON-OFF
```

The following behaviors were confirmed on the live desktop implementation:

- remote command can stop mirroring;
- remote command can select Amanda and enable mirroring;
- remote command can select Solomon and enable mirroring;
- the command changes the same `TrackMirrorPlayback` state used by the Spotify-window Track Mirror UI rather than launching a parallel follower process;
- the remote-control server can run independently as a persistent per-user service;
- the controller does not need Spotify credentials and does not carry Spotify audio;
- the controller can remain very thin because the desktop remains authoritative for source observation and follow state.

## Architectural information learned

The KDE Connect experiment materially strengthens the lightweight-controller architecture:

1. **The control plane is separable from the source-observation implementation.** The controller only needs semantic commands such as follow a named source or stop following.
2. **The desktop can remain authoritative.** A phone does not need to reproduce the Spicetify/desktop capture stack to control an active Track Mirror session.
3. **Remote UI can be replaceable.** KDE Connect, a browser UI, and a future native Android/iOS controller can all drive the same host-side state model.
4. **State synchronization matters.** Controlling an old external `follow-friend` process did not update the Spotify-window UI; controlling `TrackMirrorPlayback` through the bridge did. Future transports must target the canonical Track Mirror state, not a parallel process.
5. **Host lifecycle should be independent of Spotify launch commands.** The local control server works better as a persistent user service than as a transient child of `spotify-launcher`.
6. **The remote client can be much smaller than the full mobile application.** This validates the owner's earlier decision to prioritize a lightweight phone controller before completing the full mobile mirroring stack.

## Non-product status of KDE Connect

KDE Connect itself should not be treated as a Track Mirror requirement, bundled dependency, or public user-facing remote-control solution. It is retained as a useful owner-only test mechanism and as evidence that the external-controller architecture works.

The product-facing remote controller should preserve the same semantics while using a Track Mirror-owned UI and transport appropriate for Android, iOS/iPadOS, and other remote clients.
