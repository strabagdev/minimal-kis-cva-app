import * as Tone from "tone";
import type { ActiveView, ArrangementBlock, Song, Track, TrackId } from "../types/song";

type TrackVoice = {
  instrument: Tone.ToneAudioNode;
  filter: Tone.Filter;
  drive: Tone.Distortion;
  channel: Tone.Channel;
};

type Voices = Record<TrackId, TrackVoice>;

let voices: Voices | null = null;
let repeatEventId: number | null = null;
let liveSong: Song | null = null;
let onStepCallback: ((step: number) => void) | null = null;
let masterChannel: Tone.Channel | null = null;
let masterMeter: Tone.Meter | null = null;
let liveActiveView: ActiveView = "pattern";
let transportStep = 0;

const getMaster = () => {
  if (masterChannel && masterMeter) {
    return { channel: masterChannel, meter: masterMeter };
  }

  masterChannel = new Tone.Channel({ volume: volumeToDb(82) });
  masterMeter = new Tone.Meter({ smoothing: 0.78 });
  masterChannel.connect(masterMeter);
  masterChannel.toDestination();

  return { channel: masterChannel, meter: masterMeter };
};

const createNoise = (type: "white" | "pink", decay: number) =>
  new Tone.NoiseSynth({
    noise: { type },
    envelope: { attack: 0.001, decay, sustain: 0 },
  });

const createVoice = (instrument: Tone.ToneAudioNode, filterType: BiquadFilterType = "lowpass"): TrackVoice => {
  const filter = new Tone.Filter({ frequency: 9000, type: filterType, rolloff: -24 });
  const drive = new Tone.Distortion({ distortion: 0.12, wet: 0.24 });
  const channel = new Tone.Channel({ volume: -6 });
  instrument.connect(filter);
  filter.connect(drive);
  drive.connect(channel);
  channel.connect(getMaster().channel);

  return { instrument, filter, drive, channel };
};

const getVoices = (): Voices => {
  if (voices) {
    return voices;
  }

  voices = {
    kick: createVoice(
      new Tone.MembraneSynth({
        pitchDecay: 0.045,
        octaves: 7,
        oscillator: { type: "sine" },
        envelope: { attack: 0.001, decay: 0.42, sustain: 0.01, release: 0.08 },
      }),
    ),
    bass: createVoice(
      new Tone.MonoSynth({
        oscillator: { type: "square" },
        filter: { Q: 1, type: "lowpass", rolloff: -24 },
        envelope: { attack: 0.005, decay: 0.18, sustain: 0.12, release: 0.08 },
        filterEnvelope: {
          attack: 0.001,
          decay: 0.18,
          sustain: 0.18,
          release: 0.08,
          baseFrequency: 80,
          octaves: 2.4,
        },
      }),
    ),
    closedHat: createVoice(createNoise("white", 0.045), "highpass"),
    openHat: createVoice(createNoise("white", 0.24), "highpass"),
    perc: createVoice(
      new Tone.MetalSynth({
        envelope: { attack: 0.001, decay: 0.12, release: 0.05 },
        harmonicity: 4.8,
        modulationIndex: 18,
        resonance: 1800,
        octaves: 0.6,
      }),
    ),
    stab: createVoice(
      new Tone.PolySynth(Tone.Synth, {
        oscillator: { type: "sawtooth" },
        envelope: { attack: 0.01, decay: 0.16, sustain: 0.16, release: 0.15 },
      }),
    ),
    texture: createVoice(
      new Tone.NoiseSynth({
        noise: { type: "pink" },
        envelope: { attack: 0.02, decay: 0.32, sustain: 0, release: 0.1 },
      }),
      "bandpass",
    ),
  };

  return voices;
};

const volumeToDb = (volume: number) => (volume <= 0 ? -Infinity : -48 + volume * 0.48);

const scale = (value: number, min: number, max: number) => min + (value / 100) * (max - min);

const toneToMidi = (tone: number, baseMidi: number, range = 12) =>
  Tone.Frequency(baseMidi + Math.round(scale(tone, -range / 2, range / 2)), "midi").toNote();

const decayToSeconds = (decay: number, min: number, max: number) => scale(decay, min, max);

const filterToHz = (filter: number, min: number, max: number) => scale(filter, min, max);

const isTrackAudible = (track: Track, tracks: Track[]) => {
  const hasSolo = tracks.some((candidate) => candidate.solo);

  if (hasSolo) {
    return track.solo;
  }

  return !track.mute;
};

const applyMixer = (tracks: Track[]) => {
  const trackVoices = getVoices();

  tracks.forEach((track) => {
    const voice = trackVoices[track.id];
    voice.channel.mute = !isTrackAudible(track, tracks);
    voice.channel.volume.rampTo(volumeToDb(track.volume), 0.025);
  });
};

