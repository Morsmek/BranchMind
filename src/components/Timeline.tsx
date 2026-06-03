import { useState, useEffect, useCallback } from "react";
import type { OpId } from "loro-crdt";
import { type Checkpoint } from "../loro/noteDocument";
import { BranchManager } from "../loro/branchManager";

interface TimelineProps {
  branchId: string;
  noteId: string;
  onBranchFromHere: (
    frontiers: OpId[]
  ) => void;
  onTimeTravel: (text: string, timestamp: number) => void;
}

function formatRelativeTime(ts: number): string {
  if (!ts) return "";
  const diff = Date.now() - ts;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  return `${months}mo ago`;
}

function truncatePreview(text: string, maxLen: number = 80): string {
  const firstLine = text.split("\n")[0] || "";
  if (firstLine.length > maxLen) {
    return firstLine.slice(0, maxLen) + "...";
  }
  return firstLine;
}

export function Timeline({
  branchId,
  noteId,
  onBranchFromHere,
  onTimeTravel,
}: TimelineProps) {
  const [checkpoints, setCheckpoints] = useState<Checkpoint[]>([]);
  const [branches, setBranches] = useState<
    { id: string; name: string; parentId: string | null }[]
  >([]);
  const [selectedCheckpoint, setSelectedCheckpoint] = useState<number | null>(
    null
  );
  const [previewCheckpoint, setPreviewCheckpoint] = useState<number | null>(
    null
  );

  const loadData = useCallback(async () => {
    const bm = new BranchManager();
    const result = await bm.getBranchDocument(branchId);
    if (!result) return;

    const cps = result.document.checkpoints;
    setCheckpoints(cps);

    const allBranches = await bm.getNoteBranches(noteId);
    setBranches(
      allBranches.map((b) => ({
        id: b.branchId,
        name: b.name,
        parentId: b.parentBranchId,
      }))
    );
  }, [branchId, noteId]);

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 5000);
    return () => clearInterval(interval);
  }, [loadData]);

  const handleTimeTravel = (index: number): void => {
    if (selectedCheckpoint === index) {
      setSelectedCheckpoint(null);
      return;
    }
    setSelectedCheckpoint(index);
    const cp = checkpoints[index];
    if (cp) {
      onTimeTravel(cp.text, cp.timestamp);
    }
  };

  return (
    <div className="panel timeline-panel">
      <div className="panel-header">
        <h2>History</h2>
      </div>

      {branches.length > 1 && (
        <div className="branch-list">
          <div className="section-label">Branches</div>
          {branches.map((b) => (
            <div
              key={b.id}
              className={`branch-chip ${b.id === branchId ? "active" : ""}`}
            >
              <span className="branch-icon">&#x2387;</span> {b.name}
            </div>
          ))}
        </div>
      )}

      <div className="timeline-header">
        <span className="section-label">
          Versions ({checkpoints.length})
        </span>
      </div>

      <div className="timeline-list">
        {checkpoints.length === 0 && (
          <div className="empty-state">No versions yet. Start typing to create history.</div>
        )}
        {checkpoints.map((cp, i) => (
          <div
            key={i}
            className={`timeline-item ${selectedCheckpoint === i ? "selected" : ""}`}
            onClick={() => handleTimeTravel(i)}
            onMouseEnter={() => setPreviewCheckpoint(i)}
            onMouseLeave={() => setPreviewCheckpoint(null)}
          >
            <div className="timeline-dot" />
            <div className="timeline-content">
              <div className="timeline-message">
                {cp.message || `Version ${checkpoints.length - i}`}
              </div>
              <div className="timeline-time">
                {formatRelativeTime(cp.timestamp)}
              </div>
              {previewCheckpoint === i && (
                <div className="timeline-preview">
                  {truncatePreview(cp.text)}
                </div>
              )}
            </div>
            <div className="timeline-actions">
              <button
                className="btn-branch"
                onClick={(e) => {
                  e.stopPropagation();
                  onBranchFromHere(cp.frontiers);
                }}
                title="Branch from this version"
              >
                &#x2387;
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
