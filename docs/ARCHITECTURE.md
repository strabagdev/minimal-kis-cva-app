# Pulseframe Architecture

Pulseframe is organized around two user-facing areas.

## Pattern Studio

Pattern Studio answers: "How does this groove sound?"

A pattern is a complete groove. It owns:

- Track patterns
- Pattern length per track
- PF Instrument settings
- Mixer settings

Current implementation note: internally, patterns are stored in `song.snapshots` for continuity with the previous refactor. The UI treats them only as Patterns.

## Arrangement

Arrangement answers: "How does this groove evolve?"

The arrangement is a draggable sequence of song blocks. Each block points to an existing pattern and has its own duration.

Repeating a pattern in the arrangement does not clone its pattern data. Editing that pattern updates every song block that references it.

## State

Zustand is the source of truth.

Core state:

- `song.tracks`
- `song.patterns`
- `song.snapshots` as internal pattern records
- `song.arrangementBlocks`
- `song.selectedSnapshotId` as selected pattern
- `song.selectedArrangementBlockId`

Tone.Transport remains stable. It reads the current selected pattern from the live Zustand-synchronized song state.
