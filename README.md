# BranchMind

A local-first, version-controlled knowledge base. Think Git for your notes — every change is recorded, you can branch to explore ideas, and merge them back together.

**No server. No account. No data leaves your device.**

## Tech Stack

| Library | Role | Size |
|---------|------|------|
| [Loro](https://github.com/loro-dev/loro) | CRDT engine with Git-like version control | ~3MB (WASM) |
| [TinyBase](https://github.com/tinyplex/tinybase) | Reactive in-memory data store | 6-13KB |
| [Dexie.js](https://github.com/dexie/Dexie.js) | IndexedDB persistence layer | ~20KB |
| Vite + React + TypeScript | Build tool and UI framework | — |

## Architecture

### Loro CRDT Architecture

Loro is a high-performance CRDT (Conflict-free Replicated Data Type) library written in Rust and compiled to WebAssembly. It provides:

- **Rich-text CRDT**: Every character insertion/deletion is recorded as a CRDT operation with a timestamp and author ID (PeerID). Operations are grouped into commits (like Git commits).

- **Version Vector & Frontiers**: Loro tracks document state through version vectors (a map of PeerID → counter). Frontiers are the set of latest operations from each peer — equivalent to Git's HEAD.

- **Git-like Operations**:
  - `fork()` — Duplicate the document at its current state (like `git clone`)
  - `forkAt(frontiers)` — Create a branch at a specific historical version (like `git checkout -b`)
  - `checkout(frontiers)` — Time-travel to any past state (read-only detached mode)
  - `import()` / `export()` — Serialize/deserialize document state (like `git push/pull`)
  - CRDT merge — Import one branch's updates into another; Loro automatically resolves conflicts using its CRDT algorithms

### Data Flow

```
User keystrokes
    │
    ▼
┌──────────┐     ┌──────────┐     ┌──────────────┐
│  React   │────▶│  LoroDoc │────▶│  IndexedDB   │
│  Editor  │     │  (WASM)  │     │  (via Dexie) │
└──────────┘     └──────────┘     └──────────────┘
                       │
                       ▼
                 ┌──────────┐
                 │ TinyBase │
                 │ (in-mem) │
                 └──────────┘
                       │
                       ▼
                 ┌──────────┐
                 │ IndexedDB│
                 │ (autoSave)│
                 └──────────┘
```

### Branching & Merging Model

1. **Main branch**: Every note starts with a `main` branch backed by a LoroDoc
2. **Branch from history**: User clicks "Branch from here" on any version in the timeline. A new LoroDoc is created via `forkAt(frontiers)` — it shares all history up to that point but becomes independent
3. **Merge**: Two branches are merged by importing one's updates into the other. Loro's CRDT algorithms handle all conflicts automatically. A diff view shows what changed (additions in green, deletions in red)
4. **Time Travel**: Clicking any version in the timeline displays a read-only preview of the note at that exact point in history

### Storage

- **Loro snapshots** are serialized to `Uint8Array` bytes and stored as blobs in Dexie.js (IndexedDB)
- **Note metadata** (title, tags, current branch) is stored in TinyBase, which auto-persists to IndexedDB via its built-in `createIndexedDbPersister`
- **Checkpoints** (version history) are serialized as JSON and stored alongside each branch's snapshot

## Running Locally

```bash
npm install
npm run dev
```

## Building for Production

```bash
npm run build
```

Output goes to `dist/` and can be deployed to any static host (GitHub Pages, Cloudflare Pages, Netlify, etc.).

## Deployment

The build output is a pure static app:

```
dist/
  index.html
  assets/
    index-*.js        # Application bundle
    index-*.css       # Styles
    loro_wasm_bg-*.wasm  # Loro CRDT engine
```

### Cloudflare Pages

```bash
npx wrangler pages deploy dist
```

### GitHub Pages

Push the `dist/` folder to a `gh-pages` branch.

## License

MIT
