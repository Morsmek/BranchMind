import { BranchManager } from "./loro/branchManager";
import {
  addNote,
  getStore,
  initPersistence,
} from "./store/tinybaseStore";

export async function seedIfEmpty(): Promise<void> {
  await initPersistence();

  const store = getStore();
  const existingNotes = store.getRowIds("notes");
  if (existingNotes.length > 0) return;

  const bm = new BranchManager();

    // Note 1: Welcome
    const { noteId: n1, branchId: b1 } = await bm.createNote("");
    {
    const result = await bm.getBranchDocument(b1);
    if (result) {
      const doc = result.document;
      doc.setText(
        "# Welcome to BranchMind\n\n" +
          "Your local-first, version-controlled knowledge base.\n\n" +
          "## Getting Started\n\n" +
          "- **Write** freely - every keystroke is recorded\n" +
          "- **Branch** to explore ideas without losing your work\n" +
          "- **Time-travel** through your note's history\n" +
          "- **Merge** branches back together\n\n" +
          "All your data stays on your device. No servers, no accounts."
      );
      doc.commit("Welcome content");
      await bm.saveBranchDocument(b1, doc);
    }
  }
  addNote(n1, "Welcome to BranchMind", ["docs", "getting-started"], b1);

  // Note 2: Project Ideas with branching
  const { noteId: n2, branchId: b2 } = await bm.createNote(
    "Brainstorming session for Q2 projects."
  );
  {
    const result = await bm.getBranchDocument(b2);
    if (result) {
      const doc = result.document;
      doc.setText(
        "# Project Ideas\n\n" +
          "## Q2 Brainstorm\n\n" +
          "1. Knowledge management tool with version control\n" +
          "2. CLI tool for managing dotfiles with git-style branching\n" +
          "3. Personal finance tracker with local-first architecture"
      );
      doc.commit("Initial brainstorm");
      const f1 = doc.frontiers;

      doc.setText(
        "# Project Ideas\n\n" +
          "## Q2 Brainstorm\n\n" +
          "1. Knowledge management tool with version control\n" +
          "   - Use CRDTs for conflict-free editing\n" +
          "   - Support branching and merging\n" +
          "   - Pure client-side, no server needed\n" +
          "2. CLI tool for managing dotfiles with git-style branching\n" +
          "3. Personal finance tracker with local-first architecture\n" +
          "4. Offline-first note-taking app with sync"
      );
      doc.commit("Added details to idea 1, added idea 4");

      // Create a branch from the initial version
      await bm.branchFromCheckpoint(b2, "alternative-ideas", f1);
      const alt = await bm.getBranchByNoteAndName(n2, "alternative-ideas");
      if (alt) {
        const altResult = await bm.getBranchDocument(alt.branchId);
        if (altResult) {
          const altDoc = altResult.document;
          altDoc.setText(
            "# Project Ideas (Alt)\n\n" +
              "## Different Direction\n\n" +
              "1. AI-powered gardening assistant\n" +
              "2. Decentralized recipe sharing platform\n" +
              "3. Community event planner with weather integration"
          );
          altDoc.commit("Alternative ideas");
          await bm.saveBranchDocument(alt.branchId, altDoc);
        }
      }

      await bm.saveBranchDocument(b2, doc);
    }
  }
  addNote(n2, "Project Ideas", ["projects", "brainstorm"], b2);

  // Note 3: Meeting Notes with history
  const { noteId: n3, branchId: b3 } = await bm.createNote("");
  {
    const result = await bm.getBranchDocument(b3);
    if (result) {
      const doc = result.document;
      doc.setText(
        "# Sprint Review\n\n" +
          "## Attendees\n" +
          "- Alice\n\n" +
          "## Agenda\n" +
          "- Demo completed features"
      );
      doc.commit("Initial meeting notes");
      const f1 = doc.frontiers;

      doc.setText(
        "# Sprint Review\n\n" +
          "## Attendees\n" +
          "- Alice\n" +
          "- Bob\n" +
          "- Charlie\n\n" +
          "## Agenda\n" +
          "- Demo completed features\n" +
          "- Review sprint metrics"
      );
      doc.commit("Added Bob and Charlie, updated agenda");

      doc.setText(
        "# Sprint Review\n\n" +
          "## Attendees\n" +
          "- Alice\n" +
          "- Bob\n" +
          "- Charlie\n\n" +
          "## Agenda\n" +
          "- Demo completed features\n" +
          "- Review sprint metrics\n\n" +
          "## Action Items\n" +
          "- Alice: Update documentation\n" +
          "- Bob: Fix login bug (#452)\n" +
          "- Charlie: Prepare next sprint backlog"
      );
      doc.commit("Added action items");

      // Branch from v1 for planner
      await bm.branchFromCheckpoint(b3, "meeting-planner", f1);
      const planner = await bm.getBranchByNoteAndName(n3, "meeting-planner");
      if (planner) {
        const pResult = await bm.getBranchDocument(planner.branchId);
        if (pResult) {
          const pDoc = pResult.document;
          pDoc.setText(
            "# Meeting Planner\n\n" +
              "## Prep Checklist\n" +
              "- Send agenda 24h before\n" +
              "- Book conference room\n" +
              "- Prepare demo environment\n\n" +
              "## Template\n" +
              "### Attendees\n" +
              "### Agenda\n" +
              "### Action Items"
          );
          pDoc.commit("Meeting planner template");
          await bm.saveBranchDocument(planner.branchId, pDoc);
        }
      }

      await bm.saveBranchDocument(b3, doc);
    }
  }
  addNote(n3, "Sprint Review - Week 23", ["meetings", "sprint"], b3);
}
