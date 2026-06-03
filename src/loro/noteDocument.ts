import { LoroDoc, type OpId } from "loro-crdt";

export interface Checkpoint {
  frontiers: OpId[];
  timestamp: number;
  message: string;
  text: string;
}

export class NoteDocument {
  doc: LoroDoc;
  checkpointIndex: Checkpoint[] = [];

  constructor() {
    this.doc = new LoroDoc();
    this.doc.setRecordTimestamp(true);
    this.doc.setPeerId(BigInt(Date.now()) % BigInt(1_000_000));
  }

  static fromSnapshot(snapshot: Uint8Array, checkpoints?: Checkpoint[]): NoteDocument {
    const nd = new NoteDocument();
    nd.doc = LoroDoc.fromSnapshot(snapshot);
    nd.doc.setRecordTimestamp(true);
    if (checkpoints) {
      nd.checkpointIndex = checkpoints;
    }
    return nd;
  }

  get peerId(): string {
    return this.doc.peerId.toString();
  }

  exportSnapshot(): Uint8Array {
    this.doc.commit();
    return this.doc.export({ mode: "snapshot" });
  }

  get text(): string {
    const t = this.doc.getText("content");
    return t ? t.toString() : "";
  }

  setText(text: string): void {
    const t = this.doc.getText("content");
    t.update(text);
  }

  commit(message?: string): void {
    this.doc.commit({ message: message ?? "", timestamp: Date.now() / 1000 });
    const cf = this.doc.frontiers();
    this.checkpointIndex.push({
      frontiers: cf,
      timestamp: Date.now(),
      message: message ?? "",
      text: this.text,
    });
  }

  get frontiers(): OpId[] {
    return this.doc.frontiers();
  }

  checkout(frontiers: OpId[]): void {
    this.doc.checkout(frontiers);
  }

  checkoutToLatest(): void {
    this.doc.checkoutToLatest();
  }

  isDetached(): boolean {
    return this.doc.isDetached();
  }

  fork(): NoteDocument {
    this.doc.commit();
    const forked = this.doc.fork();
    const nd = new NoteDocument();
    nd.doc = forked;
    nd.doc.setRecordTimestamp(true);
    nd.checkpointIndex = [...this.checkpointIndex];
    return nd;
  }

  forkAt(frontiers: OpId[]): NoteDocument {
    this.doc.commit();
    const forked = this.doc.forkAt(frontiers);
    const nd = new NoteDocument();
    nd.doc = forked;
    nd.doc.setRecordTimestamp(true);
    nd.checkpointIndex = [...this.checkpointIndex];
    return nd;
  }

  mergeFrom(other: NoteDocument): void {
    other.doc.commit();
    const updates = other.doc.export({ mode: "update" });
    this.doc.import(updates);
    this.doc.commit();
    const cf = this.doc.frontiers();
    this.checkpointIndex.push({
      frontiers: cf,
      timestamp: Date.now(),
      message: "merge",
      text: this.text,
    });
  }

  diff(
    fromFrontiers: OpId[],
    toFrontiers: OpId[]
  ) {
    return this.doc.diff(fromFrontiers, toFrontiers, true);
  }

  get checkpoints(): Checkpoint[] {
    return this.checkpointIndex;
  }

  serializeCheckpoints(): string {
    const plain = this.checkpointIndex.map((cp) => ({
      frontiers: cp.frontiers.map((f) => ({ peer: f.peer, counter: f.counter })),
      timestamp: cp.timestamp,
      message: cp.message,
      text: cp.text,
    }));
    return JSON.stringify(plain);
  }

  static deserializeCheckpoints(json: string): Checkpoint[] {
    try {
      const parsed = JSON.parse(json);
      return parsed.map((cp: {
        frontiers: { peer: string; counter: number }[];
        timestamp: number;
        message: string;
        text: string;
      }) => ({
        frontiers: cp.frontiers.map((f) => ({ peer: f.peer as `${number}`, counter: f.counter })),
        timestamp: cp.timestamp,
        message: cp.message,
        text: cp.text,
      }));
    } catch {
      return [];
    }
  }
}
