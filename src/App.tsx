import { useState, useEffect, useCallback } from "react";
import type { OpId } from "loro-crdt";
import { OfflineBadge } from "./components/OfflineBadge";
import { NoteList } from "./components/NoteList";
import { NoteEditor } from "./components/NoteEditor";
import { Timeline } from "./components/Timeline";
import { MergeView } from "./components/MergeView";
import {
  getStore,
  getNoteMeta,
  initPersistence,
  updateNoteBranch,
} from "./store/tinybaseStore";
import { BranchManager } from "./loro/branchManager";
import { seedIfEmpty } from "./seed";

type ViewMode = "editor" | "merge" | "preview";

export default function App() {
  const [selectedNoteId, setSelectedNoteId] = useState("");
  const [branchId, setBranchId] = useState("");
  const [branchName, setBranchName] = useState("main");
  const [viewMode, setViewMode] = useState<ViewMode>("editor");
  const [previewText, setPreviewText] = useState("");
  const [previewTimestamp, setPreviewTimestamp] = useState(0);
  const [initialized, setInitialized] = useState(false);

  useEffect(() => {
    let canceled = false;
    const timeout = setTimeout(() => {
      if (!canceled) setInitialized(true);
    }, 8000);

    async function init() {
      try {
        await initPersistence();
        await seedIfEmpty();
        if (canceled) return;
        const store = getStore();
        const ids = store.getRowIds("notes");
        if (ids.length > 0) {
          const firstId = ids[0];
          const meta = getNoteMeta(firstId);
          if (meta) {
            setSelectedNoteId(firstId);
            setBranchId(meta.currentBranchId || "");
            const bm = new BranchManager();
            const result = await bm.getBranchDocument(meta.currentBranchId);
            if (result) {
              setBranchName(result.branch.name);
            }
          }
        }
      } catch (e) {
        console.error("Init failed:", e);
      }
      if (!canceled) {
        clearTimeout(timeout);
        setInitialized(true);
      }
    }
    init();
    return () => {
      canceled = true;
      clearTimeout(timeout);
    };
  }, []);

  const handleSelectNote = useCallback(
    async (id: string) => {
      setSelectedNoteId(id);
      setViewMode("editor");
      setPreviewText("");
      const meta = getNoteMeta(id);
      if (meta) {
        setBranchId(meta.currentBranchId || "");
        const bm = new BranchManager();
        const result = await bm.getBranchDocument(meta.currentBranchId);
        if (result) {
          setBranchName(result.branch.name);
        }
      }
    },
    []
  );

  const handleBranchChange = useCallback(
    (newBranchId: string, newBranchName: string) => {
      setBranchId(newBranchId);
      setBranchName(newBranchName);
      if (selectedNoteId) {
        updateNoteBranch(selectedNoteId, newBranchId);
      }
    },
    [selectedNoteId]
  );

  const handleBranchFromHere = useCallback(
    async (frontiers: OpId[]) => {
      const name = prompt("Branch name:", `branch-${Date.now().toString(36)}`);
      if (!name || !selectedNoteId) return;

      const bm = new BranchManager();
      const newBranchId = await bm.branchFromCheckpoint(
        branchId,
        name,
        frontiers
      );
      if (newBranchId) {
        handleBranchChange(newBranchId, name);
      }
    },
    [branchId, selectedNoteId, handleBranchChange]
  );

  const handleTimeTravel = useCallback(
    (text: string, timestamp: number) => {
      setPreviewText(text);
      setPreviewTimestamp(timestamp);
      setViewMode("preview");
    },
    []
  );

  const handleCloseMerge = useCallback(() => {
    setViewMode("editor");
  }, []);

  const handleMerged = useCallback(() => {
    // refresh
  }, []);

  if (!initialized) {
    return (
      <div className="app-loading">
        <h1>BranchMind</h1>
        <p>Loading...</p>
      </div>
    );
  }

  return (
    <div className="app">
      <header className="app-header">
        <div className="app-title">
          <h1>BranchMind</h1>
          <span className="app-subtitle">
            Version-controlled knowledge base
          </span>
        </div>
        <div className="header-right">
          <div className="header-actions">
            <button
              className={`view-btn ${viewMode === "editor" ? "active" : ""}`}
              onClick={() => {
                if (viewMode === "preview") setPreviewText("");
                setViewMode("editor");
              }}
            >
              Editor
            </button>
            <button
              className={`view-btn ${viewMode === "merge" ? "active" : ""}`}
              onClick={() => setViewMode("merge")}
            >
              Merge
            </button>
            {viewMode === "preview" && (
              <button
                className="view-btn active"
                onClick={() => {
                  setPreviewText("");
                  setViewMode("editor");
                }}
              >
                Preview ({new Date(previewTimestamp).toLocaleTimeString()})
              </button>
            )}
          </div>
          <OfflineBadge />
        </div>
      </header>

      <div className="app-body">
        <NoteList
          selectedNoteId={selectedNoteId}
          onSelectNote={handleSelectNote}
        />

        {selectedNoteId ? (
          <>
            {viewMode === "editor" && (
              <NoteEditor
                noteId={selectedNoteId}
                branchId={branchId}
                branchName={branchName}
              />
            )}

            {viewMode === "preview" && (
              <div className="panel preview-panel">
                <div className="panel-header">
                  <h2>Preview</h2>
                  <span className="preview-timestamp">
                    {new Date(previewTimestamp).toLocaleString()}
                  </span>
                </div>
                <div className="preview-content">
                  {previewText
                    .split("\n")
                    .map((line, i) => (
                      <div key={i} className="preview-line">
                        {line || "\u00A0"}
                      </div>
                    ))}
                </div>
              </div>
            )}

            {viewMode === "merge" && (
              <MergeView
                noteId={selectedNoteId}
                currentBranchId={branchId}
                currentBranchName={branchName}
                onClose={handleCloseMerge}
                onMerged={handleMerged}
              />
            )}

            <Timeline
              branchId={branchId}
              noteId={selectedNoteId}
              onBranchFromHere={handleBranchFromHere}
              onTimeTravel={handleTimeTravel}
            />
          </>
        ) : (
          <div className="panel empty-editor">
            <div className="empty-state">
              <h2>BranchMind</h2>
              <p>
                Select a note from the list or create a new one to get started.
              </p>
              <p className="empty-hint">
                Every note is version-controlled. Branch to explore. Merge to
                combine.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
