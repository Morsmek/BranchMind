import { useState, useEffect, useCallback } from "react";
import type { OpId } from "loro-crdt";
import { BranchManager } from "../loro/branchManager";
import type { Checkpoint } from "../loro/noteDocument";

interface TimelineProps {
  branchId: string;
  noteId: string;
  currentBranchName: string;
  onBranchFromHere: (frontiers: OpId[]) => void;
  onTimeTravel: (text: string, timestamp: number) => void;
  onSelectBranch: (branchId: string, branchName: string) => void;
  children?: React.ReactNode;
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

function truncateText(text: string, maxLen: number = 60): string {
  const firstLine = text.split("\n")[0] || "";
  if (firstLine.length > maxLen) return firstLine.slice(0, maxLen) + "...";
  return firstLine;
}

export function Timeline({
  branchId,
  noteId,
  onBranchFromHere,
  onTimeTravel,
  onSelectBranch,
  children,
}: TimelineProps) {
  const [checkpoints, setCheckpoints] = useState<Checkpoint[]>([]);
  const [branches, setBranches] = useState<{ id: string; name: string; parentId: string | null }[]>([]);
  const [selectedCheckpoint, setSelectedCheckpoint] = useState<number | null>(null);
  const [previewCheckpoint, setPreviewCheckpoint] = useState<number | null>(null);

  const loadData = useCallback(async () => {
    const bm = new BranchManager();
    const result = await bm.getBranchDocument(branchId);
    if (!result) return;
    setCheckpoints(result.document.checkpoints);
    const allBranches = await bm.getNoteBranches(noteId);
    setBranches(
      allBranches.map((b) => ({ id: b.branchId, name: b.name, parentId: b.parentBranchId }))
    );
  }, [branchId, noteId]);

  useEffect(() => { loadData(); }, [loadData]);

  const handleTimeTravel = (index: number) => {
    if (selectedCheckpoint === index) {
      setSelectedCheckpoint(null);
      return;
    }
    setSelectedCheckpoint(index);
    const cp = checkpoints[index];
    if (cp) onTimeTravel(cp.text, cp.timestamp);
  };

  const activeBranches = branches.filter((b) => b.id === branchId);
  const otherBranches = branches.filter((b) => b.id !== branchId);

  return (
    <div className="panel timeline-panel">
      <div className="panel-header">
        <h2>History</h2>
      </div>

      {branches.length > 0 && (
        <div className="branch-section">
          <div className="section-label">Branches</div>
          {activeBranches.map((b) => (
            <div key={b.id} className="branch-mini active">
              <span className="branch-mini-dot" /> {b.name} <span style={{ fontSize: 9, color: "var(--text-muted)", marginLeft: "auto" }}>current</span>
            </div>
          ))}
          {otherBranches.map((b) => (
            <div
              key={b.id}
              className="branch-mini"
              onClick={() => onSelectBranch(b.id, b.name)}
              title={`Switch to ${b.name}`}
            >
              <span className="branch-mini-dot" /> {b.name}
            </div>
          ))}
        </div>
      )}

      {children}

      <div className="timeline-section-label">
        <span>Versions</span>
        <span className="timeline-count">{checkpoints.length}</span>
      </div>

      <div className="timeline-list">
        {checkpoints.length === 0 && (
          <div className="empty-state">
            <div className="empty-icon">&#x23F0;</div>
            <p>No versions yet</p>
            <span className="empty-hint">Start typing to create history</span>
          </div>
        )}
        {[...checkpoints].reverse().map((cp, i) => {
          const realIndex = checkpoints.length - 1 - i;
          return (
            <div
              key={realIndex}
              className={`timeline-item ${selectedCheckpoint === realIndex ? "selected" : ""}`}
              onClick={() => handleTimeTravel(realIndex)}
              onMouseEnter={() => setPreviewCheckpoint(realIndex)}
              onMouseLeave={() => setPreviewCheckpoint(null)}
            >
              <div className="timeline-dot" />
              <div className="timeline-content">
                <div className="timeline-message">
                  {cp.message || `Version #${i + 1}`}
                </div>
                <div className="timeline-time">{formatRelativeTime(cp.timestamp)}</div>
                {previewCheckpoint === realIndex && (
                  <div className="timeline-preview">{truncateText(cp.text)}</div>
                )}
              </div>
              <div className="timeline-actions">
                <button
                  className="btn-branch"
                  onClick={(e) => { e.stopPropagation(); onBranchFromHere(cp.frontiers); }}
                  title="Branch from here"
                >
                  &#x2387;
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
