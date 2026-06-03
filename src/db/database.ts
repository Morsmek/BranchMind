import Dexie, { type Table } from "dexie";

export interface NoteSnapshot {
  id?: number;
  noteId: string;
  branchId: string;
  snapshot: Uint8Array;
  peerId: string;
  timestamp: number;
  createdAt: number;
}

export interface BranchRecord {
  id?: number;
  branchId: string;
  noteId: string;
  name: string;
  parentBranchId: string | null;
  snapshot: Uint8Array;
  checkpoints: string;
  peerId: string;
  createdAt: number;
}

class BranchMindDB extends Dexie {
  noteSnapshots!: Table<NoteSnapshot, number>;
  branches!: Table<BranchRecord, number>;

  constructor() {
    super("BranchMindDB");
    this.version(2).stores({
      noteSnapshots: "++id, noteId, branchId, timestamp",
      branches: "++id, branchId, noteId",
    });
  }
}

export const db = new BranchMindDB();
