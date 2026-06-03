import { useState, useEffect, useCallback } from "react";
import { BranchManager } from "../loro/branchManager";
import type { DiffLine } from "../types";

interface MergeViewProps {
  noteId: string;
  currentBranchId: string;
  currentBranchName: string;
  onClose: () => void;
  onMerged: () => void;
}

export function MergeView({
  noteId,
  currentBranchId,
  currentBranchName,
  onClose,
  onMerged,
}: MergeViewProps) {
  const [branches, setBranches] = useState<
    { id: string; name: string }[]
  >([]);
  const [sourceBranchId, setSourceBranchId] = useState("");
  const [diff, setDiff] = useState<DiffLine[]>([]);
  const [merging, setMerging] = useState(false);
  const [mergeResult, setMergeResult] = useState<string | null>(null);

  const loadBranches = useCallback(async () => {
    const bm = new BranchManager();
    const allBranches = await bm.getNoteBranches(noteId);
    setBranches(
      allBranches
        .filter((b) => b.branchId !== currentBranchId)
        .map((b) => ({ id: b.branchId, name: b.name }))
    );
  }, [noteId, currentBranchId]);

  useEffect(() => {
    loadBranches();
  }, [loadBranches]);

  const handlePreview = useCallback(async () => {
    if (!sourceBranchId) return;
    const bm = new BranchManager();
    const target = await bm.getBranchDocument(currentBranchId);
    const source = await bm.getBranchDocument(sourceBranchId);
    if (!target || !source) return;

    const beforeText = target.document.text;
    const sourceText = source.document.text;

    const diffs: DiffLine[] = [];
    const oldLen = beforeText.length;
    const newLen = sourceText.length;

    const dp: number[][] = Array.from({ length: oldLen + 1 }, () =>
      new Array(newLen + 1).fill(0)
    );
    for (let i = 0; i <= oldLen; i++) dp[i][0] = i;
    for (let j = 0; j <= newLen; j++) dp[0][j] = j;

    for (let i = 1; i <= oldLen; i++) {
      for (let j = 1; j <= newLen; j++) {
        if (beforeText[i - 1] === sourceText[j - 1]) {
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
        beforeText[i - 1] === sourceText[j - 1]
      ) {
        lines.unshift(beforeText[i - 1]);
        types.unshift("equal");
        i--;
        j--;
      } else if (j > 0 && (i === 0 || dp[i][j - 1] <= dp[i - 1][j])) {
        lines.unshift(sourceText[j - 1]);
        types.unshift("add");
        j--;
      } else {
        lines.unshift(beforeText[i - 1]);
        types.unshift("delete");
        i--;
      }
    }

    let currentType: "add" | "delete" | "equal" | null = null;
    let currentText = "";

    for (let k = 0; k < types.length; k++) {
      if (types[k] !== currentType) {
        if (currentType && currentText) {
          diffs.push({ type: currentType, text: currentText });
        }
        currentType = types[k];
        currentText = lines[k];
      } else {
        currentText += lines[k];
      }
    }
    if (currentType && currentText) {
      diffs.push({ type: currentType, text: currentText });
    }

    setDiff(diffs);
  }, [sourceBranchId, currentBranchId]);

  const handleMerge = useCallback(async () => {
    if (!sourceBranchId) return;
    setMerging(true);
    const bm = new BranchManager();
    const result = await bm.mergeBranches(currentBranchId, sourceBranchId);
    setMerging(false);

    if (result) {
      setDiff(result);
      const target = await bm.getBranchDocument(currentBranchId);
      if (target) {
        setMergeResult(
          `Merged "${branches.find((b) => b.id === sourceBranchId)?.name || "unknown"}" into "${currentBranchName}"`
        );
      }
      onMerged();
    }
  }, [
    sourceBranchId,
    currentBranchId,
    currentBranchName,
    branches,
    onMerged,
  ]);

  return (
    <div className="panel merge-panel">
      <div className="panel-header">
        <h2>Merge</h2>
        <button className="btn-close" onClick={onClose}>
          &times;
        </button>
      </div>

      <div className="merge-info">
        <div className="merge-branch-label">
          Target: <strong>{currentBranchName}</strong>
        </div>
      </div>

      <div className="merge-selector">
        <select
          value={sourceBranchId}
          onChange={(e) => setSourceBranchId(e.target.value)}
        >
          <option value="">Select source branch...</option>
          {branches.map((b) => (
            <option key={b.id} value={b.id}>
              {b.name}
            </option>
          ))}
        </select>
        <button
          className="btn-preview"
          disabled={!sourceBranchId}
          onClick={handlePreview}
        >
          Preview
        </button>
      </div>

      {diff.length > 0 && (
        <div className="diff-view">
          <div className="section-label">Changes (side-by-side)</div>
          <div className="diff-lines">
            {diff.map((line, i) => (
              <div
                key={i}
                className={`diff-line diff-${line.type}`}
              >
                <span className="diff-marker">
                  {line.type === "add" ? "+" : line.type === "delete" ? "-" : " "}
                </span>
                <span className="diff-text">
                  {line.text.replace(/\n/g, "\\n")}
                </span>
              </div>
            ))}
          </div>

          <div className="merge-actions">
            <button
              className="btn-merge"
              disabled={merging}
              onClick={handleMerge}
            >
              {merging ? "Merging..." : "Merge into current branch"}
            </button>
          </div>
        </div>
      )}

      {mergeResult && (
        <div className="merge-success">{mergeResult}</div>
      )}
    </div>
  );
}
