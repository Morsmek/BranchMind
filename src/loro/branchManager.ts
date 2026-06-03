import { db, type BranchRecord } from "../db/database";
import { NoteDocument } from "./noteDocument";
import type { Branch, DiffLine } from "../types";
import type { OpId } from "loro-crdt";

function generateId(): string {
  return (
    Date.now().toString(36) + Math.random().toString(36).substring(2, 8)
  );
}

export interface BranchWithDoc {
  branch: Branch;
  document: NoteDocument;
}

export class BranchManager {
  async createNote(
    initialContent: string = ""
  ): Promise<{ noteId: string; branchId: string }> {
    const noteId = generateId();
    const branchId = generateId();

    const doc = new NoteDocument();
    if (initialContent) {
      doc.setText(initialContent);
      doc.commit("Initial content");
    }

    const snapshot = doc.exportSnapshot();
    const checkpoints = doc.serializeCheckpoints();
    const record: BranchRecord = {
      branchId,
      noteId,
      name: "main",
      parentBranchId: null,
      snapshot,
      checkpoints,
      peerId: doc.peerId,
      createdAt: Date.now(),
    };
    await db.branches.add(record);

    return { noteId, branchId };
  }

  async getBranchDocument(branchId: string): Promise<BranchWithDoc | null> {
    const record = await db.branches
      .where("branchId")
      .equals(branchId)
      .first();
    if (!record) return null;

    const checkpoints = NoteDocument.deserializeCheckpoints(record.checkpoints || "[]");
    const doc = NoteDocument.fromSnapshot(record.snapshot, checkpoints);
    return {
      branch: {
        id: record.branchId,
        noteId: record.noteId,
        name: record.name,
        parentBranchId: record.parentBranchId,
        createdAt: record.createdAt,
      },
      document: doc,
    };
  }

  async saveBranchDocument(branchId: string, doc: NoteDocument): Promise<void> {
    const snapshot = doc.exportSnapshot();
    const checkpoints = doc.serializeCheckpoints();
    await db.branches.where("branchId").equals(branchId).modify({
      snapshot,
      checkpoints,
      peerId: doc.peerId,
    });
  }

  async branchFromCheckpoint(
    sourceBranchId: string,
    branchName: string,
    frontiers: OpId[]
  ): Promise<string | null> {
    const source = await this.getBranchDocument(sourceBranchId);
    if (!source) return null;

    const newDoc = source.document.forkAt(frontiers);
    const newBranchId = generateId();
    const snapshot = newDoc.exportSnapshot();
    const checkpoints = newDoc.serializeCheckpoints();
    const record: BranchRecord = {
      branchId: newBranchId,
      noteId: source.branch.noteId,
      name: branchName,
      parentBranchId: sourceBranchId,
      snapshot,
      checkpoints,
      peerId: newDoc.peerId,
      createdAt: Date.now(),
    };
    await db.branches.add(record);

    return newBranchId;
  }

  async mergeBranches(
    targetBranchId: string,
    sourceBranchId: string
  ): Promise<DiffLine[] | null> {
    const target = await this.getBranchDocument(targetBranchId);
    const source = await this.getBranchDocument(sourceBranchId);
    if (!target || !source) return null;

    const beforeText = target.document.text;

    target.document.mergeFrom(source.document);

    const afterText = target.document.text;

    await this.saveBranchDocument(targetBranchId, target.document);

    const diffs = this.computeTextDiff(beforeText, afterText);
    return diffs;
  }

  private computeTextDiff(oldText: string, newText: string): DiffLine[] {
    const result: DiffLine[] = [];
    const oldLen = oldText.length;
    const newLen = newText.length;

    const dp: number[][] = Array.from({ length: oldLen + 1 }, () =>
      new Array(newLen + 1).fill(0)
    );

    for (let i = 0; i <= oldLen; i++) dp[i][0] = i;
    for (let j = 0; j <= newLen; j++) dp[0][j] = j;

    for (let i = 1; i <= oldLen; i++) {
      for (let j = 1; j <= newLen; j++) {
        if (oldText[i - 1] === newText[j - 1]) {
          dp[i][j] = dp[i - 1][j - 1];
        } else {
          dp[i][j] = Math.min(dp[i - 1][j], dp[i][j - 1]) + 1;
        }
      }
    }

    let i = oldLen;
    let j = newLen;
    const lines: string[] = [];
    const types: ("add" | "delete" | "equal")[] = [];

    while (i > 0 || j > 0) {
      if (
        i > 0 &&
        j > 0 &&
        oldText[i - 1] === newText[j - 1]
      ) {
        lines.unshift(oldText[i - 1]);
        types.unshift("equal");
        i--;
        j--;
      } else if (j > 0 && (i === 0 || dp[i][j - 1] <= dp[i - 1][j])) {
        lines.unshift(newText[j - 1]);
        types.unshift("add");
        j--;
      } else {
        lines.unshift(oldText[i - 1]);
        types.unshift("delete");
        i--;
      }
    }

    let currentType: "add" | "delete" | "equal" | null = null;
    let currentText = "";

    for (let k = 0; k < types.length; k++) {
      if (types[k] !== currentType) {
        if (currentType && currentText) {
          result.push({ type: currentType, text: currentText });
        }
        currentType = types[k];
        currentText = lines[k];
      } else {
        currentText += lines[k];
      }
    }

    if (currentType && currentText) {
      result.push({ type: currentType, text: currentText });
    }

    return result;
  }

  async getNoteBranches(noteId: string): Promise<BranchRecord[]> {
    return db.branches.where("noteId").equals(noteId).toArray();
  }

  async updateBranchName(
    branchId: string,
    name: string
  ): Promise<void> {
    await db.branches.where("branchId").equals(branchId).modify({ name });
  }

  async deleteBranch(branchId: string): Promise<void> {
    await db.branches.where("branchId").equals(branchId).delete();
  }

  async getBranchByNoteAndName(
    noteId: string,
    name: string
  ): Promise<BranchRecord | undefined> {
    return db.branches
      .where("noteId")
      .equals(noteId)
      .filter((b: BranchRecord) => b.name === name)
      .first();
  }
}
