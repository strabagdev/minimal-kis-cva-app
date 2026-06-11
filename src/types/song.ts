export type TrackId =
  | "kick"
  | "bass"
  | "closedHat"
  | "openHat"
  | "perc"
  | "stab"
  | "texture";

export interface Snapshot {
  id: string;
  name: string;
  patternIds: Record<TrackId, string>;
}

export interface ArrangementBlock {
  id: string;
  snapshotId: string;
  startBar: number;
  lengthBars: number;
}

export interface Track {
  id: TrackId;
  name: string;
  color: string;
  level: number;
  volume: number;
  mute: boolean;
  solo: boolean;
  patternLength: number;
  sound: {
    tone: number;
    decay: number;
    drive: number;
    filter: number;
  };
}

export type TrackPattern = Record<TrackId, boolean[]>;

export type PatternBank = Record<string, boolean[]>;

export interface Song {
  bpm: number;
  swing: number;
  masterVolume: number;
  density: number;
  tracks: Track[];
  patterns: PatternBank;
  snapshots: Snapshot[];
  arrangementBlocks: ArrangementBlock[];
  selectedSnapshotId: string;
  selectedArrangementBlockId: string;
}
