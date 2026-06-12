import { useEffect, useState } from "react";
import type { CSSProperties, ReactNode } from "react";
import {
  closestCenter,
  DndContext,
  DragOverlay,
  PointerSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import type { DragEndEvent, DragStartEvent, UniqueIdentifier } from "@dnd-kit/core";
import {
  horizontalListSortingStrategy,
  SortableContext,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { getMasterLevel, startLoop, stopLoop, syncPlaybackMode, syncSongState } from "./audio/transport";
import { useSongStore } from "./store/songStore";
import type { ArrangementBlock, Snapshot, TrackId } from "./types/song";

const patternLengthOptions = [16, 32, 48, 64, 128];

const soundControlMeta = [
  { key: "tone", label: "Tone" },
  { key: "decay", label: "Decay" },
  { key: "drive", label: "Drive" },
  { key: "filter", label: "Filter" },
] as const;

type DragData =
  | { type: "library-pattern"; patternId: string; label: string }
  | { type: "song-block"; blockId: string; label: string };

const timelineDroppableId = "song-timeline";
const timelineEndDroppableId = "song-timeline-end";
const libraryDragId = (patternId: string) => `library-pattern:${patternId}`;

function MasterMeter() {
  const [level, setLevel] = useState(0);

  useEffect(() => {
    let frame = 0;
    let smoothedLevel = 0;

    const tick = () => {
      smoothedLevel = smoothedLevel * 0.72 + getMasterLevel() * 0.28;
      setLevel(smoothedLevel);
      frame = requestAnimationFrame(tick);
    };

    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, []);

  const safeWidth = Math.min(level, 0.82) * 100;
  const hotWidth = Math.max(0, level - 0.82) * 100;

  return (
    <div className="master-meter" aria-label="Master output meter" title={`Output ${Math.round(level * 100)}%`}>
      <span className="meter-safe" style={{ width: `${safeWidth}%` }} />
      <span className="meter-hot" style={{ width: `${hotWidth}%` }} />
    </div>
  );
}

function LibraryPattern({
  pattern,
  onSelect,
}: {
  pattern: Snapshot;
  onSelect: (patternId: string) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: libraryDragId(pattern.id),
    data: {
      type: "library-pattern",
      patternId: pattern.id,
      label: pattern.name || "Untitled",
    } satisfies DragData,
  });

  return (
    <button
      className={`library-pattern ${isDragging ? "is-dragging" : ""}`}
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform) }}
      onClick={() => onSelect(pattern.id)}
      {...attributes}
      {...listeners}
    >
      {pattern.name || "Untitled"}
    </button>
  );
}

function SongBlock({
  block,
  patternName,
  isSelected,
  isPlaying,
  onSelect,
  onLengthChange,
  onRemove,
}: {
  block: ArrangementBlock;
  patternName: string;
  isSelected: boolean;
  isPlaying: boolean;
  onSelect: (blockId: string) => void;
  onLengthChange: (blockId: string, lengthBars: number) => void;
  onRemove: (blockId: string) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: block.id,
    data: {
      type: "song-block",
      blockId: block.id,
      label: patternName,
    } satisfies DragData,
  });

  return (
    <article
      className={`song-block ${isSelected ? "is-selected" : ""} ${isPlaying ? "is-playing" : ""} ${
        isDragging ? "is-dragging" : ""
      }`}
      ref={setNodeRef}
      style={{
        flexGrow: block.lengthBars,
        transform: CSS.Transform.toString(transform),
        transition,
      }}
      onClick={() => onSelect(block.id)}
      {...attributes}
      {...listeners}
    >
      <div className="section-label">
        <strong>{patternName}</strong>
        <span>
          Bar {block.startBar} / {block.lengthBars} bars
        </span>
      </div>
      <div className="block-controls" onPointerDown={(event) => event.stopPropagation()} onClick={(event) => event.stopPropagation()}>
        <label>
          <span>Duration</span>
          <input
            min="1"
            max="64"
            type="number"
            value={block.lengthBars}
            onChange={(event) => onLengthChange(block.id, Number(event.target.value))}
          />
        </label>
        <button className="icon-button danger-button" onClick={() => onRemove(block.id)}>
          Remove
        </button>
      </div>
    </article>
  );
}

function SongTimeline({
  children,
  isEmpty,
  isDropReady,
}: {
  children: ReactNode;
  isEmpty: boolean;
  isDropReady: boolean;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: timelineDroppableId });

  return (
    <div
      className={`timeline ${isEmpty ? "is-empty" : ""} ${isDropReady || isOver ? "is-drop-ready" : ""}`}
      ref={setNodeRef}
    >
      {children}
    </div>
  );
}

