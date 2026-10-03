# Progress

## Completed

- Centralized API handling with cancellation, deadlines, provider errors and explicit offline sandbox routing.
- Labelled browser sandbox with local persistence, upload, simulation, annotations, derivative previews, claims, report exports and local provenance.
- Optional `MOCK_VISION=true` for explicitly labelled category fixtures when OpenAI is unconfigured or quota-limited.
- Serialized state mutations and atomic file replacement, including concurrent uploads and manual annotations.
- Extracted presentation components; `src/main.jsx` coordinates state and operations.
- Selectable comparison assets, side-by-side layout, and pointer/keyboard-accessible curtain slider.
- Reports view with persisted linked claims and review decisions, calculated metrics, JSON manifest exports, SHA-256 content digests, and printable analyst signature lines.
- Normalized manual annotation drawing and numeric editing with separate observation/interpretation and immutable ledger snapshots.
- Provenance lineage graph connecting source events, derivatives, annotations and claims; inspectable exact payloads and independently recomputed block hashes.
- Evidence-library category/status filters, sorting, ledger-integrity badges, selection and batch export.
- Parameterized focus padding, enhancement intensity, rectangular color splash and optimization, preserving exact descriptions and parent links.
- Full original/derivative collection restored after reload; preview derivatives remain explicitly unrendered.
- Reporting/annotation regression suites, provider boundary tests, Cloudinary transformation-chain checks and tamper detection.
- Primary-canvas crosshair annotation mode with mouse/touch drawing, exact coordinate handoff, keyboard entry and Escape cancellation.
- Manual annotation editing/deletion in both server and sandbox, with stable IDs, revision conflict detection and append-only `RETRACT_ANNOTATION` history.
- Dynamic category chips and element counts, combined status/statement/asset-ID claim filters, and outside-click/focus dropdown dismissal.
- Chain digest clipboard copy and JSON ledger certificates with recomputed SHA-256 checks, content digests and explicit sandbox/verification scope.

## Verification

- `node --test tests/*.test.mjs`
- `npm test`
- `npm run build`
- Browser checks with an isolated API/store: manual drawing, parameterized derivatives, curtain dragging and keyboard controls, library filters/batch download, claim review, printing, proof inspection, upload, sandbox persistence/isolation, API-offline recovery and mobile navigation.
- UX browser checks: direct canvas drawing and exact coordinates; edit/delete/reload; live category badges; keyboard claim tabs and combined search; dropdown dismissal; real clipboard copy and denied-clipboard fallback; certificate download/integrity; sandbox CRUD; mobile touch drawing. No browser runtime errors or warnings.

Demo fixtures and simulated analyses are illustrative. Claim review status and cryptographic record integrity remain separate concepts. Local file persistence is single-process; serverless temporary storage is not a shared durable database.
