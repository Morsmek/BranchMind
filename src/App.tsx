import { useState, useEffect, useCallback } from "react";
import type { OpId } from "loro-crdt";
import { OfflineBadge } from "./components/OfflineBadge";
import { NoteList } from "./components/NoteList";
import { NoteEditor } from "./components/NoteEditor";
import { Timeline } from "./components/Timeline";
import { MergeView } from "./components/MergeView";
import { CommandPalette } from "./components/CommandPalette";
import { ToastContainer } from "./components/Toast";
import { BranchGraph } from "./components/BranchGraph";
import { useToast, toast } from "./hooks/useToast";
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
  const [theme, setTheme] = useState<"light" | "dark">(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("branchmind-theme");
      if (saved === "dark" || saved === "light") return saved;
      return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
    }
    return "light";
  });
  const [focusMode, setFocusMode] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const { toasts, removeToast } = useToast();

  const toggleTheme = useCallback(() => {
    setTheme((t) => {
      const next = t === "light" ? "dark" : "light";
      localStorage.setItem("branchmind-theme", next);
      return next;
    });
  }, []);

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
  }, [theme]);

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
            if (result) setBranchName(result.branch.name);
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
    return () => { canceled = true; clearTimeout(timeout); };
  }, []);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey;
      if (mod && e.key === "k") { e.preventDefault(); setPaletteOpen((v) => !v); }
      if (mod && e.key === "b") { e.preventDefault(); setFocusMode((f) => !f); }
      if (mod && e.key === "\\") { e.preventDefault(); setViewMode("merge"); }
      if (e.key === "Escape") {
        if (paletteOpen) { setPaletteOpen(false); return; }
        setFocusMode(false);
        setViewMode("editor");
      }
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [paletteOpen]);

  const handleSelectNote = useCallback(async (id: string) => {
    setSelectedNoteId(id);
    setViewMode("editor");
    setPreviewText("");
    setPaletteOpen(false);
    const meta = getNoteMeta(id);
    if (meta) {
      setBranchId(meta.currentBranchId || "");
      const bm = new BranchManager();
      const result = await bm.getBranchDocument(meta.currentBranchId);
      if (result) setBranchName(result.branch.name);
    }
  }, []);

  const handleBranchChange = useCallback(
    (newBranchId: string, newBranchName: string) => {
      setBranchId(newBranchId);
      setBranchName(newBranchName);
      if (selectedNoteId) updateNoteBranch(selectedNoteId, newBranchId);
      toast(`Switched to branch "${newBranchName}"`, "info");
    },
    [selectedNoteId]
  );

  const handleBranchFromHere = useCallback(
    async (frontiers: OpId[]) => {
      const name = prompt("Branch name:", `idea-${Date.now().toString(36)}`);
      if (!name || !selectedNoteId) return;
      const bm = new BranchManager();
      const newId = await bm.branchFromCheckpoint(branchId, name, frontiers);
      if (newId) {
        handleBranchChange(newId, name);
        toast(`Created branch "${name}"`, "success");
      }
    },
    [branchId, selectedNoteId, handleBranchChange]
  );

  const handleTimeTravel = useCallback((text: string, timestamp: number) => {
    setPreviewText(text);
    setPreviewTimestamp(timestamp);
    setViewMode("preview");
  }, []);

  const handleExportNote = useCallback((noteId: string) => {
    if (!noteId) return;
    const meta = getNoteMeta(noteId);
    if (!meta) return;
    let noteTags: string[] = [];
    try { noteTags = JSON.parse(meta.tags || "[]"); } catch {}
    const bm = new BranchManager();
    bm.getBranchDocument(meta.currentBranchId).then((result) => {
      if (result) {
        const content = noteTags.length
          ? `---\ntags: [${noteTags.join(", ")}]\n---\n\n${result.document.text}`
          : result.document.text;
        const blob = new Blob([content], { type: "text/markdown" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `${(meta.title || "note").replace(/[^a-z0-9]/gi, "_").slice(0, 50)}.md`;
        a.click();
        URL.revokeObjectURL(url);
        toast(`Exported "${meta.title}"`, "success");
      }
    });
  }, []);

  const handleNoteDeleted = useCallback(() => {
    setSelectedNoteId("");
    const store = getStore();
    const ids = store.getRowIds("notes");
    if (ids.length > 0) {
      const id = ids[0];
      handleSelectNote(id);
    }
  }, [handleSelectNote]);

  if (!initialized) {
    return (
      <div className="app-loading">
        <div className="logo">B</div>
        <h1>BranchMind</h1>
        <p>Initializing your knowledge base...</p>
      </div>
    );
  }

  return (
    <div className={`app ${focusMode ? "focus-mode" : ""}`}>
      <CommandPalette
        open={paletteOpen}
        selectedNoteId={selectedNoteId}
        onClose={() => setPaletteOpen(false)}
        onSelectNote={handleSelectNote}
        onSelectBranch={handleBranchChange}
        onFocusMode={() => setFocusMode((f) => !f)}
        onMergeMode={() => setViewMode("merge")}
        onExportNote={handleExportNote}
        focusMode={focusMode}
      />

      <ToastContainer toasts={toasts} onRemove={removeToast} />

      <header className="app-header">
        <div className="header-left">
          <div className="header-logo">B</div>
          <span className="header-title">BranchMind</span>
        </div>
        <div className="header-right">
          <div className="header-actions">
            <button
              className={`header-btn ${viewMode === "editor" ? "active" : ""}`}
              onClick={() => { if (viewMode === "preview") setPreviewText(""); setViewMode("editor"); }}
            >
              <span className="icon">&#x270E;</span> Edit
            </button>
            <button
              className={`header-btn ${viewMode === "merge" ? "active" : ""}`}
              onClick={() => setViewMode("merge")}
            >
              <span className="icon">&#x2B62;</span> Merge <span className="kbd">^\</span>
            </button>
            <button
              className={`header-btn ${paletteOpen ? "active" : ""}`}
              onClick={() => setPaletteOpen((v) => !v)}
            >
              <span className="icon">&#x2318;</span> Command <span className="kbd">^K</span>
            </button>
            <button
              className={`header-btn ${focusMode ? "active" : ""}`}
              onClick={() => setFocusMode((f) => !f)}
            >
              <span className="icon">&#x25A3;</span> Focus <span className="kbd">^B</span>
            </button>
          </div>
          <button className="theme-toggle" onClick={toggleTheme} title="Toggle theme">
            {theme === "light" ? "\u263E" : "\u2600"}
          </button>
          <OfflineBadge />
        </div>
      </header>

      <div className="app-body">
        <NoteList
          selectedNoteId={selectedNoteId}
          onSelectNote={handleSelectNote}
          searchOpen={paletteOpen}
        />

        {selectedNoteId ? (
          <>
            {viewMode === "editor" && (
              <NoteEditor
                noteId={selectedNoteId}
                branchId={branchId}
                branchName={branchName}
                onBranchChange={handleBranchChange}
                onNoteDeleted={handleNoteDeleted}
              />
            )}

            {viewMode === "preview" && (
              <div className="panel preview-panel">
                <div className="preview-banner">
                  <span className="preview-banner-text">
                    &#x1F50D; Read-only preview from {new Date(previewTimestamp).toLocaleString()}
                  </span>
                  <button className="header-btn" onClick={() => setViewMode("editor")}>
                    Back to editing
                  </button>
                </div>
                <div className="preview-content">{previewText}</div>
              </div>
            )}

            {viewMode === "merge" && (
              <MergeView
                noteId={selectedNoteId}
                currentBranchId={branchId}
                currentBranchName={branchName}
                onClose={() => setViewMode("editor")}
                onMerged={() => toast("Branches merged successfully", "success")}
              />
            )}

            <Timeline
              branchId={branchId}
              noteId={selectedNoteId}
              currentBranchName={branchName}
              onBranchFromHere={handleBranchFromHere}
              onTimeTravel={handleTimeTravel}
              onSelectBranch={handleBranchChange}
            >
              <BranchGraph
                noteId={selectedNoteId}
                currentBranchId={branchId}
                onSelectBranch={handleBranchChange}
              />
            </Timeline>
          </>
        ) : (
          <div className="panel empty-editor">
            <div className="empty-state">
              <div className="empty-icon">&#x1F4DD;</div>
              <h2>Welcome to BranchMind</h2>
              <p>Select a note or create a new one. Every edit is versioned — branch, merge, and time-travel through your ideas.</p>
              <div className="shortcuts">
                <div className="shortcut-row"><span className="keys"><kbd>Ctrl</kbd>+<kbd>K</kbd></span><span>Command palette</span></div>
                <div className="shortcut-row"><span className="keys"><kbd>Ctrl</kbd>+<kbd>B</kbd></span><span>Focus mode</span></div>
                <div className="shortcut-row"><span className="keys"><kbd>Ctrl</kbd>+<kbd>\</kbd></span><span>Merge branches</span></div>
                <div className="shortcut-row"><span className="keys"><kbd>Ctrl</kbd>+<kbd>S</kbd></span><span>Save note</span></div>
                <div className="shortcut-row"><span className="keys"><kbd>Ctrl</kbd>+<kbd>Z</kbd></span><span>Undo</span></div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
