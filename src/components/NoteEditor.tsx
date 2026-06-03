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
}

export function NoteEditor({
  noteId,
  branchId,
  branchName,
}: NoteEditorProps) {
  const [doc, setDoc] = useState<NoteDocument | null>(null);
  const [text, setText] = useState("");
  const [title, setTitle] = useState("");
  const [tagsInput, setTagsInput] = useState("");
  const [saving, setSaving] = useState(false);
  const [editMode, setEditMode] = useState(true);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const loadDocument = useCallback(async () => {
    const bm = new BranchManager();
    const result = await bm.getBranchDocument(branchId);
    if (result) {
      setDoc(result.document);
      setText(result.document.text);
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

  useEffect(() => {
    loadDocument();
  }, [loadDocument]);

  const saveDocument = useCallback(async () => {
    if (!doc) return;
    setSaving(true);
    const bm = new BranchManager();
    doc.setText(text);
    doc.commit();
    await bm.saveBranchDocument(branchId, doc);

    if (title) updateStoreTitle(noteId, title);

    const parsedTags = tagsInput
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean);
    updateStoreTags(noteId, parsedTags);

    setSaving(false);
  }, [doc, text, title, tagsInput, branchId, noteId]);

  useEffect(() => {
    const handle = setInterval(() => {
      if (doc && text !== doc.text) {
        saveDocument();
      }
    }, 3000);
    return () => clearInterval(handle);
  }, [doc, text, saveDocument]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "s") {
        e.preventDefault();
        saveDocument();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [saveDocument]);

  if (!doc) {
    return (
      <div className="panel editor-panel">
        <div className="panel-header">
          <h2>Editor</h2>
        </div>
        <div className="empty-state">Loading note...</div>
      </div>
    );
  }

  return (
    <div className="panel editor-panel">
      <div className="editor-header">
        <div className="branch-indicator">
          <span className="branch-icon">&#x2387;</span>
          <span className="branch-name">{branchName}</span>
        </div>
        <div className="editor-actions">
          <button
            className={`mode-toggle ${editMode ? "active" : ""}`}
            onClick={() => setEditMode(true)}
            title="Edit mode"
          >
            Edit
          </button>
          <button
            className={`mode-toggle ${!editMode ? "active" : ""}`}
            onClick={() => {
              saveDocument();
              setEditMode(false);
            }}
            title="Preview mode"
          >
            Preview
          </button>
          {saving && <span className="saving-indicator">Saving...</span>}
        </div>
      </div>

      <div className="note-metadata">
        <input
          className="title-input"
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onBlur={() => saveDocument()}
          placeholder="Note title..."
        />
        <input
          className="tags-input"
          type="text"
          value={tagsInput}
          onChange={(e) => setTagsInput(e.target.value)}
          placeholder="Tags (comma separated)..."
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
          {text
            .split("\n")
            .map((line, i) => (
              <div key={i} className="preview-line">
                {renderLine(line)}
              </div>
            ))}
        </div>
      )}
    </div>
  );
}

function renderLine(line: string): React.ReactNode {
  if (line.startsWith("### ")) {
    return <h4>{line.slice(4)}</h4>;
  }
  if (line.startsWith("## ")) {
    return <h3>{line.slice(3)}</h3>;
  }
  if (line.startsWith("# ")) {
    return <h2>{line.slice(2)}</h2>;
  }
  if (line.startsWith("- ")) {
    return <span className="list-item">&bull; {line.slice(2)}</span>;
  }
  if (line.startsWith("1. ") || line.startsWith("2. ") || line.startsWith("3. ") || line.startsWith("4. ")) {
    return <span className="list-item">{line}</span>;
  }
  if (line.trim() === "") {
    return <br />;
  }
  return <span>{renderInline(line)}</span>;
}

function renderInline(text: string): React.ReactNode {
  const parts = text.split(/(\*\*.*?\*\*)/g);
  return parts.map((part, i) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return <strong key={i}>{part.slice(2, -2)}</strong>;
    }
    return part;
  });
}