function TimelineEndDropZone() {
  const { setNodeRef, isOver } = useDroppable({ id: timelineEndDroppableId });

  return <div className={`timeline-end-zone ${isOver ? "is-active" : ""}`} ref={setNodeRef} />;
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
    setActiveView,
    selectSnapshot,
    selectArrangementBlock,
    renameSelectedSnapshot,
    createSnapshot,
    duplicateSelectedSnapshot,
    deleteSelectedSnapshot,
    addSnapshotToArrangementAt,
    deleteArrangementBlock,
    setArrangementBlockLength,
    reorderArrangementBlock,
    toggleStep,
    setTrackVolume,
    setTrackPatternLength,
    setTrackSoundParam,
    toggleTrackMute,
    toggleTrackSolo,
    generateLoop,
  } = useSongStore();

  const [activeDragData, setActiveDragData] = useState<DragData | null>(null);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }));
  const activeView = song.activeView;

  useEffect(() => {
    syncSongState(song);
  }, [song]);

  useEffect(() => {
    syncPlaybackMode(activeView);
    stopLoop(setCurrentStep);
    setPlaying(false);
    setCurrentStep(-1);
  }, [activeView, setCurrentStep, setPlaying]);

  const selectedPattern =
    song.snapshots.find((pattern) => pattern.id === song.selectedSnapshotId) ?? song.snapshots[0];
  const maxPatternLength = Math.max(...song.tracks.map((track) => track.patternLength));
  const stepLabels = Array.from({ length: maxPatternLength }, (_, step) => step + 1);
  const sequencerGridStyle = {
    gridTemplateColumns: `128px 210px repeat(${maxPatternLength}, minmax(20px, 1fr))`,
  };

  const getTrackSteps = (trackId: TrackId) =>
    selectedPattern ? song.patterns[selectedPattern.patternIds[trackId]] ?? [] : [];

  const arrangementTotalSteps = song.arrangementBlocks.reduce(
    (total, block) => total + Math.max(1, block.lengthBars) * 16,
    0,
  );
  const arrangementPlayheadPercent =
    activeView === "arrangement" && currentStep >= 0 && arrangementTotalSteps > 0
      ? ((currentStep + 0.5) / arrangementTotalSteps) * 100
      : null;
  const playingArrangementBlock = (() => {
    if (activeView !== "arrangement" || currentStep < 0) return null;

    let cursorStep = 0;
    for (const block of song.arrangementBlocks) {
      const blockSteps = Math.max(1, block.lengthBars) * 16;
      if (currentStep >= cursorStep && currentStep < cursorStep + blockSteps) {
        return block.id;
      }
      cursorStep += blockSteps;
    }

    return null;
  })();

  const handlePlayStop = async () => {
    if (isPlaying) {
      stopLoop(setCurrentStep);
      setPlaying(false);
      return;
    }

    await startLoop({ ...song, activeView }, setCurrentStep);
    setPlaying(true);
  };

  const moveBlockToIndex = (blockId: string, toIndex: number) => {
    const fromIndex = song.arrangementBlocks.findIndex((block) => block.id === blockId);

    if (fromIndex < 0) return;

    reorderArrangementBlock(fromIndex, Math.max(0, Math.min(toIndex, song.arrangementBlocks.length - 1)));
  };

  const getDragDataFromEvent = (id: UniqueIdentifier, data: unknown): DragData | null => {
    if (
      data &&
      typeof data === "object" &&
      "type" in data &&
      (data.type === "library-pattern" || data.type === "song-block")
    ) {
      return data as DragData;
    }

    const stringId = String(id);
    if (stringId.startsWith("library-pattern:")) {
      const patternId = stringId.replace("library-pattern:", "");
      const pattern = song.snapshots.find((candidate) => candidate.id === patternId);
      return { type: "library-pattern", patternId, label: pattern?.name || "Untitled" };
    }

    const block = song.arrangementBlocks.find((candidate) => candidate.id === stringId);
    if (block) {
      const pattern = song.snapshots.find((candidate) => candidate.id === block.snapshotId);
      return { type: "song-block", blockId: block.id, label: pattern?.name || "Missing" };
    }

    return null;
  };

  const handleDragStart = (event: DragStartEvent) => {
    const dragData = getDragDataFromEvent(event.active.id, event.active.data.current);
    setActiveDragData(dragData);

    if (dragData?.type === "song-block") {
      selectArrangementBlock(dragData.blockId);
    }
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const dragData = getDragDataFromEvent(event.active.id, event.active.data.current);
    const overId = event.over?.id;

    if (!dragData || !overId) {
      setActiveDragData(null);
      return;
    }

    const overIndex = song.arrangementBlocks.findIndex((block) => block.id === overId);
    const shouldAppend = overId === timelineDroppableId || overId === timelineEndDroppableId;
    const insertIndex = shouldAppend ? song.arrangementBlocks.length : overIndex;

    if (dragData.type === "library-pattern" && insertIndex >= 0) {
      addSnapshotToArrangementAt(dragData.patternId, insertIndex);
    }

    if (dragData.type === "song-block") {
      const targetIndex = shouldAppend ? song.arrangementBlocks.length - 1 : overIndex;
      if (targetIndex >= 0) {
        moveBlockToIndex(dragData.blockId, targetIndex);
      }
    }

    setActiveDragData(null);
  };

  return (
    <main className="app-shell">
      <header className="topbar app-topbar">
        <div>
          <p className="eyebrow">Pulseframe</p>
          <h1>Minimal Techno Sketchpad</h1>
        </div>
        <nav className="screen-tabs" aria-label="Workspace">
          <button className={activeView === "pattern" ? "is-selected" : ""} onClick={() => setActiveView("pattern")}>
            Pattern Studio
          </button>
          <button
            className={activeView === "arrangement" ? "is-selected" : ""}
            onClick={() => setActiveView("arrangement")}
          >
            Arrangement
          </button>
        </nav>
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
          <label className="header-control">
            <span>Density</span>
            <input
              min="0"
              max="100"
              type="range"
              value={song.density}
              onChange={(event) => setDensity(Number(event.target.value))}
            />
            <strong>{song.density}</strong>
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

      {activeView === "pattern" ? (
        <section className="workspace full-workspace" aria-label="Pattern Studio">
          <section className="pattern-strip" aria-label="Patterns">
            {song.snapshots.map((pattern) => (
              <button
                className={`pattern-chip ${pattern.id === song.selectedSnapshotId ? "is-selected" : ""}`}
                key={pattern.id}
                onClick={() => selectSnapshot(pattern.id)}
              >
                {pattern.name || "Untitled"}
              </button>
            ))}
            <button className="pattern-chip add-chip" onClick={createSnapshot} aria-label="Create pattern">
              +
            </button>
          </section>

          <div className="studio-grid">
            <section className="sequencer" aria-label="Step Sequencer">
              <div className="sequencer-title">
                <div>
                  <p className="eyebrow">Pattern Studio</p>
                  <h2>{selectedPattern?.name ?? "Pattern"}</h2>
                </div>
                <label className="rename-inline">
                  <span>Name</span>
                  <input
                    value={selectedPattern?.name ?? ""}
                    onChange={(event) => renameSelectedSnapshot(event.target.value)}
                  />
                </label>
                <button className="secondary-button compact-command" onClick={duplicateSelectedSnapshot}>
                  Duplicate
                </button>
                <button
                  className="secondary-button compact-command danger-button"
                  onClick={deleteSelectedSnapshot}
                  disabled={song.snapshots.length <= 1}
                >
                  Delete
                </button>
              </div>

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
                      style={{ "--track-color": track.color } as CSSProperties}
                      aria-label={`${track.name} step ${step + 1}`}
                      aria-pressed={active}
                    />
                  ))}
                </div>
              ))}
            </section>

            <aside className="control-panel embedded-panel" aria-label="PF Instruments">
              <label className="control-group">
                <span>
                  Swing
                  <strong>{song.swing}</strong>
                </span>
                <input
                  min="0"
                  max="35"
                  type="range"
                  value={song.swing}
                  onChange={(event) => setSwing(Number(event.target.value))}
                />
              </label>

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
          </div>
        </section>
      ) : (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
          onDragCancel={() => setActiveDragData(null)}
        >
          <section className="workspace arrangement-workspace" aria-label="Arrangement">
            <aside className="pattern-library" aria-label="Pattern library">
              <div className="panel-title compact-title">
                <p className="eyebrow">Patterns</p>
                <h2>Library</h2>
              </div>
              {song.snapshots.map((pattern) => (
                <LibraryPattern key={pattern.id} pattern={pattern} onSelect={selectSnapshot} />
              ))}
            </aside>

            <section className="arrangement-board" aria-label="Song arrangement">
              <div className="arrangement-heading">
                <div>
                  <p className="eyebrow">Song</p>
                  <h2>Arrangement</h2>
                </div>
                <span>{song.arrangementBlocks.length} blocks</span>
              </div>
              <SongTimeline
                isEmpty={song.arrangementBlocks.length === 0}
                isDropReady={Boolean(activeDragData)}
              >
                {song.arrangementBlocks.length === 0 && <span className="empty-timeline">Drag a pattern here</span>}
                {arrangementPlayheadPercent !== null && (
                  <span
                    className="arrangement-playhead"
                    style={{ left: `${Math.min(100, Math.max(0, arrangementPlayheadPercent))}%` }}
                  />
                )}
                <SortableContext
                  items={song.arrangementBlocks.map((block) => block.id)}
                  strategy={horizontalListSortingStrategy}
                >
                  {song.arrangementBlocks.map((block) => {
                    const pattern = song.snapshots.find((candidate) => candidate.id === block.snapshotId);

                    return (
                      <SongBlock
                        block={block}
                        isSelected={block.id === song.selectedArrangementBlockId}
                        isPlaying={block.id === playingArrangementBlock}
                        key={block.id}
                        patternName={pattern?.name ?? "Missing"}
                        onLengthChange={setArrangementBlockLength}
                        onRemove={deleteArrangementBlock}
                        onSelect={selectArrangementBlock}
                      />
                    );
                  })}
                </SortableContext>
                {song.arrangementBlocks.length > 0 && <TimelineEndDropZone />}
              </SongTimeline>
            </section>
          </section>
          <DragOverlay>
            {activeDragData ? <div className="drag-overlay">{activeDragData.label}</div> : null}
          </DragOverlay>
        </DndContext>
      )}
    </main>
  );
}

export default App;
