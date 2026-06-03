import type { OpId } from "loro-crdt";

export interface NoteMeta {
  id: string;
  title: string;
  tags: string[];
  currentBranchId: string;
  createdAt: number;
  lastModified: number;
}

export interface Branch {
  id: string;
  noteId: string;
  name: string;
  parentBranchId: string | null;
  createdAt: number;
}

export interface VersionSnapshot {
  frontiers: OpId[];
  timestamp: number;
  message: string;
  peerId: string;
}

export interface DiffLine {
  type: "add" | "delete" | "equal";
  text: string;
}
