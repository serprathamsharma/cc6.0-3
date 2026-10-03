# Architecture

## Client boundaries

- `src/main.jsx`: state coordinator for the current asset, full evidence collection, claims, comparison selection, library filters, provider status, provenance and mutations.
- `src/components/`: `Sidebar`, `Header`, `Workspace`, `ImageStage`, `ElementPanel`, `TransformCard`, `CompareView`, `EvidenceLibrary`, `ReportsView`, `UploadModal`, `AnnotationModal`, `ProvenanceModal`, `EvidenceStrip`, `ChainStep` and shared accessible `Modal`.
- `src/lib/api.js`: JSON requests, error normalization, combined caller cancellation/deadlines, explicit API versus sandbox routing and manifest downloads. A failed server mutation is not automatically replayed elsewhere.
- `src/lib/sandbox.js`: isolated browser store implementing the same core operations, using serialized copy-on-write updates and local storage. Writes commit only after persistence succeeds. Simulation and unrendered previews are labelled throughout the UI and exports.

## Shared evidence rules

- `analysis.js` validates strict model observations, confidence and bounded normalized regions. OBSERVATION and INTERPRETATION are separate required fields.
- `evidence.js` validates manual annotations and claims, converts normalized records for percentage-based overlays, filters the library and derives lineage relationships.
- `annotations.js` plans manual annotation edits and deletions identically for the server and sandbox. An edit retains the ID, increments `revision`, and records retraction of the previous snapshot before its replacement. A delete records only a retraction. Optional `expectedRevision` checks reject stale writes; the UI sends it for both operations.
- `transformations.js` produces exact parameter strings and descriptions. ORIGINAL, DERIVATIVE and AI-GENERATED remain distinct; current transformation controls are non-generative.
- `provenance.js` snapshots event payloads and chains SHA-256 digests using `previousHash`, beginning at GENESIS. Snapshots do not alias mutable records. Certificate export clones the current ledger, independently recomputes chain verification, includes the workspace's evidence-verification result, and hashes both the full ledger and certificate payload.
- `reports.js` selects related evidence, validates linked claims, computes summary metrics, filters claims, checks the chain and recorded asset/latest-analysis/latest-claim proofs, then adds a SHA-256 manifest content digest. Annotation verification replays creation/retraction/replacement events and compares the active revisions to stored annotations; it detects silent edits, deletions, resurrection and unrecorded additions while preserving historical proofs. Reports retain demo and simulation labels and identify unregistered or out-of-pack links.
- `simulation.js` supplies illustrative category fixtures only for the explicit sandbox or `MOCK_VISION=true`; unknown categories have no detections.

## Server and persistence

`server.mjs` exposes the API. `server/integrations.mjs` handles OpenAI and the official Cloudinary SDK with server-only secrets. Provider errors are explicit; opt-in mock mode may simulate missing-key or HTTP 429 analysis. Cloudinary originals use `overwrite: false`. Chained derivative delivery composes transformations against the original resource while each derivative records its immediate parent.

`server/store.mjs` serializes reads and read-modify-write operations through one queue. Each mutation reads current state, applies its asset/claim and ledger changes together, writes a uniquely named temporary file, then atomically renames it over `impactlens.json`. Failed operations leave the prior persisted state intact. This is single-process synchronization, not a distributed transaction system.

Local data lives in `.data/` or `IMPACTLENS_DATA_DIR`. Serverless execution defaults to temporary instance-local storage. Shared production persistence requires a transactional database. The browser sandbox never synchronizes automatically with the server.

## Integrity scope

Original file uploads record byte SHA-256 digests; remote image references record URL digests. Ledger verification is record integrity, not factual certification, remote image retrieval, or an externally anchored identity signature. Report `signature.digest` covers `JSON.stringify` of the manifest excluding its `signature` field. Print output includes that digest, the ledger head and separate analyst signature lines.
