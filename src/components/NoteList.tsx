import { useEffect, useState, useCallback, useRef } from "react";
import { getStore, getUniqueTags, type NoteRow } from "../store/tinybaseStore";
import { BranchManager } from "../loro/branchManager";
import { addNote as addNoteToStore } from "../store/tinybaseStore";

interface NoteListProps {
  selectedNoteId: string;
  onSelectNote: (id: string) => void;
}

export function NoteList({ selectedNoteId, onSelectNote }: NoteListProps) {
  const [notes, setNotes] = useState<NoteRow[]>([]);
  const [tags, setTags] = useState<string[]>([]);
  const [search, setSearch] = useState("");
  const [selectedTag, setSelectedTag] = useState("");
  const newTitleRef = useRef<HTMLInputElement>(null);

  const refreshData = useCallback(() => {
    const store = getStore();
    const ids = store.getRowIds("notes");
    const rows: NoteRow[] = [];
    for (const id of ids) {
      const row = store.getRow("notes", id);
      if (row) {
        rows.push({
          id,
          title: String(row.title ?? "Untitled"),
          tags: String(row.tags ?? "[]"),
          currentBranchId: String(row.currentBranchId ?? ""),
          createdAt: Number(row.createdAt ?? 0),
          lastModified: Number(row.lastModified ?? 0),
        });
      }
    }
    rows.sort((a, b) => b.lastModified - a.lastModified);
    setNotes(rows);
    setTags(getUniqueTags());
  }, []);

  useEffect(() => {
    refreshData();
    const store = getStore();
    const listenerId = store.addTablesListener(() => {
      refreshData();
    });
    return () => {
      store.delListener(listenerId);
    };
  }, [refreshData]);

  const filtered = notes.filter((n) => {
    const matchesSearch =
      !search ||
      n.title.toLowerCase().includes(search.toLowerCase());
    const matchesTag =
      !selectedTag ||
      (() => {
        try {
          const noteTags: string[] = JSON.parse(n.tags);
          return noteTags.includes(selectedTag);
        } catch {
          return false;
        }
      })();
    return matchesSearch && matchesTag;
  });

  const handleNewNote = useCallback(async () => {
    const title = newTitleRef.current?.value?.trim() || "Untitled";
    const bm = new BranchManager();
    const { noteId, branchId } = await bm.createNote();
    addNoteToStore(noteId, title, [], branchId);
    if (newTitleRef.current) newTitleRef.current.value = "";
    onSelectNote(noteId);
  }, [onSelectNote]);

  const formatTime = (ts: number): string => {
    if (!ts) return "";
    const diff = Date.now() - ts;
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return "just now";
    if (mins < 60) return `${mins}m ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
  };

  return (
    <div className="panel note-list-panel">
      <div className="panel-header">
        <h2>Notes</h2>
      </div>

      <div className="search-bar">
        <input
          type="text"
          placeholder="Search notes..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {tags.length > 0 && (
        <div className="tag-filters">
          <button
            className={`tag-chip ${selectedTag === "" ? "active" : ""}`}
            onClick={() => setSelectedTag("")}
          >
            All
          </button>
          {tags.map((tag) => (
            <button
              key={tag}
              className={`tag-chip ${selectedTag === tag ? "active" : ""}`}
              onClick={() =>
                setSelectedTag(selectedTag === tag ? "" : tag)
              }
            >
              {tag}
            </button>
          ))}
        </div>
      )}

      <div className="note-list">
        {filtered.length === 0 && (
          <div className="empty-state">
            {search || selectedTag
              ? "No notes match your filters"
              : "No notes yet. Create one below."}
          </div>
        )}
        {filtered.map((note) => (
          <div
            key={note.id}
            className={`note-item ${note.id === selectedNoteId ? "active" : ""}`}
            onClick={() => onSelectNote(note.id)}
          >
            <div className="note-item-title">{note.title}</div>
            <div className="note-item-meta">
              <span className="note-item-time">
                {formatTime(note.lastModified)}
              </span>
              <span className="note-item-tag-count">
                {(() => {
                  try {
                    const t: string[] = JSON.parse(note.tags);
                    return t.length > 0 ? `${t.length} tags` : "";
                  } catch {
                    return "";
                  }
                })()}
              </span>
            </div>
          </div>
        ))}
      </div>

      <div className="new-note-bar">
        <input
          ref={newTitleRef}
          type="text"
          placeholder="New note title..."
          onKeyDown={(e) => {
            if (e.key === "Enter") handleNewNote();
          }}
        />
        <button onClick={handleNewNote} title="Create note">
          +
        </button>
      </div>
    </div>
  );
}
