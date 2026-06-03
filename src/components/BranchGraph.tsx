import { useState, useEffect, useCallback } from "react";
import { BranchManager } from "../loro/branchManager";

interface BranchGraphProps {
  noteId: string;
  currentBranchId: string;
  onSelectBranch: (branchId: string, branchName: string) => void;
}

interface BranchNode {
  id: string;
  name: string;
  parentId: string | null;
  x: number;
  y: number;
}

export function BranchGraph({ noteId, currentBranchId, onSelectBranch }: BranchGraphProps) {
  const [branches, setBranches] = useState<BranchNode[]>([]);
  const [expanded, setExpanded] = useState(false);

  const loadBranches = useCallback(async () => {
    const bm = new BranchManager();
    const all = await bm.getNoteBranches(noteId);
    const nodes: BranchNode[] = [];
    let y = 20;
    const mainBranch = all.find((b) => !b.parentBranchId) || all[0];
    if (mainBranch) {
      nodes.push({ id: mainBranch.branchId, name: mainBranch.name, parentId: null, x: 20, y });
    }
    for (const b of all) {
      if (b.branchId !== mainBranch?.branchId) {
        y += 36;
        nodes.push({ id: b.branchId, name: b.name, parentId: b.parentBranchId, x: 40, y });
      }
    }
    setBranches(nodes);
  }, [noteId]);

  useEffect(() => {
    if (expanded) loadBranches();
  }, [expanded, loadBranches]);

  if (!expanded) {
    return (
      <div style={{ padding: "8px 16px", borderBottom: "1px solid var(--border)" }}>
        <button
          className="header-btn"
          onClick={() => setExpanded(true)}
          style={{ width: "100%", justifyContent: "center" }}
        >
          &#x2387; Branch Graph
        </button>
      </div>
    );
  }

  return (
    <div style={{ padding: "8px 16px 12px", borderBottom: "1px solid var(--border)", position: "relative" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
        <span className="section-label">Branch Graph</span>
        <button
          onClick={() => setExpanded(false)}
          style={{ fontSize: 11, border: "none", background: "none", color: "var(--text-muted)", cursor: "pointer" }}
        >
          Hide
        </button>
      </div>
      <div style={{ position: "relative", minHeight: Math.max(branches.length * 36, 36) }}>
        <svg style={{ position: "absolute", inset: 0, width: "100%", height: "100%", pointerEvents: "none" }}>
          {branches
            .filter((b) => b.parentId)
            .map((b) => {
              const parent = branches.find((p) => p.id === b.parentId);
              if (!parent) return null;
              return (
                <line
                  key={b.id}
                  x1={parent.x + 16}
                  y1={parent.y + 8}
                  x2={b.x + 16}
                  y2={b.y + 8}
                  stroke="var(--accent-border)"
                  strokeWidth={1.5}
                  strokeDasharray={b.id !== currentBranchId ? "4 2" : "none"}
                />
              );
            })}
        </svg>
        {branches.map((b) => (
          <div
            key={b.id}
            onClick={() => onSelectBranch(b.id, b.name)}
            style={{
              position: "absolute",
              left: b.x,
              top: b.y,
              display: "flex",
              alignItems: "center",
              gap: 6,
              cursor: "pointer",
              padding: "2px 8px",
              borderRadius: 4,
              background: b.id === currentBranchId ? "var(--accent-light)" : "transparent",
              border: b.id === currentBranchId ? "1px solid var(--accent-border)" : "1px solid transparent",
              fontSize: 11,
              fontWeight: 500,
              color: b.id === currentBranchId ? "var(--accent)" : "var(--text-secondary)",
            }}
          >
            <span
              style={{
                width: 6,
                height: 6,
                borderRadius: "50%",
                background: b.id === currentBranchId ? "var(--accent)" : "var(--text-muted)",
                flexShrink: 0,
              }}
            />
            {b.name}
          </div>
        ))}
      </div>
    </div>
  );
}
