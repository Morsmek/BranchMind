import { useState, useEffect, useCallback, useRef } from "react";
import { NoteDocument } from "../loro/noteDocument";
import { BranchManager } from "../loro/branchManager";
import {
  updateNoteTitle as updateStoreTitle,
  updateNoteTags as updateStoreTags,
  getNoteMeta,
} from "../store/tinybaseStore";

interface NoteEditorProps {
  noteId: string;
  branchId: string;
  branchName: string;
  onBranchChange: (branchId: string, branchName: string) => void;
}

function renderLine(line: string): React.ReactNode {
  if (!line) return "\u00A0";
  if (/^#{1,6}\s/.test(line)) {
    const level = line.match(/^(#{1,6})/)?.[1].length ?? 1;
    const content = line.replace(/^#{1,6}\s/, "");
    if (level === 1) return <h2>{renderInline(content)}</h2>;
    if (level === 2) return <h3>{renderInline(content)}</h3>;
    return <h4>{renderInline(content)}</h4>;
  }
  if (/^[-*]\s/.test(line)) {
    return <span className="list-item">&bull; {renderInline(line.replace(/^[-*]\s/, ""))}</span>;
  }
  if (/^\d+\.\s/.test(line)) {
    return <span className="list-item">{renderInline(line)}</span>;
  }
  if (/^```/.test(line)) return <code>{line.replace(/^```/, "")}</code>;
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
    if (/^`.*`$/.test(part))
      return <code key={i}>{part.slice(1, -1)}</code>;
    return part;
  });
}

function countWords(text: string): number {
  return text.trim() ? text.trim().split(/\s+/).length : 0;
}

export function NoteEditor({ noteId, branchId, branchName }: NoteEditorProps) {
  const [doc, setDoc] = useState<NoteDocument | null>(null);
  const [text, setText] = useState("");
  const [title, setTitle] = useState("");
  const [tagsInput, setTagsInput] = useState("");
  const [saving, setSaving] = useState(false);
  const [editMode, setEditMode] = useState(true);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const lastSavedRef = useRef(0);

  const loadDocument = useCallback(async () => {
    const bm = new BranchManager();
    const result = await bm.getBranchDocument(branchId);
    if (result) {
      setDoc(result.document);
      setText(result.document.text);
      lastSavedRef.current = Date.now();
      const meta = getNoteMeta(noteId);
      if (meta) {
        setTitle(meta.title || "");
        try {
          const parsed: string[] = JSON.parse(meta.tags || "[]");
          setTagsInput(parsed.join(", "));
        } catch {
          setTagsInput("");
        }
      }
    }
  }, [noteId, branchId]);

  useEffect(() => { loadDocument(); }, [loadDocument]);

  const saveDocument = useCallback(async () => {
    if (!doc || text === doc.text) return;
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
      if (doc && text !== doc.text) {
        setSaving(true);
        saveDocument().then(() => setSaving(false));
      }
    }, 2000);
    return () => clearInterval(handle);
  }, [doc, text, saveDocument]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "s") {
        e.preventDefault();
        saveDocument();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [saveDocument]);

  const wordCount = countWords(text);
  const charCount = text.length;

  if (!doc) {
    return (
      <div className="panel editor-panel">
        <div className="empty-state"><p>Loading...</p></div>
      </div>
    );
  }

  return (
    <div className="panel editor-panel">
      <div className="editor-toolbar">
        <div className="toolbar-left">
          <div className="branch-indicator">
            <span className="branch-dot" />
            {branchName}
          </div>
          <button
            className={`toolbar-btn ${editMode ? "active" : ""}`}
            onClick={() => setEditMode(true)}
          >
            Write
          </button>
          <button
            className={`toolbar-btn ${!editMode ? "active" : ""}`}
            onClick={() => { saveDocument(); setEditMode(false); }}
          >
            Preview
          </button>
        </div>
        <div className="toolbar-right">
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
        <textarea
          ref={textareaRef}
          className="editor-textarea"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Start writing..."
          spellCheck={false}
        />
      ) : (
        <div className="editor-preview">
          {text.split("\n").map((line, i) => (
            <div key={i} className="preview-line">
              {renderLine(line)}
            </div>
          ))}
        </div>
      )}

      <div className="status-bar">
        <div className="status-item">{charCount} chars &middot; {wordCount} words</div>
        <div className="status-item">
          {saving ? "Saving..." : lastSavedRef.current ? `Saved ${formatRelative(lastSavedRef.current)}` : ""}
        </div>
      </div>
    </div>
  );
}

function formatRelative(ms: number): string {
  const diff = (Date.now() - ms) / 1000;
  if (diff < 5) return "just now";
  if (diff < 60) return `${Math.floor(diff)}s ago`;
  return `${Math.floor(diff / 60)}m ago`;
}
