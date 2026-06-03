import { createStore, type Store } from "tinybase";
import { createIndexedDbPersister } from "tinybase/persisters/persister-indexed-db";

export interface NoteRow {
  id: string;
  title: string;
  tags: string;
  currentBranchId: string;
  createdAt: number;
  lastModified: number;
}

let store: Store | null = null;
let persisterInitialized = false;

export function getStore(): Store {
  if (!store) {
    store = createStore();
    store.setTablesSchema({
      notes: {
        title: { type: "string", default: "Untitled" },
        tags: { type: "string", default: "[]" },
        currentBranchId: { type: "string", default: "" },
        createdAt: { type: "number", default: 0 },
        lastModified: { type: "number", default: 0 },
      },
    });
    store.setValuesSchema({
      searchQuery: { type: "string", default: "" },
      selectedNoteId: { type: "string", default: "" },
      selectedTag: { type: "string", default: "" },
    });
  }
  return store;
}

export async function initPersistence(): Promise<void> {
  if (persisterInitialized) return;
  persisterInitialized = true;

  try {
    const s = getStore();
    const persister = createIndexedDbPersister(s, "BranchMindMeta");
    await persister.load();
    persister.startAutoSave();
  } catch (e) {
    console.warn("Persistence init failed, running in-memory:", e);
  }
}

export function addNote(
  id: string,
  title: string,
  tags: string[],
  branchId: string
): void {
  const s = getStore();
  const now = Date.now();
  s.setRow("notes", id, {
    title,
    tags: JSON.stringify(tags),
    currentBranchId: branchId,
    createdAt: now,
    lastModified: now,
  });
}

export function updateNoteTitle(id: string, title: string): void {
  const s = getStore();
  s.setCell("notes", id, "title", title);
  s.setCell("notes", id, "lastModified", Date.now());
}

export function updateNoteTags(id: string, tags: string[]): void {
  const s = getStore();
  s.setCell("notes", id, "tags", JSON.stringify(tags));
  s.setCell("notes", id, "lastModified", Date.now());
}

export function updateNoteBranch(id: string, branchId: string): void {
  const s = getStore();
  s.setCell("notes", id, "currentBranchId", branchId);
  s.setCell("notes", id, "lastModified", Date.now());
}

export function deleteNote(id: string): void {
  const s = getStore();
  s.delRow("notes", id);
}

export function getNoteMeta(id: string): NoteRow | undefined {
  const s = getStore();
  const row = s.getRow("notes", id);
  if (!row) return undefined;
  return {
    id,
    title: String(row.title ?? "Untitled"),
    tags: String(row.tags ?? "[]"),
    currentBranchId: String(row.currentBranchId ?? ""),
    createdAt: Number(row.createdAt ?? 0),
    lastModified: Number(row.lastModified ?? 0),
  };
}

export function getAllNoteIds(): string[] {
  const s = getStore();
  return s.getRowIds("notes");
}

export function setSearchQuery(query: string): void {
  const s = getStore();
  s.setValue("searchQuery", query);
}

export function setSelectedNoteId(id: string): void {
  const s = getStore();
  s.setValue("selectedNoteId", id);
}

export function setSelectedTag(tag: string): void {
  const s = getStore();
  s.setValue("selectedTag", tag);
}

export function getUniqueTags(): string[] {
  const s = getStore();
  const tagSet = new Set<string>();
  const rowIds = s.getRowIds("notes");
  for (const id of rowIds) {
    const row = s.getRow("notes", id);
    if (row?.tags) {
      try {
        const tags: string[] = JSON.parse(String(row.tags));
        for (const tag of tags) {
          tagSet.add(tag);
        }
      } catch {
        // ignore
      }
    }
  }
  return Array.from(tagSet).sort();
}
