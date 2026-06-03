import { useState, useEffect, useCallback, useRef } from "react";
import { getNoteMeta, getAllNoteIds } from "../store/tinybaseStore";
import { BranchManager } from "../loro/branchManager";
import { toast } from "../hooks/useToast";

interface CommandPaletteProps {
  open: boolean;
  selectedNoteId: string;
  onClose: () => void;
  onSelectNote: (id: string) => void;
  onSelectBranch: (branchId: string, branchName: string) => void;
  onFocusMode: () => void;
  onMergeMode: () => void;
  onExportNote: (noteId: string) => void;
  focusMode: boolean;
}

interface Command {
  id: string;
  label: string;
  shortcut?: string;
  section: string;
  action: () => void;
  keywords?: string;
}

export function CommandPalette({
  open,
  selectedNoteId,
  onClose,
  onSelectNote,
  onSelectBranch,
  onFocusMode,
  onMergeMode,
  onExportNote,
  focusMode,
}: CommandPaletteProps) {
  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const [noteBranches, setNoteBranches] = useState<{ id: string; name: string; noteId: string }[]>([]);

  useEffect(() => {
    if (open) {
      setQuery("");
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);
      loadBranches();
    }
  }, [open]);

  const loadBranches = useCallback(async () => {
    const bm = new BranchManager();
    const ids = getAllNoteIds();
    const all: { id: string; name: string; noteId: string }[] = [];
    for (const nid of ids) {
      const branches = await bm.getNoteBranches(nid);
      for (const b of branches) {
        all.push({ id: b.branchId, name: b.name, noteId: nid });
      }
    }
    setNoteBranches(all);
  }, []);

  const commands: Command[] = [
    ...getAllNoteIds().map((id) => {
      const meta = getNoteMeta(id);
      return {
        id: `note-${id}`,
        label: meta?.title || "Untitled",
        section: "Notes",
        action: () => onSelectNote(id),
        keywords: meta?.title + " " + (meta?.tags || ""),
      };
    }),
    ...noteBranches
      .filter((b) => b.noteId === selectedNoteId)
      .map((b) => ({
        id: `branch-${b.id}`,
        label: `${b.name}`,
        section: "Branches",
        action: () => onSelectBranch(b.id, b.name),
        keywords: b.name,
      })),
    {
      id: "cmd-focus",
      label: focusMode ? "Exit Focus Mode" : "Enter Focus Mode",
      shortcut: "Ctrl+B",
      section: "View",
      action: onFocusMode,
    },
    {
      id: "cmd-merge",
      label: "Open Merge View",
      shortcut: "Ctrl+\\",
      section: "Actions",
      action: onMergeMode,
    },
    {
      id: "cmd-export",
      label: "Export Current Note as Markdown",
      section: "Actions",
      action: () => onExportNote(selectedNoteId),
    },
    {
      id: "cmd-new",
      label: "Create New Note",
      shortcut: "Ctrl+N",
      section: "Actions",
      action: () => {
        onClose();
        toast("Create a note from the sidebar + button");
      },
    },
  ];

  const filtered = query
    ? commands.filter(
        (c) =>
          c.label.toLowerCase().includes(query.toLowerCase()) ||
          (c.keywords?.toLowerCase().includes(query.toLowerCase()))
      )
    : commands;

  const sections = new Map<string, Command[]>();
  for (const cmd of filtered) {
    if (!sections.has(cmd.section)) sections.set(cmd.section, []);
    sections.get(cmd.section)!.push(cmd);
  }

  const flatList: Command[] = [];
  for (const [, cmds] of sections) flatList.push(...cmds);

  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") { onClose(); return; }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex((i) => Math.min(i + 1, flatList.length - 1));
      return;
    }
    if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex((i) => Math.max(i - 1, 0));
      return;
    }
    if (e.key === "Enter") {
      e.preventDefault();
      const cmd = flatList[selectedIndex];
      if (cmd) { cmd.action(); onClose(); }
    }
  };

  if (!open) return null;

  return (
    <div className="palette-overlay" onClick={onClose}>
      <div className="palette" onClick={(e) => e.stopPropagation()}>
        <div className="palette-header">
          <span className="palette-icon">&#x2318;</span>
          <input
            ref={inputRef}
            type="text"
            className="palette-input"
            placeholder="Search notes, branches, commands..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
          />
          <span className="palette-esc">Esc</span>
        </div>
        <div className="palette-results">
          {flatList.length === 0 && (
            <div className="palette-empty">No results</div>
          )}
          {Array.from(sections.entries()).map(([section, cmds]) => (
            <div key={section} className="palette-section">
              <div className="palette-section-label">{section}</div>
              {cmds.map((cmd) => {
                const idx = flatList.indexOf(cmd);
                return (
                  <div
                    key={cmd.id}
                    className={`palette-item ${idx === selectedIndex ? "selected" : ""}`}
                    onClick={() => { cmd.action(); onClose(); }}
                    onMouseEnter={() => setSelectedIndex(idx)}
                  >
                    <span className="palette-item-icon">
                      {cmd.section === "Notes" ? "\uD83D\uDCC4" : cmd.section === "Branches" ? "\u2387" : "\u2699"}
                    </span>
                    <span className="palette-item-label">{cmd.label}</span>
                    {cmd.shortcut && <span className="palette-item-shortcut">{cmd.shortcut}</span>}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
        <div className="palette-footer">
          <span><kbd>&uarr;</kbd><kbd>&darr;</kbd> Navigate</span>
          <span><kbd>Enter</kbd> Select</span>
          <span><kbd>Esc</kbd> Close</span>
        </div>
      </div>
    </div>
  );
}
