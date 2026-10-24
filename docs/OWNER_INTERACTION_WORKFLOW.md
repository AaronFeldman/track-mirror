# Repository-Owner Interaction Workflow

Date adopted: 2026-10-24

## Repository-owner decision

The repository owner directed that interactive development time should be reserved primarily for substantive human decisions, including:

- product architecture;
- UI and UX design;
- product behavior and requirements;
- licensing and commercialization choices;
- launch/release strategy;
- major testing methodology choices;
- other decisions that materially shape Track Mirror.

Routine mechanical work should not consume repeated owner attention when it can reasonably be automated or batched. This includes repetitive terminal command driving, log collection, high-volume inspection output, environment inventory, static-analysis iteration, and similar evidence-gathering steps.

## Working rule

For mechanical research and implementation work:

1. Use the GitHub connection directly for repository inspection, documentation, public-source research support, scripts, and commits when appropriate.
2. Keep proprietary Spotify APKs, split APKs, extracted code, and other third-party research material outside Git.
3. When local private artifacts must be inspected, prefer one-command batch runners over repeated one-command-at-a-time interaction.
4. Redirect high-volume command output to files by default.
5. Package local research results into concise bundles that can be reviewed without requiring the repository owner to scroll through raw output.
6. Return to the repository owner when the evidence creates a substantive choice, such as selecting an architecture, accepting a product tradeoff, choosing a UI behavior, or deciding whether to adopt a technical path.

This workflow is intended to preserve the repository owner's attention for meaningful human authorship and direction while still maintaining a reproducible technical evidence trail.

## Provenance

This interaction/workflow preference is a repository-owner decision. The automation scripts, research runners, analysis, code, and prose used to implement the workflow may be AI-assisted and should be attributed separately rather than represented as independently human-authored implementation.
