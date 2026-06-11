import { useEffect, useState } from "react";
import { getMasterLevel, startLoop, stopLoop, syncSongState } from "./audio/transport";
import { useSongStore } from "./store/songStore";

const patternLengthOptions = [16, 32, 48, 64, 128];

const controlMeta = [
  { key: "swing", label: "Swing", min: 0, max: 35 },
  { key: "density", label: "Density", min: 0, max: 100 },
] as const;

const soundControlMeta = [
  { key: "tone", label: "Tone" },
  { key: "decay", label: "Decay" },
  { key: "drive", label: "Drive" },
  { key: "filter", label: "Filter" },
] as const;

function MasterMeter() {
  const [level, setLevel] = useState(0);

  useEffect(() => {
    let frame = 0;
    let smoothedLevel = 0;

    const tick = () => {
      smoothedLevel = smoothedLevel * 0.78 + getMasterLevel() * 0.22;
      setLevel(smoothedLevel);
      frame = requestAnimationFrame(tick);
    };

    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, []);

  return (
    <div className="master-meter" aria-label="Master output meter">
      <span className="meter-safe" style={{ width: `${Math.min(level, 0.82) * 100}%` }} />
      <span className="meter-hot" style={{ width: `${Math.max(0, level - 0.82) * 100}%` }} />
    </div>
  );
}

function App() {
  const {
    song,
    isPlaying,
    currentStep,
    setBpm,
    setSwing,
    setMasterVolume,
    setDensity,
    setPlaying,
    setCurrentStep,
    selectSnapshot,
    selectArrangementBlock,
    renameSelectedSnapshot,
    createSnapshot,
    duplicateSelectedSnapshot,
    addSelectedSnapshotToArrangement,
    duplicateSelectedArrangementBlock,
    deleteSelectedArrangementBlock,
    setSelectedBlockLength,
    reorderArrangementBlock,
    toggleStep,
    setTrackVolume,
    setTrackPatternLength,
    setTrackSoundParam,
    toggleTrackMute,
    toggleTrackSolo,
    generateLoop,
  } = useSongStore();

  const [draggedBlockId, setDraggedBlockId] = useState<string | null>(null);

  useEffect(() => {
    syncSongState(song);
  }, [song]);

  const selectedSnapshot =
    song.snapshots.find((snapshot) => snapshot.id === song.selectedSnapshotId) ?? song.snapshots[0];
  const selectedBlock =
    song.arrangementBlocks.find((block) => block.id === song.selectedArrangementBlockId) ??
    song.arrangementBlocks[0];
  const selectedBlockSnapshot = song.snapshots.find(
    (snapshot) => snapshot.id === selectedBlock?.snapshotId,
  );
  const canDeleteBlock = song.arrangementBlocks.length > 1;
  const maxPatternLength = Math.max(...song.tracks.map((track) => track.patternLength));
  const stepLabels = Array.from({ length: maxPatternLength }, (_, step) => step + 1);
  const sequencerGridStyle = {
    gridTemplateColumns: `128px 210px repeat(${maxPatternLength}, minmax(20px, 1fr))`,
  };

  const controlSetters = {
    swing: setSwing,
    density: setDensity,
  };

  const getTrackSteps = (trackId: (typeof song.tracks)[number]["id"]) =>
    selectedSnapshot ? song.patterns[selectedSnapshot.patternIds[trackId]] ?? [] : [];

  const handlePlayStop = async () => {
    if (isPlaying) {
      stopLoop(setCurrentStep);
      setPlaying(false);
      return;
    }

    await startLoop(song, setCurrentStep);
    setPlaying(true);
  };

  const handleDropBlock = (targetBlockId: string, transferredBlockId?: string) => {
    const sourceBlockId = transferredBlockId || draggedBlockId;

    if (!sourceBlockId || sourceBlockId === targetBlockId) {
      setDraggedBlockId(null);
      return;
    }

    const fromIndex = song.arrangementBlocks.findIndex((block) => block.id === sourceBlockId);
    const toIndex = song.arrangementBlocks.findIndex((block) => block.id === targetBlockId);
    reorderArrangementBlock(fromIndex, toIndex);
    setDraggedBlockId(null);
  };

  return (
    <main className="app-shell">
      <section className="workspace" aria-label="Pulseframe workspace">
        <header className="topbar">
          <div>
            <p className="eyebrow">Pulseframe</p>
            <h1>Minimal Techno Sketchpad</h1>
          </div>
          <div className="header-controls">
            <button className="play-button compact-command" onClick={handlePlayStop}>
              {isPlaying ? "Stop" : "Play"}
            </button>
            <label className="header-control">
              <span>BPM</span>
              <input
                min="90"
                max="150"
                type="range"
                value={song.bpm}
                onChange={(event) => setBpm(Number(event.target.value))}
              />
              <strong>{song.bpm}</strong>
            </label>
            <button className="generate-button compact-command" onClick={generateLoop}>
              Generate
            </button>
            <label className="header-control master-control">
              <span>Master</span>
              <input
                min="0"
                max="100"
                type="range"
                value={song.masterVolume}
                onChange={(event) => setMasterVolume(Number(event.target.value))}
              />
              <strong>{song.masterVolume}</strong>
            </label>
            <MasterMeter />
          </div>
        </header>

        <section className="song-map" aria-label="Snapshot Arrangement">
          {song.arrangementBlocks.map((block) => {
            const snapshot = song.snapshots.find((candidate) => candidate.id === block.snapshotId);

            return (
              <article
                className={`section-block ${
                  block.id === song.selectedArrangementBlockId ? "is-selected" : ""
                } ${block.id === draggedBlockId ? "is-dragging" : ""}`}
                draggable
                key={block.id}
                onClick={() => selectArrangementBlock(block.id)}
                onDragStart={(event) => {
                  event.dataTransfer.effectAllowed = "move";
                  event.dataTransfer.setData("text/plain", block.id);
                  setDraggedBlockId(block.id);
                  selectArrangementBlock(block.id);
                }}
                onDragOver={(event) => {
                  event.preventDefault();
                  event.dataTransfer.dropEffect = "move";
                }}
                onDrop={(event) => {
                  event.preventDefault();
                  handleDropBlock(block.id, event.dataTransfer.getData("text/plain"));
                }}
                onDragEnd={() => setDraggedBlockId(null)}
                style={{ flexGrow: block.lengthBars }}
              >
                <details
                  className="section-menu"
                  draggable={false}
                  onClick={(event) => event.stopPropagation()}
                  onDragStart={(event) => event.preventDefault()}
                >
                  <summary aria-label={`${snapshot?.name ?? "Block"} actions`}>...</summary>
                  <div className="section-menu-popover">
                    <button
                      onClick={() => {
                        selectArrangementBlock(block.id);
                        duplicateSelectedArrangementBlock();
                      }}
                    >
                      Duplicate Block
                    </button>
                    <button
                      onClick={() => {
                        selectArrangementBlock(block.id);
                        duplicateSelectedSnapshot();
                      }}
                    >
                      Duplicate Snapshot
                    </button>
                    <button
                      onClick={() => {
                        selectArrangementBlock(block.id);
                        deleteSelectedArrangementBlock();
                      }}
                      disabled={!canDeleteBlock}
                    >
                      Delete Block
                    </button>
                  </div>
                </details>
                <div className="section-label">
                  <strong>{snapshot?.name ?? "Missing Snapshot"}</strong>
                  <span>
                    Bar {block.startBar} / {block.lengthBars} bars
                  </span>
                </div>
              </article>
            );
          })}
        </section>

        <section className="sequencer" aria-label="Step Sequencer">
          <div className="sequencer-header" style={sequencerGridStyle}>
            <span>Track</span>
            <span>Mixer</span>
            {stepLabels.map((label) => (
              <span className={currentStep % maxPatternLength === label - 1 ? "active-step" : ""} key={label}>
                {label}
              </span>
            ))}
          </div>

          {song.tracks.map((track) => (
            <div className="track-row" key={track.id} style={sequencerGridStyle}>
              <div className="track-name">
                <span style={{ background: track.color }} />
                {track.name}
              </div>
              <div className="track-mixer">
                <input
                  aria-label={`${track.name} volume`}
                  min="0"
                  max="100"
                  type="range"
                  value={track.volume}
                  onChange={(event) => setTrackVolume(track.id, Number(event.target.value))}
                />
                <button
                  className={track.mute ? "mix-toggle is-muted" : "mix-toggle"}
                  onClick={() => toggleTrackMute(track.id)}
                  aria-pressed={track.mute}
                >
                  M
                </button>
                <button
                  className={track.solo ? "mix-toggle is-soloed" : "mix-toggle"}
                  onClick={() => toggleTrackSolo(track.id)}
                  aria-pressed={track.solo}
                >
                  S
                </button>
                <select
                  aria-label={`${track.name} pattern length`}
                  value={track.patternLength}
                  onChange={(event) => setTrackPatternLength(track.id, Number(event.target.value))}
                >
                  {patternLengthOptions.map((length) => (
                    <option key={length} value={length}>
                      {length}
                    </option>
                  ))}
                </select>
              </div>
              {getTrackSteps(track.id).map((active, step) => (
                <button
                  className={`step-button ${active ? "is-active" : ""} ${
                    currentStep % track.patternLength === step ? "is-playing" : ""
                  }`}
                  key={`${track.id}-${step}`}
                  onClick={() => toggleStep(track.id, step)}
                  style={{ "--track-color": track.color } as React.CSSProperties}
                  aria-label={`${track.name} step ${step + 1}`}
                  aria-pressed={active}
                />
              ))}
            </div>
          ))}
        </section>
      </section>

      <aside className="control-panel" aria-label="Controls">
        <div className="panel-title">
          <p className="eyebrow">Snapshot Library</p>
          <h2>{selectedSnapshot?.name ?? "Snapshot"}</h2>
        </div>

        <div className="snapshot-library">
          {song.snapshots.map((snapshot) => (
            <button
              className={`snapshot-item ${snapshot.id === song.selectedSnapshotId ? "is-selected" : ""}`}
              key={snapshot.id}
              onClick={() => selectSnapshot(snapshot.id)}
            >
              {snapshot.name}
            </button>
          ))}
        </div>

        <div className="arrangement-panel" aria-label="Selected snapshot controls">
          <label className="control-group">
            <span>
              Snapshot
              <strong>{selectedBlockSnapshot?.name ?? "Direct"}</strong>
            </span>
            <input
              className="section-name-input"
              value={selectedSnapshot?.name ?? ""}
              onChange={(event) => renameSelectedSnapshot(event.target.value)}
            />
          </label>
          <div className="section-actions two-up">
            <button className="icon-button" onClick={createSnapshot}>
              New Snapshot
            </button>
            <button className="icon-button" onClick={duplicateSelectedSnapshot}>
              Duplicate As New
            </button>
          </div>
          <button className="secondary-button" onClick={addSelectedSnapshotToArrangement}>
            Add Snapshot To Arrangement
          </button>
          {selectedBlock && (
            <>
              <div className="section-actions two-up">
                <button className="icon-button" onClick={duplicateSelectedArrangementBlock}>
                  Duplicate Block
                </button>
                <button
                  className="icon-button danger-button"
                  onClick={deleteSelectedArrangementBlock}
                  disabled={!canDeleteBlock}
                >
                  Delete Block
                </button>
              </div>
              <label className="control-group">
                <span>
                  Block Length
                  <strong>{selectedBlock.lengthBars} bars</strong>
                </span>
                <input
                  min="1"
                  max="64"
                  type="range"
                  value={selectedBlock.lengthBars}
                  onChange={(event) => setSelectedBlockLength(Number(event.target.value))}
                />
              </label>
            </>
          )}
        </div>

        {controlMeta.map((control) => (
          <label className="control-group" key={control.key}>
            <span>
              {control.label}
              <strong>{song[control.key]}</strong>
            </span>
            <input
              min={control.min}
              max={control.max}
              type="range"
              value={song[control.key]}
              onChange={(event) => controlSetters[control.key](Number(event.target.value))}
            />
          </label>
        ))}

        <div className="instrument-panel" aria-label="PF instrument controls">
          <div className="panel-title compact-title">
            <p className="eyebrow">PF Instruments</p>
            <h2>Synths</h2>
          </div>

          {song.tracks.map((track) => (
            <details className="instrument-card" key={track.id}>
              <summary>
                <span style={{ background: track.color }} />
                {track.name}
              </summary>
              <div className="sound-controls">
                {soundControlMeta.map((control) => (
                  <label className="mini-control" key={`${track.id}-${control.key}`}>
                    <span>
                      {control.label}
                      <strong>{track.sound[control.key]}</strong>
                    </span>
                    <input
                      min="0"
                      max="100"
                      type="range"
                      value={track.sound[control.key]}
                      onChange={(event) =>
                        setTrackSoundParam(track.id, control.key, Number(event.target.value))
                      }
                    />
                  </label>
                ))}
              </div>
            </details>
          ))}
        </div>
      </aside>
    </main>
  );
}

export default App;
