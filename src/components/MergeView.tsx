import { useState, useEffect, useCallback } from "react";
import { BranchManager } from "../loro/branchManager";

interface MergeViewProps {
  noteId: string;
  currentBranchId: string;
  currentBranchName: string;
  onClose: () => void;
  onMerged: () => void;
}

interface DiffLine {
  type: "add" | "delete" | "equal";
  text: string;
}

interface DiffWord {
  type: "add" | "delete" | "equal";
  text: string;
}

function computeWordDiff(line: DiffLine): DiffWord[] {
  if (line.type === "equal") return [{ type: "equal", text: line.text }];
  if (line.type === "add") return [{ type: "add", text: line.text }];
  if (line.type === "delete") return [{ type: "delete", text: line.text }];
  return [];
}

function computeDiff(oldText: string, newText: string): DiffLine[] {
  const result: DiffLine[] = [];
  const oLen = oldText.length;
  const nLen = newText.length;

  const dp: number[][] = Array.from({ length: oLen + 1 }, () => Array(nLen + 1).fill(0));
  for (let i = 0; i <= oLen; i++) dp[i][0] = i;
  for (let j = 0; j <= nLen; j++) dp[0][j] = j;

  for (let i = 1; i <= oLen; i++) {
    for (let j = 1; j <= nLen; j++) {
      dp[i][j] = oldText[i - 1] === newText[j - 1]
        ? dp[i - 1][j - 1]
        : Math.min(dp[i - 1][j], dp[i][j - 1]) + 1;
    }
  }

  let i = oLen, j = nLen;
  const chars: string[] = [];
  const types: ("add" | "delete" | "equal")[] = [];

  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && oldText[i - 1] === newText[j - 1]) {
      chars.unshift(oldText[i - 1]); types.unshift("equal"); i--; j--;
    } else if (j > 0 && (i === 0 || dp[i][j - 1] <= dp[i - 1][j])) {
      chars.unshift(newText[j - 1]); types.unshift("add"); j--;
    } else {
      chars.unshift(oldText[i - 1]); types.unshift("delete"); i--;
    }
  }

  let curType: "add" | "delete" | "equal" | null = null;
  let curText = "";
  for (let k = 0; k < types.length; k++) {
    if (types[k] !== curType) {
      if (curType && curText) result.push({ type: curType, text: curText });
      curType = types[k];
      curText = chars[k];
    } else {
      curText += chars[k];
    }
  }
  if (curType && curText) result.push({ type: curType, text: curText });

  return result;
}

export function MergeView({ noteId, currentBranchId, currentBranchName, onClose, onMerged }: MergeViewProps) {
  const [branches, setBranches] = useState<{ id: string; name: string }[]>([]);
  const [sourceBranchId, setSourceBranchId] = useState("");
  const [diff, setDiff] = useState<DiffLine[]>([]);
  const [merging, setMerging] = useState(false);
  const [mergeResult, setMergeResult] = useState<string | null>(null);
  const [previewLoaded, setPreviewLoaded] = useState(false);

  const loadBranches = useCallback(async () => {
    const bm = new BranchManager();
    const all = await bm.getNoteBranches(noteId);
    setBranches(all.filter((b) => b.branchId !== currentBranchId).map((b) => ({ id: b.branchId, name: b.name })));
  }, [noteId, currentBranchId]);

  useEffect(() => { loadBranches(); }, [loadBranches]);

  const handlePreview = useCallback(async () => {
    if (!sourceBranchId) return;
    const bm = new BranchManager();
    const target = await bm.getBranchDocument(currentBranchId);
    const source = await bm.getBranchDocument(sourceBranchId);
    if (!target || !source) return;
    const diffs = computeDiff(target.document.text, source.document.text);
    setDiff(diffs);
    setPreviewLoaded(true);
  }, [sourceBranchId, currentBranchId]);

  const handleMerge = useCallback(async () => {
    if (!sourceBranchId) return;
    setMerging(true);
    const bm = new BranchManager();
    const result = await bm.mergeBranches(currentBranchId, sourceBranchId);
    setMerging(false);
    if (result) {
      setDiff(result);
      setMergeResult(`Merged "${branches.find((b) => b.id === sourceBranchId)?.name || "unknown"}" into "${currentBranchName}"`);
      onMerged();
    }
  }, [sourceBranchId, currentBranchId, currentBranchName, branches, onMerged]);

  const adds = diff.filter((d) => d.type === "add").reduce((s, d) => s + d.text.length, 0);
  const dels = diff.filter((d) => d.type === "delete").reduce((s, d) => s + d.text.length, 0);

  return (
    <div className="panel merge-panel">
      <div className="panel-header">
        <h2>Merge Branches</h2>
        <button className="btn-close" onClick={onClose}>&times;</button>
      </div>

      <div className="merge-info">
        <div className="merge-branch-label">
          Target: <strong>{currentBranchName}</strong>
        </div>
      </div>

      <div className="merge-selector">
        <select value={sourceBranchId} onChange={(e) => { setSourceBranchId(e.target.value); setPreviewLoaded(false); setDiff([]); }}>
          <option value="">Select source branch...</option>
          {branches.map((b) => (
            <option key={b.id} value={b.id}>{b.name}</option>
          ))}
        </select>
        <button className="btn-preview" disabled={!sourceBranchId} onClick={handlePreview}>
          Preview diff
        </button>
      </div>

      {previewLoaded && diff.length > 0 && (
        <>
          <div className="diff-stats">
            <span className="diff-stat added">+{adds} added</span>
            <span className="diff-stat removed">-{dels} removed</span>
          </div>

          <div className="diff-lines">
            {diff.map((line, i) => {
              const words = computeWordDiff(line);
              return (
                <div key={i} className={`diff-line ${line.type}`}>
                  <span className="diff-marker">{line.type === "add" ? "+" : line.type === "delete" ? "-" : " "}</span>
                  <span className="diff-text">
                    {words.map((w, wi) => (
                      <span key={wi} className={w.type !== "equal" ? `diff-word-${w.type}` : ""}>
                        {w.text}
                      </span>
                    ))}
                  </span>
                </div>
              );
            })}
          </div>

          <div className="merge-actions">
            <button className="btn-merge" disabled={merging} onClick={handleMerge}>
              {merging ? "Merging..." : "Merge into current branch"}
            </button>
          </div>
        </>
      )}

      {mergeResult && (
        <div className="merge-success">&#x2714; {mergeResult}</div>
      )}
    </div>
  );
}
