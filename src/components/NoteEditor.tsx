import { useState, useEffect, useCallback, useRef } from "react";
import { NoteDocument } from "../loro/noteDocument";
import { BranchManager } from "../loro/branchManager";
import {
  updateNoteTitle as updateStoreTitle,
  updateNoteTags as updateStoreTags,
  getNoteMeta,
  deleteNote as deleteStoreNote,
  getAllNoteIds,
} from "../store/tinybaseStore";
import { toast } from "../hooks/useToast";

interface NoteEditorProps {
  noteId: string;
  branchId: string;
  branchName: string;
  onBranchChange: (branchId: string, branchName: string) => void;
  onNoteDeleted: () => void;
}

function formatRelative(ms: number): string {
  const diff = (Date.now() - ms) / 1000;
  if (diff < 5) return "just now";
  if (diff < 60) return `${Math.floor(diff)}s ago`;
  return `${Math.floor(diff / 60)}m ago`;
}

function highlightMarkdown(text: string): React.ReactNode[] {
  const lines = text.split("\n");
  return lines.map((line, i) => {
    if (!line) return <br key={i} />;
    let className = "";
    if (/^#{1,3}\s/.test(line)) className = "md-heading";
    else if (/^[-*]\s/.test(line)) className = "md-list";
    else if (/^\d+\.\s/.test(line)) className = "md-list";
    else if (/^>\s/.test(line)) className = "md-quote";
    else if (/^```/.test(line)) className = "md-code";
    else if (/^---$/.test(line)) className = "md-hr";

    const rendered = line.split(/(\*\*.*?\*\*|__.*?__|`.*?`)/g).map((part, j) => {
      if (/^\*\*.*\*\*$/.test(part)) return <strong key={j}>{part.slice(2, -2)}</strong>;
      if (/^__.*__$/.test(part)) return <strong key={j}>{part.slice(2, -2)}</strong>;
      if (/^`.*`$/.test(part)) return <code key={j}>{part.slice(1, -1)}</code>;
      return part;
    });

    return (
      <div key={i} className={className ? `syntax-line ${className}` : "syntax-line"}>
        {rendered}
      </div>
    );
  });
}

function renderLine(line: string): React.ReactNode {
  if (!line) return "\u00A0";
  if (/^#{1,3}\s/.test(line)) {
    const match = line.match(/^(#{1,3})\s(.*)/);
    if (match) {
      const level = match[1].length;
      if (level === 1) return <h2>{renderInline(match[2])}</h2>;
      if (level === 2) return <h3>{renderInline(match[2])}</h3>;
      return <h4>{renderInline(match[2])}</h4>;
    }
  }
  if (/^[-*]\s/.test(line)) return <span className="list-item">&bull; {renderInline(line.replace(/^[-*]\s/, ""))}</span>;
  if (/^\d+\.\s/.test(line)) return <span className="list-item">{renderInline(line)}</span>;
  if (/^---$/.test(line)) return <hr />;
  if (line.startsWith("> ")) return <em>{renderInline(line.slice(2))}</em>;
  return <span>{renderInline(line)}</span>;
}

function renderInline(text: string): React.ReactNode {
  const parts = text.split(/(\*\*.*?\*\*|__.*?__|\*.*?\*|_.*?_|`.*?`)/g);
  return parts.map((part, i) => {
    if (/^\*\*.*\*\*$/.test(part) || /^__.*__$/.test(part))
      return <strong key={i}>{part.slice(2, -2)}</strong>;
    if (/^\*.*\*$/.test(part) || /^_.*_$/.test(part))
      return <em key={i}>{part.slice(1, -1)}</em>;
    if (/^`.*`$/.test(part)) return <code key={i}>{part.slice(1, -1)}</code>;
    return part;
  });
}

function countWords(text: string): number {
  return text.trim() ? text.trim().split(/\s+/).length : 0;
}

function exportNote(title: string, text: string, tags: string[]): void {
  const frontmatter = tags.length > 0
    ? `---\ntags: [${tags.join(", ")}]\n---\n\n`
    : "";
  const content = frontmatter + text;
  const blob = new Blob([content], { type: "text/markdown" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${title.replace(/[^a-z0-9]/gi, "_").slice(0, 50) || "note"}.md`;
  a.click();
  URL.revokeObjectURL(url);
  toast(`Exported "${title}" as Markdown`, "success");
}

export function NoteEditor({ noteId, branchId, branchName, onNoteDeleted }: NoteEditorProps) {
  const [doc, setDoc] = useState<NoteDocument | null>(null);
  const [text, setText] = useState("");
  const [title, setTitle] = useState("");
  const [tagsInput, setTagsInput] = useState("");
  const [saving, setSaving] = useState(false);
  const [editMode, setEditMode] = useState(true);
  const [showSyntax, setShowSyntax] = useState(false);
  const [undoStack, setUndoStack] = useState<string[]>([]);
  const [redoStack, setRedoStack] = useState<string[]>([]);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const lastSavedRef = useRef(0);
  const ignoreNextChange = useRef(false);

  const loadDocument = useCallback(async () => {
    const bm = new BranchManager();
    const result = await bm.getBranchDocument(branchId);
    if (result) {
      setDoc(result.document);
      setText(result.document.text);
      lastSavedRef.current = Date.now();
      setUndoStack([]);
      setRedoStack([]);
      const meta = getNoteMeta(noteId);
      if (meta) {
        setTitle(meta.title || "");
        try {
          setTagsInput(JSON.parse(meta.tags || "[]").join(", "));
        } catch { setTagsInput(""); }
      }
    }
  }, [noteId, branchId]);

  useEffect(() => { loadDocument(); }, [loadDocument]);

  const saveDocument = useCallback(async () => {
    if (!doc) return;
    setSaving(true);
    const bm = new BranchManager();
    doc.setText(text);
    doc.commit();
    await bm.saveBranchDocument(branchId, doc);
    if (title) updateStoreTitle(noteId, title);
    const parsedTags = tagsInput.split(",").map((t) => t.trim()).filter(Boolean);
    updateStoreTags(noteId, parsedTags);
    lastSavedRef.current = Date.now();
    setSaving(false);
  }, [doc, text, title, tagsInput, branchId, noteId]);

  useEffect(() => {
    const handle = setInterval(() => {
      if (doc && text !== doc.text) saveDocument();
    }, 3000);
    return () => clearInterval(handle);
  }, [doc, text, saveDocument]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey;
      if (mod && e.key === "s") { e.preventDefault(); saveDocument(); }
      if (mod && e.key === "z" && !e.shiftKey && undoStack.length > 0) {
        e.preventDefault();
        const prev = undoStack[undoStack.length - 1];
        setRedoStack((r) => [...r, text]);
        setUndoStack((u) => u.slice(0, -1));
        ignoreNextChange.current = true;
        setText(prev);
      }
      if (mod && e.key === "z" && e.shiftKey && redoStack.length > 0) {
        e.preventDefault();
        const next = redoStack[redoStack.length - 1];
        setUndoStack((u) => [...u, text]);
        setRedoStack((r) => r.slice(0, -1));
        ignoreNextChange.current = true;
        setText(next);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [text, undoStack, redoStack, saveDocument]);

  const handleTextChange = (newText: string) => {
    if (!ignoreNextChange.current && newText !== text) {
      setUndoStack((u) => [...u.slice(-49), text]);
      setRedoStack([]);
    }
    ignoreNextChange.current = false;
    setText(newText);
  };

  const handleDeleteNote = async () => {
    if (!confirm(`Delete "${title || "Untitled"}"? This cannot be undone.`)) return;
    const bm = new BranchManager();
    const branches = await bm.getNoteBranches(noteId);
    for (const b of branches) await bm.deleteBranch(b.branchId);
    deleteStoreNote(noteId);
    toast(`Deleted "${title || "Untitled"}"`, "success");
    const remaining = getAllNoteIds();
    if (remaining.length > 0) onNoteDeleted();
  };

  const handleExport = () => {
    let noteTags: string[] = [];
    try { noteTags = JSON.parse(getNoteMeta(noteId)?.tags || "[]"); } catch {}
    exportNote(title, text, noteTags);
  };

  const wordCount = countWords(text);

  if (!doc) {
    return (
      <div className="panel editor-panel">
        <div className="empty-state"><p>Loading note...</p></div>
      </div>
    );
  }

  return (
    <div className="panel editor-panel">
      <div className="editor-toolbar">
        <div className="toolbar-left">
          <div className="branch-indicator">
            <span className="branch-dot" /> {branchName}
          </div>
          <button className={`toolbar-btn ${editMode ? "active" : ""}`} onClick={() => setEditMode(true)}>Write</button>
          <button className={`toolbar-btn ${!editMode ? "active" : ""}`} onClick={() => { saveDocument(); setEditMode(false); }}>
            Preview
          </button>
          <span style={{ width: 1, height: 16, background: "var(--border)", margin: "0 4px" }} />
          <button
            className="toolbar-btn"
            disabled={undoStack.length === 0}
            onClick={() => {
              const prev = undoStack[undoStack.length - 1];
              setRedoStack((r) => [...r, text]);
              setUndoStack((u) => u.slice(0, -1));
              setText(prev);
            }}
            title="Undo (Ctrl+Z)"
          >&#x21A9;</button>
          <button
            className="toolbar-btn"
            disabled={redoStack.length === 0}
            onClick={() => {
              const next = redoStack[redoStack.length - 1];
              setUndoStack((u) => [...u, text]);
              setRedoStack((r) => r.slice(0, -1));
              setText(next);
            }}
            title="Redo (Ctrl+Shift+Z)"
          >&#x21AA;</button>
          <span style={{ width: 1, height: 16, background: "var(--border)", margin: "0 4px" }} />
          <button
            className={`toolbar-btn ${showSyntax ? "active" : ""}`}
            onClick={() => setShowSyntax(!showSyntax)}
            title="Syntax highlighting"
          >&#x2327;</button>
        </div>
        <div className="toolbar-right">
          <button className="toolbar-btn" onClick={handleExport} title="Export as Markdown">
            &#x2913; Export
          </button>
          <button className="toolbar-btn" onClick={handleDeleteNote} title="Delete note" style={{ color: "var(--danger)" }}>
            &#x1F5D1;
          </button>
          {saving && <span className="saving-indicator">Saving</span>}
        </div>
      </div>

      <div className="note-metadata">
        <input
          className="title-input"
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onBlur={() => saveDocument()}
          placeholder="Untitled"
        />
        <input
          className="tags-input"
          type="text"
          value={tagsInput}
          onChange={(e) => setTagsInput(e.target.value)}
          placeholder="Add tags, comma separated..."
        />
      </div>

      {editMode ? (
        <div className="editor-area" style={{ flex: 1, display: "flex", position: "relative", overflow: "hidden" }}>
          {showSyntax && (
            <div className="syntax-overlay" aria-hidden="true">
              {highlightMarkdown(text)}
            </div>
          )}
          <textarea
            ref={textareaRef}
            className="editor-textarea"
            value={text}
            onChange={(e) => handleTextChange(e.target.value)}
            placeholder="Start writing..."
            spellCheck={false}
          />
        </div>
      ) : (
        <div className="editor-preview">
          {text.split("\n").map((line, i) => (
            <div key={i} className="preview-line">{renderLine(line)}</div>
          ))}
        </div>
      )}

      <div className="status-bar">
        <div className="status-item">{text.length} chars &middot; {wordCount} words &middot; {text.split("\n").length} lines</div>
        <div className="status-item">
          {saving ? "Saving..." : lastSavedRef.current ? `Saved ${formatRelative(lastSavedRef.current)}` : ""}
        </div>
      </div>
    </div>
  );
}
