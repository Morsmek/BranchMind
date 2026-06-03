import { useEffect, useState, useCallback, useRef } from "react";
import { getStore, getUniqueTags, type NoteRow } from "../store/tinybaseStore";
import { BranchManager } from "../loro/branchManager";
import { addNote as addNoteToStore } from "../store/tinybaseStore";

interface NoteListProps {
  selectedNoteId: string;
  onSelectNote: (id: string) => void;
  searchOpen: boolean;
}

function formatTime(ts: number): string {
  if (!ts) return "";
  const diff = Date.now() - ts;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "now";
  if (mins < 60) return `${mins}m`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d`;
  return `${Math.floor(days / 30)}mo`;
}

function getPreview(content: string): string {
  const lines = content
    .replace(/^#+\s+/gm, "")
    .split("\n")
    .filter((l) => l.trim());
  return lines[0]?.slice(0, 100) || "Empty note";
}

export function NoteList({ selectedNoteId, onSelectNote, searchOpen }: NoteListProps) {
  const [notes, setNotes] = useState<NoteRow[]>([]);
  const [tags, setTags] = useState<string[]>([]);
  const [search, setSearch] = useState("");
  const [selectedTag, setSelectedTag] = useState("");
  const newTitleRef = useRef<HTMLInputElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

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
    const lid = store.addTablesListener(() => refreshData());
    return () => { store.delListener(lid); };
  }, [refreshData]);

  useEffect(() => {
    if (searchOpen) searchRef.current?.focus();
  }, [searchOpen]);

  const filtered = notes.filter((n) => {
    if (search && !n.title.toLowerCase().includes(search.toLowerCase())) return false;
    if (selectedTag) {
      try {
        const nt: string[] = JSON.parse(n.tags);
        if (!nt.includes(selectedTag)) return false;
      } catch { return false; }
    }
    return true;
  });

  const handleNewNote = useCallback(async () => {
    const title = newTitleRef.current?.value?.trim() || "Untitled";
    const bm = new BranchManager();
    const { noteId, branchId } = await bm.createNote();
    addNoteToStore(noteId, title, [], branchId);
    if (newTitleRef.current) newTitleRef.current.value = "";
    onSelectNote(noteId);
  }, [onSelectNote]);

  return (
    <div className="panel note-list-panel">
      <div className="panel-header">
        <h2>Notes</h2>
        <span style={{ fontSize: 10, color: "var(--text-muted)" }}>{notes.length}</span>
      </div>

      <div className="search-bar">
        <input
          ref={searchRef}
          type="text"
          placeholder={searchOpen ? "Type to search notes..." : "Search notes... (\u2318K)"}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {tags.length > 0 && (
        <div className="tag-filters">
          <button className={`tag-chip ${selectedTag === "" ? "active" : ""}`} onClick={() => setSelectedTag("")}>
            All
          </button>
          {tags.map((tag) => (
            <button key={tag} className={`tag-chip ${selectedTag === tag ? "active" : ""}`}
              onClick={() => setSelectedTag((t) => (t === tag ? "" : tag))}>
              {tag}
            </button>
          ))}
        </div>
      )}

      <div className="note-list">
        {filtered.length === 0 && (
          <div className="empty-state">
            <div className="empty-icon">{search || selectedTag ? "\uD83D\uDD0D" : "\uD83D\uDCDD"}</div>
            <p>{search || selectedTag ? "No notes match" : "No notes yet"}</p>
          </div>
        )}
        {filtered.map((note) => {
          let noteTags: string[] = [];
          try { noteTags = JSON.parse(note.tags); } catch {}
          return (
            <div
              key={note.id}
              className={`note-item ${note.id === selectedNoteId ? "active" : ""}`}
              onClick={() => onSelectNote(note.id)}
            >
              <div className="note-item-title">{note.title}</div>
              <div className="note-item-preview">{getPreview(note.title)}</div>
              <div className="note-item-meta">
                <span className="note-item-time">{formatTime(note.lastModified)}</span>
                {noteTags.length > 0 && (
                  <div className="note-item-tags">
                    {noteTags.slice(0, 2).map((t) => (
                      <span key={t} className="note-item-tag">{t}</span>
                    ))}
                    {noteTags.length > 2 && <span className="note-item-tag">+{noteTags.length - 2}</span>}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <div className="new-note-bar">
        <input ref={newTitleRef} type="text" placeholder="New note..."
          onKeyDown={(e) => { if (e.key === "Enter") handleNewNote(); }} />
        <button onClick={handleNewNote} title="Create note">+</button>
      </div>
    </div>
  );
}
