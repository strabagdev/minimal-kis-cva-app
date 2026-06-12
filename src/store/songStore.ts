import { create } from "zustand";
import type { ActiveView, ArrangementBlock, PatternBank, Snapshot, Song, Track, TrackId, TrackPattern } from "../types/song";

const stepCount = 16;
const defaultPatternLength = 16;
const patternLengthOptions = [16, 32, 48, 64, 128];

const tracks: Track[] = [
  {
    id: "kick",
    name: "PF Kick",
    color: "#f26d5b",
    level: 0.9,
    volume: 88,
    mute: false,
    solo: false,
    patternLength: defaultPatternLength,
    sound: { tone: 48, decay: 58, drive: 42, filter: 64 },
  },
  {
    id: "bass",
    name: "PF Bass",
    color: "#b9e769",
    level: 0.76,
    volume: 76,
    mute: false,
    solo: false,
    patternLength: defaultPatternLength,
    sound: { tone: 42, decay: 38, drive: 36, filter: 44 },
  },
  {
    id: "closedHat",
    name: "PF Hat",
    color: "#f7d66b",
    level: 0.58,
    volume: 58,
    mute: false,
    solo: false,
    patternLength: defaultPatternLength,
    sound: { tone: 72, decay: 18, drive: 18, filter: 82 },
  },
  {
    id: "openHat",
    name: "PF Open Hat",
    color: "#7fd6c2",
    level: 0.5,
    volume: 50,
    mute: false,
    solo: false,
    patternLength: defaultPatternLength,
    sound: { tone: 68, decay: 54, drive: 14, filter: 76 },
  },
  {
    id: "perc",
    name: "PF Perc",
    color: "#8aa7ff",
    level: 0.54,
    volume: 54,
    mute: false,
    solo: false,
    patternLength: defaultPatternLength,
    sound: { tone: 56, decay: 28, drive: 32, filter: 62 },
  },
  {
    id: "stab",
    name: "PF Stab",
    color: "#d797ff",
    level: 0.42,
    volume: 42,
    mute: false,
    solo: false,
    patternLength: defaultPatternLength,
    sound: { tone: 52, decay: 42, drive: 24, filter: 58 },
  },
  {
    id: "texture",
    name: "PF Texture",
    color: "#9ca3af",
    level: 0.36,
    volume: 36,
    mute: false,
    solo: false,
    patternLength: defaultPatternLength,
    sound: { tone: 44, decay: 72, drive: 12, filter: 46 },
  },
];

const trackIds = tracks.map((track) => track.id);