const applyMaster = (masterVolume: number) => {
  getMaster().channel.volume.rampTo(volumeToDb(masterVolume), 0.025);
};

const applyInstrumentParams = (tracks: Track[]) => {
  const trackVoices = getVoices();

  tracks.forEach((track) => {
    const voice = trackVoices[track.id];
    const { tone, decay, drive, filter } = track.sound;

    voice.drive.distortion = scale(drive, 0, 0.82);
    voice.drive.wet.rampTo(scale(drive, 0.02, 0.46), 0.025);

    switch (track.id) {
      case "kick": {
        voice.filter.frequency.rampTo(filterToHz(filter, 120, 4200), 0.025);
        const instrument = voice.instrument as Tone.MembraneSynth;
        instrument.set({
          octaves: scale(tone, 4, 9),
          envelope: { decay: decayToSeconds(decay, 0.18, 0.72), release: 0.08 },
        });
        break;
      }
      case "bass": {
        voice.filter.frequency.rampTo(filterToHz(filter, 80, 2400), 0.025);
        const instrument = voice.instrument as Tone.MonoSynth;
        instrument.set({
          filterEnvelope: { octaves: scale(tone, 1.2, 4.2) },
          envelope: { decay: decayToSeconds(decay, 0.08, 0.42), release: 0.06 },
        });
        break;
      }
      case "closedHat":
      case "openHat": {
        voice.filter.frequency.rampTo(filterToHz(filter, 1800, 12000), 0.025);
        const instrument = voice.instrument as Tone.NoiseSynth;
        instrument.set({
          envelope: {
            decay: decayToSeconds(decay, track.id === "closedHat" ? 0.018 : 0.12, track.id === "closedHat" ? 0.16 : 0.58),
          },
        });
        break;
      }
      case "perc": {
        voice.filter.frequency.rampTo(filterToHz(filter, 350, 7200), 0.025);
        const instrument = voice.instrument as Tone.MetalSynth;
        instrument.set({
          harmonicity: scale(tone, 2.2, 8.5),
          envelope: { decay: decayToSeconds(decay, 0.05, 0.34), release: 0.05 },
        });
        break;
      }
      case "stab": {
        voice.filter.frequency.rampTo(filterToHz(filter, 240, 5200), 0.025);
        const instrument = voice.instrument as Tone.PolySynth;
        instrument.set({
          envelope: { decay: decayToSeconds(decay, 0.08, 0.52), release: 0.12 },
        });
        break;
      }
      case "texture": {
        voice.filter.frequency.rampTo(filterToHz(filter, 220, 6200), 0.025);
        const instrument = voice.instrument as Tone.NoiseSynth;
        instrument.set({
          envelope: { decay: decayToSeconds(decay, 0.14, 1.2), release: 0.12 },
        });
        break;
      }
    }
  });
};

const getSelectedSnapshot = (song: Song) =>
  song.snapshots.find((snapshot) => snapshot.id === song.selectedSnapshotId) ?? song.snapshots[0];

const getPatternSteps = (song: Song, snapshotId: string, trackId: TrackId) => {
  const snapshot = song.snapshots.find((candidate) => candidate.id === snapshotId);

  if (!snapshot) {
    return [];
  }

  return song.patterns[snapshot.patternIds[trackId]] ?? [];
};

const getTrackPatternStep = (track: Track, transportStep: number) => {
  const patternLength = Math.max(1, track.patternLength);

  return transportStep % patternLength;
};

const triggerTrack = (track: Track, time: Tone.Unit.Time) => {
  const trackVoices = getVoices();
  const { id: trackId, sound } = track;

  switch (trackId) {
    case "kick":
      (trackVoices.kick.instrument as Tone.MembraneSynth).triggerAttackRelease(
        toneToMidi(sound.tone, 36, 8),
        decayToSeconds(sound.decay, 0.08, 0.28),
        time,
      );
      break;
    case "bass":
      (trackVoices.bass.instrument as Tone.MonoSynth).triggerAttackRelease(
        toneToMidi(sound.tone, 29, 10),
        decayToSeconds(sound.decay, 0.06, 0.22),
        time,
      );
      break;
    case "closedHat":
      (trackVoices.closedHat.instrument as Tone.NoiseSynth).triggerAttackRelease(
        decayToSeconds(sound.decay, 0.018, 0.12),
        time,
      );
      break;
    case "openHat":
      (trackVoices.openHat.instrument as Tone.NoiseSynth).triggerAttackRelease(
        decayToSeconds(sound.decay, 0.08, 0.48),
        time,
      );
      break;
    case "perc":
      (trackVoices.perc.instrument as Tone.MetalSynth).triggerAttackRelease(
        decayToSeconds(sound.decay, 0.035, 0.2),
        time,
      );
      break;
    case "stab":
      (trackVoices.stab.instrument as Tone.PolySynth).triggerAttackRelease(
        [toneToMidi(sound.tone, 53, 8), toneToMidi(sound.tone, 56, 8), toneToMidi(sound.tone, 60, 8)],
        decayToSeconds(sound.decay, 0.08, 0.34),
        time,
      );
      break;
    case "texture":
      (trackVoices.texture.instrument as Tone.NoiseSynth).triggerAttackRelease(
        decayToSeconds(sound.decay, 0.12, 0.82),
        time,
      );
      break;
  }
};