const makeId = (prefix: string) => `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;

const getTrackPatternLength = (trackId: TrackId, songTracks = tracks) =>
  songTracks.find((track) => track.id === trackId)?.patternLength ?? defaultPatternLength;

const makeEmptySteps = (length = defaultPatternLength) => Array.from({ length }, () => false);

const makeEmptyTrackPattern = (songTracks = tracks): TrackPattern =>
  trackIds.reduce((pattern, trackId) => {
    pattern[trackId] = makeEmptySteps(getTrackPatternLength(trackId, songTracks));
    return pattern;
  }, {} as TrackPattern);

const makeSnapshotPatternIds = (snapshotId: string) =>
  trackIds.reduce(
    (patternIds, trackId) => ({
      ...patternIds,
      [trackId]: `${snapshotId}-${trackId}`,
    }),
    {} as Record<TrackId, string>,
  );

const makeSnapshot = (id: string, name: string): Snapshot => ({
  id,
  name,
  patternIds: makeSnapshotPatternIds(id),
});

const nextPatternName = (existingSnapshots: Snapshot[]) => {
  const usedNames = new Set(existingSnapshots.map((snapshot) => snapshot.name.toUpperCase()));
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");
  const nextLetter = alphabet.find((letter) => !usedNames.has(letter));

  return nextLetter ?? `P${existingSnapshots.length + 1}`;
};

const buildPatternsForSnapshots = (snapshots: Snapshot[]): PatternBank =>
  snapshots.reduce((patterns, snapshot) => {
    trackIds.forEach((trackId) => {
      patterns[snapshot.patternIds[trackId]] = makeEmptySteps(getTrackPatternLength(trackId));
    });
    return patterns;
  }, {} as PatternBank);

const recalculateStartBars = (blocks: ArrangementBlock[]) => {
  let nextStartBar = 1;

  return blocks.map((block) => {
    const arrangedBlock = { ...block, startBar: nextStartBar };
    nextStartBar += block.lengthBars;
    return arrangedBlock;
  });
};

const snapshots = [makeSnapshot("pattern-a", "A")];

const arrangementBlocks: ArrangementBlock[] = [];

const initialSong: Song = {
  activeView: "pattern",
  bpm: 128,
  swing: 12,
  masterVolume: 82,
  density: 48,
  tracks,
  patterns: buildPatternsForSnapshots(snapshots),
  snapshots,
  arrangementBlocks,
  selectedSnapshotId: "pattern-a",
  selectedArrangementBlockId: "",
};

interface SongState {
  song: Song;
  isPlaying: boolean;
  currentStep: number;
  setBpm: (bpm: number) => void;
  setSwing: (swing: number) => void;
  setMasterVolume: (volume: number) => void;
  setDensity: (density: number) => void;
  setPlaying: (isPlaying: boolean) => void;
  setCurrentStep: (step: number) => void;
  setActiveView: (activeView: ActiveView) => void;
  selectSnapshot: (snapshotId: string) => void;
  selectArrangementBlock: (blockId: string) => void;
  renameSelectedSnapshot: (name: string) => void;
  createSnapshot: () => void;
  duplicateSelectedSnapshot: () => void;
  deleteSelectedSnapshot: () => void;
  addSelectedSnapshotToArrangement: () => void;
  addSnapshotToArrangement: (snapshotId: string) => void;
  addSnapshotToArrangementAt: (snapshotId: string, insertIndex: number) => void;
  duplicateSelectedArrangementBlock: () => void;
  deleteSelectedArrangementBlock: () => void;
  deleteArrangementBlock: (blockId: string) => void;
  setSelectedBlockLength: (lengthBars: number) => void;
  setArrangementBlockLength: (blockId: string, lengthBars: number) => void;
  reorderArrangementBlock: (fromIndex: number, toIndex: number) => void;
  toggleStep: (trackId: TrackId, step: number) => void;
  setTrackVolume: (trackId: TrackId, volume: number) => void;
  setTrackPatternLength: (trackId: TrackId, patternLength: number) => void;
  setTrackSoundParam: (
    trackId: TrackId,
    param: keyof Song["tracks"][number]["sound"],
    value: number,
  ) => void;
  toggleTrackMute: (trackId: TrackId) => void;
  toggleTrackSolo: (trackId: TrackId) => void;
  generateLoop: () => void;
}

const getSelectedSnapshot = (song: Song) =>
  song.snapshots.find((snapshot) => snapshot.id === song.selectedSnapshotId) ?? song.snapshots[0];

const getSelectedBlock = (song: Song) =>
  song.arrangementBlocks.find((block) => block.id === song.selectedArrangementBlockId) ??
  song.arrangementBlocks[0];

const makeArrangementBlock = (snapshotId: string, lengthBars = 16): ArrangementBlock => ({
  id: makeId("block"),
  snapshotId,
  startBar: 1,
  lengthBars,
});

const getSnapshotTrackPattern = (song: Song, snapshot: Snapshot): TrackPattern =>
  trackIds.reduce((pattern, trackId) => {
    pattern[trackId] =
      song.patterns[snapshot.patternIds[trackId]] ??
      makeEmptySteps(getTrackPatternLength(trackId, song.tracks));
    return pattern;
  }, {} as TrackPattern);

const updateSnapshotPatterns = (
  patterns: PatternBank,
  snapshot: Snapshot,
  nextPattern: TrackPattern,
) =>
  trackIds.reduce(
    (nextPatterns, trackId) => ({
      ...nextPatterns,
      [snapshot.patternIds[trackId]]: [...nextPattern[trackId]],
    }),
    { ...patterns },
  );

const normalizePatternLength = (patternLength: number) =>
  patternLengthOptions.includes(patternLength) ? patternLength : defaultPatternLength;

const resizeSteps = (steps: boolean[], nextLength: number) => {
  if (steps.length === nextLength) return steps;
  if (steps.length > nextLength) return steps.slice(0, nextLength);
  return [...steps, ...Array.from({ length: nextLength - steps.length }, () => false)];
};

const resizeTrackPatterns = (
  patterns: PatternBank,
  snapshotsToResize: Snapshot[],
  trackId: TrackId,
  patternLength: number,
) =>
  snapshotsToResize.reduce(
    (nextPatterns, snapshot) => ({
      ...nextPatterns,
      [snapshot.patternIds[trackId]]: resizeSteps(
        nextPatterns[snapshot.patternIds[trackId]] ?? [],
        patternLength,
      ),
    }),
    { ...patterns },
  );

const clonePattern = (pattern: TrackPattern): TrackPattern =>
  trackIds.reduce((nextPattern, trackId) => {
    nextPattern[trackId] = [...pattern[trackId]];
    return nextPattern;
  }, {} as TrackPattern);

const chance = (percent: number) => Math.random() * 100 < percent;
const pick = <T,>(items: T[]): T => items[Math.floor(Math.random() * items.length)];

const toggleRandomSteps = (steps: boolean[], candidates: number[], amount: number) => {
  const shuffled = candidates.filter((step) => step < steps.length).sort(() => Math.random() - 0.5);
  shuffled.slice(0, amount).forEach((step) => {
    steps[step] = !steps[step];
  });
};

const hasAnyStep = (steps: boolean[]) => steps.some(Boolean);

const patternSliceKey = (pattern: TrackPattern) =>
  [pattern.bass, pattern.closedHat, pattern.openHat, pattern.perc]
    .map((steps) => steps.map((active) => (active ? "1" : "0")).join(""))
    .join("|");

const ensureVariation = (pattern: TrackPattern, previousPattern: TrackPattern, density: number) => {
  if (patternSliceKey(pattern) !== patternSliceKey(previousPattern)) return pattern;
  const bassCandidates = density > 58 ? [1, 5, 6, 9, 10, 13, 14] : [5, 6, 10, 13];
  toggleRandomSteps(pattern.bass, bassCandidates, density > 62 ? 2 : 1);
  pattern.perc[pick([1, 3, 5, 9, 11, 13, 15].filter((step) => step < pattern.perc.length))] = true;
  return pattern;
};

const generatedPattern = (density: number, previousPattern: TrackPattern): TrackPattern => {
  const previousHasSteps = Object.values(previousPattern).some((steps) => steps.some(Boolean));
  const pattern = previousHasSteps ? clonePattern(previousPattern) : makeEmptyTrackPattern();
  const variationDepth = Math.max(1, Math.round(density / 34));
  const dense = density > 62;

  const fillRepeating = (trackId: TrackId, baseSteps: number[]) => {
    const steps = pattern[trackId];
    steps.fill(false);
    for (let offset = 0; offset < steps.length; offset += stepCount) {
      baseSteps.forEach((step) => {
        const nextStep = offset + step;
        if (nextStep < steps.length) steps[nextStep] = true;
      });
    }
  };

  fillRepeating("kick", [0, 4, 8, 12]);
  fillRepeating("bass", pick([[3, 7, 11, 15], [3, 6, 10, 15], [2, 7, 11, 14], [3, 8, 10, 15]]));
  toggleRandomSteps(pattern.bass, [6, 9, 13, 14, 22, 29, 45, 61, 77, 93, 109, 125], chance(72) ? 1 : 0);
  if (dense) toggleRandomSteps(pattern.bass, [1, 2, 5, 6, 9, 10, 13, 14, 18, 25, 34, 49], variationDepth);

  Array.from({ length: pattern.closedHat.length }, (_, step) => step).forEach((step) => {
    const anchor = chance(50) ? step % 2 === 0 : step % 2 === 1;
    pattern.closedHat[step] = anchor || chance(density * 0.28);
  });

  fillRepeating("openHat", pick([[2, 10], [6, 14], [2, 11], [3, 10]]));
  if (dense && chance(78)) toggleRandomSteps(pattern.openHat, [6, 11, 14, 15, 30, 46, 62, 78], 1);

  fillRepeating("perc", pick([[5, 13], [1, 9, 13], [3, 5, 11], [5, 10, 15]]));
  if (density >= 45) toggleRandomSteps(pattern.perc, [1, 3, 7, 9, 11, 13, 15, 23, 31, 47, 63], variationDepth);
  if (!hasAnyStep(pattern.perc)) pattern.perc[pick([5, 9, 13].filter((step) => step < pattern.perc.length))] = true;

  fillRepeating("stab", density > 36 ? pick([[0, 8], [4, 12], [0, 12]]) : []);
  fillRepeating("texture", pick([[0, 6, 10], [2, 8, 14], [0, 7, 11]]));

  return ensureVariation(pattern, previousPattern, density);
};

export const useSongStore = create<SongState>((set) => ({
  song: initialSong,
  isPlaying: false,
  currentStep: -1,
  setBpm: (bpm) =>
    set((state) => ({ song: { ...state.song, bpm: Math.round(bpm) } })),
  setSwing: (swing) =>
    set((state) => ({ song: { ...state.song, swing: Math.round(swing) } })),
  setMasterVolume: (masterVolume) =>
    set((state) => ({
      song: { ...state.song, masterVolume: Math.max(0, Math.min(100, Math.round(masterVolume))) },
    })),
  setDensity: (density) =>
    set((state) => ({ song: { ...state.song, density: Math.round(density) } })),
  setPlaying: (isPlaying) => set({ isPlaying }),
  setCurrentStep: (currentStep) => set({ currentStep }),
  setActiveView: (activeView) =>
    set((state) => ({ song: { ...state.song, activeView } })),
  selectSnapshot: (snapshotId) =>
    set((state) => ({
      song: { ...state.song, selectedSnapshotId: snapshotId, selectedArrangementBlockId: "" },
    })),
  selectArrangementBlock: (blockId) =>
    set((state) => {
      const block = state.song.arrangementBlocks.find((candidate) => candidate.id === blockId);
      if (!block) return state;
      return {
        song: {
          ...state.song,
          selectedArrangementBlockId: block.id,
          selectedSnapshotId: block.snapshotId,
        },
      };
    }),
  renameSelectedSnapshot: (name) =>
    set((state) => ({
      song: {
        ...state.song,
        snapshots: state.song.snapshots.map((snapshot) =>
          snapshot.id === state.song.selectedSnapshotId ? { ...snapshot, name } : snapshot,
        ),
      },
    })),
  createSnapshot: () =>
    set((state) => {
      const snapshotId = makeId("pattern");
      const snapshot = makeSnapshot(snapshotId, nextPatternName(state.song.snapshots));
      const patterns = trackIds.reduce(
        (nextPatterns, trackId) => ({
          ...nextPatterns,
          [snapshot.patternIds[trackId]]: makeEmptySteps(getTrackPatternLength(trackId, state.song.tracks)),
        }),
        { ...state.song.patterns },
      );
      return {
        song: {
          ...state.song,
          snapshots: [...state.song.snapshots, snapshot],
          patterns,
          selectedSnapshotId: snapshotId,
        },
      };
    }),
  duplicateSelectedSnapshot: () =>
    set((state) => {
      const source = getSelectedSnapshot(state.song);
      const snapshotId = makeId("pattern");
      const snapshot = makeSnapshot(snapshotId, nextPatternName(state.song.snapshots));
      const sourcePattern = getSnapshotTrackPattern(state.song, source);
      return {
        song: {
          ...state.song,
          snapshots: [...state.song.snapshots, snapshot],
          patterns: updateSnapshotPatterns(state.song.patterns, snapshot, sourcePattern),
          selectedSnapshotId: snapshotId,
        },
      };
    }),
  deleteSelectedSnapshot: () =>
    set((state) => {
      if (state.song.snapshots.length <= 1) return state;

      const selectedIndex = state.song.snapshots.findIndex(
        (snapshot) => snapshot.id === state.song.selectedSnapshotId,
      );
      const snapshots = state.song.snapshots.filter(
        (snapshot) => snapshot.id !== state.song.selectedSnapshotId,
      );
      const nextSnapshot = snapshots[Math.min(Math.max(selectedIndex, 0), snapshots.length - 1)];
      const arrangementBlocks = state.song.arrangementBlocks.filter(
        (block) => block.snapshotId !== state.song.selectedSnapshotId,
      );
      const deletedPatternIds =
        state.song.snapshots.find((snapshot) => snapshot.id === state.song.selectedSnapshotId)
          ?.patternIds ?? ({} as Record<TrackId, string>);
      const patterns = Object.entries(state.song.patterns).reduce((nextPatterns, [patternId, steps]) => {
        if (!Object.values(deletedPatternIds).includes(patternId)) {
          nextPatterns[patternId] = steps;
        }

        return nextPatterns;
      }, {} as PatternBank);

      return {
        song: {
          ...state.song,
          snapshots,
          patterns,
          arrangementBlocks: recalculateStartBars(arrangementBlocks),
          selectedSnapshotId: nextSnapshot.id,
          selectedArrangementBlockId: "",
        },
      };
    }),
  addSelectedSnapshotToArrangement: () =>
    set((state) => {
      const selectedBlock = getSelectedBlock(state.song);
      const selectedIndex = selectedBlock
        ? state.song.arrangementBlocks.findIndex((block) => block.id === selectedBlock.id)
        : -1;
      const block = makeArrangementBlock(state.song.selectedSnapshotId, selectedBlock?.lengthBars ?? 16);
      const insertIndex = selectedIndex >= 0 ? selectedIndex + 1 : state.song.arrangementBlocks.length;
      const blocks = [
        ...state.song.arrangementBlocks.slice(0, insertIndex),
        block,
        ...state.song.arrangementBlocks.slice(insertIndex),
      ];
      return {
        song: {
          ...state.song,
          arrangementBlocks: recalculateStartBars(blocks),
          selectedArrangementBlockId: block.id,
          selectedSnapshotId: block.snapshotId,
        },
      };
    }),
  addSnapshotToArrangement: (snapshotId) =>
    set((state) => {
      if (!state.song.snapshots.some((snapshot) => snapshot.id === snapshotId)) return state;
      const block = makeArrangementBlock(snapshotId);
      return {
        song: {
          ...state.song,
          arrangementBlocks: recalculateStartBars([...state.song.arrangementBlocks, block]),
          selectedArrangementBlockId: block.id,
          selectedSnapshotId: snapshotId,
        },
      };
    }),
  addSnapshotToArrangementAt: (snapshotId, insertIndex) =>
    set((state) => {
      if (!state.song.snapshots.some((snapshot) => snapshot.id === snapshotId)) return state;
      const block = makeArrangementBlock(snapshotId);
      const safeInsertIndex = Math.max(0, Math.min(Math.round(insertIndex), state.song.arrangementBlocks.length));
      const blocks = [
        ...state.song.arrangementBlocks.slice(0, safeInsertIndex),
        block,
        ...state.song.arrangementBlocks.slice(safeInsertIndex),
      ];

      return {
        song: {
          ...state.song,
          arrangementBlocks: recalculateStartBars(blocks),
          selectedArrangementBlockId: block.id,
          selectedSnapshotId: snapshotId,
        },
      };
    }),
  duplicateSelectedArrangementBlock: () =>
    set((state) => {
      const source = getSelectedBlock(state.song);
      if (!source) return state;
      const sourceIndex = state.song.arrangementBlocks.findIndex((block) => block.id === source.id);
      const block = { ...source, id: makeId("block") };
      const blocks = [
        ...state.song.arrangementBlocks.slice(0, sourceIndex + 1),
        block,
        ...state.song.arrangementBlocks.slice(sourceIndex + 1),
      ];
      return {
        song: {
          ...state.song,
          arrangementBlocks: recalculateStartBars(blocks),
          selectedArrangementBlockId: block.id,
          selectedSnapshotId: block.snapshotId,
        },
      };
    }),
  deleteSelectedArrangementBlock: () =>
    set((state) => {
      if (state.song.arrangementBlocks.length === 0) return state;
      const selectedIndex = state.song.arrangementBlocks.findIndex(
        (block) => block.id === state.song.selectedArrangementBlockId,
      );
      const blocks = state.song.arrangementBlocks.filter((block) => block.id !== state.song.selectedArrangementBlockId);
      const nextBlock = blocks.length > 0 ? blocks[Math.min(Math.max(selectedIndex, 0), blocks.length - 1)] : null;
      return {
        song: {
          ...state.song,
          arrangementBlocks: recalculateStartBars(blocks),
          selectedArrangementBlockId: nextBlock?.id ?? "",
          selectedSnapshotId: nextBlock?.snapshotId ?? state.song.selectedSnapshotId,
        },
      };
    }),
  deleteArrangementBlock: (blockId) =>
    set((state) => {
      if (!state.song.arrangementBlocks.some((block) => block.id === blockId)) return state;
      const selectedIndex = state.song.arrangementBlocks.findIndex((block) => block.id === blockId);
      const blocks = state.song.arrangementBlocks.filter((block) => block.id !== blockId);
      const nextBlock =
        blockId === state.song.selectedArrangementBlockId && blocks.length > 0
          ? blocks[Math.min(Math.max(selectedIndex, 0), blocks.length - 1)]
          : blocks.find((block) => block.id === state.song.selectedArrangementBlockId);

      return {
        song: {
          ...state.song,
          arrangementBlocks: recalculateStartBars(blocks),
          selectedArrangementBlockId: nextBlock?.id ?? "",
          selectedSnapshotId:
            blockId === state.song.selectedArrangementBlockId
              ? nextBlock?.snapshotId ?? state.song.selectedSnapshotId
              : state.song.selectedSnapshotId,
        },
      };
    }),
  setSelectedBlockLength: (lengthBars) =>
    set((state) => ({
      song: {
        ...state.song,
        arrangementBlocks: recalculateStartBars(
          state.song.arrangementBlocks.map((block) =>
            block.id === state.song.selectedArrangementBlockId
              ? { ...block, lengthBars: Math.max(1, Math.round(lengthBars)) }
              : block,
          ),
        ),
      },
    })),
  setArrangementBlockLength: (blockId, lengthBars) =>
    set((state) => ({
      song: {
        ...state.song,
        arrangementBlocks: recalculateStartBars(
          state.song.arrangementBlocks.map((block) =>
            block.id === blockId ? { ...block, lengthBars: Math.max(1, Math.round(lengthBars)) } : block,
          ),
        ),
      },
    })),
  reorderArrangementBlock: (fromIndex, toIndex) =>
    set((state) => {
      if (
        fromIndex === toIndex ||
        fromIndex < 0 ||
        toIndex < 0 ||
        fromIndex >= state.song.arrangementBlocks.length ||
        toIndex >= state.song.arrangementBlocks.length
      ) {
        return state;
      }
      const blocks = [...state.song.arrangementBlocks];
      const [movedBlock] = blocks.splice(fromIndex, 1);
      blocks.splice(toIndex, 0, movedBlock);
      return { song: { ...state.song, arrangementBlocks: recalculateStartBars(blocks) } };
    }),
  toggleStep: (trackId, step) =>
    set((state) => {
      const snapshot = getSelectedSnapshot(state.song);
      const patternId = snapshot.patternIds[trackId];
      const trackPattern = [
        ...(state.song.patterns[patternId] ??
          makeEmptySteps(getTrackPatternLength(trackId, state.song.tracks))),
      ];
      trackPattern[step] = !trackPattern[step];
      return { song: { ...state.song, patterns: { ...state.song.patterns, [patternId]: trackPattern } } };
    }),
  setTrackVolume: (trackId, volume) =>
    set((state) => ({
      song: {
        ...state.song,
        tracks: state.song.tracks.map((track) =>
          track.id === trackId ? { ...track, volume: Math.max(0, Math.min(100, Math.round(volume))) } : track,
        ),
      },
    })),
  setTrackPatternLength: (trackId, patternLength) =>
    set((state) => {
      const nextPatternLength = normalizePatternLength(patternLength);
      return {
        song: {
          ...state.song,
          tracks: state.song.tracks.map((track) =>
            track.id === trackId ? { ...track, patternLength: nextPatternLength } : track,
          ),
          patterns: resizeTrackPatterns(state.song.patterns, state.song.snapshots, trackId, nextPatternLength),
        },
      };
    }),
  setTrackSoundParam: (trackId, param, value) =>
    set((state) => ({
      song: {
        ...state.song,
        tracks: state.song.tracks.map((track) =>
          track.id === trackId
            ? { ...track, sound: { ...track.sound, [param]: Math.max(0, Math.min(100, Math.round(value))) } }
            : track,
        ),
      },
    })),
  toggleTrackMute: (trackId) =>
    set((state) => ({
      song: {
        ...state.song,
        tracks: state.song.tracks.map((track) =>
          track.id === trackId ? { ...track, mute: !track.mute } : track,
        ),
      },
    })),
  toggleTrackSolo: (trackId) =>
    set((state) => ({
      song: {
        ...state.song,
        tracks: state.song.tracks.map((track) =>
          track.id === trackId ? { ...track, solo: !track.solo } : track,
        ),
      },
    })),
  generateLoop: () =>
    set((state) => {
      const snapshot = getSelectedSnapshot(state.song);
      const previousPattern = getSnapshotTrackPattern(state.song, snapshot);
      const nextPattern = generatedPattern(state.song.density, previousPattern);
      return { song: { ...state.song, patterns: updateSnapshotPatterns(state.song.patterns, snapshot, nextPattern) } };
    }),
}));