export const syncTransportSettings = (bpm: number, swing: number) => {
  Tone.Transport.bpm.value = bpm;
  Tone.Transport.swing = swing / 100;
  Tone.Transport.swingSubdivision = "16n";
};

export const syncSongState = (song: Song) => {
  liveSong = song;
  liveActiveView = song.activeView;
  syncTransportSettings(song.bpm, song.swing);
  applyMaster(song.masterVolume);
  applyMixer(song.tracks);
  applyInstrumentParams(song.tracks);
};

export const syncPlaybackMode = (activeView: ActiveView) => {
  if (liveActiveView !== activeView) {
    transportStep = 0;
    onStepCallback?.(-1);
  }

  liveActiveView = activeView;
};

export const getMasterLevel = () => {
  const value = getMaster().meter.getValue();
  const meterValue = Array.isArray(value) ? Math.max(...value) : value;

  if (!Number.isFinite(meterValue)) {
    return 0;
  }

  if (meterValue >= 0 && meterValue <= 1) {
    return meterValue;
  }

  const level = Tone.dbToGain(meterValue);

  return Number.isFinite(level) ? Math.min(1, Math.max(0, level)) : 0;
};

const getArrangementTotalSteps = (song: Song) =>
  song.arrangementBlocks.reduce((total, block) => total + Math.max(1, block.lengthBars) * 16, 0);

const getArrangementBlockAtStep = (blocks: ArrangementBlock[], step: number) => {
  let blockStartStep = 0;

  for (const block of blocks) {
    const blockSteps = Math.max(1, block.lengthBars) * 16;
    const blockEndStep = blockStartStep + blockSteps;

    if (step >= blockStartStep && step < blockEndStep) {
      return { block, localStep: step - blockStartStep };
    }

    blockStartStep = blockEndStep;
  }

  return null;
};

const playPatternStep = (song: Song, snapshotId: string, step: number, time: Tone.Unit.Time) => {
  song.tracks.forEach((track) => {
    const patternStep = getTrackPatternStep(track, step);

    if (isTrackAudible(track, song.tracks) && getPatternSteps(song, snapshotId, track.id)[patternStep]) {
      triggerTrack(track, time);
    }
  });
};

const tickPatternMode = (song: Song, time: Tone.Unit.Time) => {
  const snapshot = getSelectedSnapshot(song);

  if (!snapshot) {
    onStepCallback?.(-1);
    return;
  }

  onStepCallback?.(transportStep);
  playPatternStep(song, snapshot.id, transportStep, time);
  transportStep += 1;
};

const tickArrangementMode = (song: Song, time: Tone.Unit.Time) => {
  const totalSteps = getArrangementTotalSteps(song);

  if (totalSteps <= 0) {
    onStepCallback?.(-1);
    return;
  }

  const songStep = transportStep % totalSteps;
  const currentBlock = getArrangementBlockAtStep(song.arrangementBlocks, songStep);
  onStepCallback?.(songStep);

  if (currentBlock) {
    playPatternStep(song, currentBlock.block.snapshotId, currentBlock.localStep, time);
  }

  transportStep = (songStep + 1) % totalSteps;
};

const ensureScheduler = () => {
  if (repeatEventId !== null) {
    return;
  }

  repeatEventId = Tone.Transport.scheduleRepeat((time) => {
    const song = liveSong;
    if (!song) return;

    if (liveActiveView === "arrangement") {
      tickArrangementMode(song, time);
      return;
    }

    tickPatternMode(song, time);
  }, "16n");
};

export const startLoop = async (song: Song, onStep: (step: number) => void) => {
  await Tone.start();
  syncSongState(song);
  onStepCallback = onStep;
  liveActiveView = song.activeView;
  transportStep = 0;

  ensureScheduler();
  Tone.Transport.stop();
  Tone.Transport.position = 0;
  onStep(-1);
  Tone.Transport.start();
};

export const stopLoop = (onStep: (step: number) => void) => {
  Tone.Transport.stop();
  transportStep = 0;
  onStep(-1);
};
