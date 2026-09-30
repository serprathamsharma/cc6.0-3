# ImpactLens

**Visual evidence, understood.** ImpactLens is a Cloudinary-centered visual intelligence workspace that turns media into inspectable elements, non-destructive derivatives, comparisons, and evidence-backed reporting.

## Run

```bash
npm install
npm run dev
```

For the server-side integration boundary, run `npm run server` in a second terminal, or run both processes with `npm run dev:all`. The API listens on `http://127.0.0.1:8787`.

Optional Cloudinary environment variables:

```bash
CLOUDINARY_CLOUD_NAME=...
CLOUDINARY_API_KEY=...
CLOUDINARY_API_SECRET=...
```

The API provides signed upload parameters at `/api/cloudinary/signature`, asset registration at `/api/assets`, structured analysis at `/api/analysis`, derivative creation at `/api/derivatives`, provenance at `/api/provenance`, and evidence manifests at `/api/reports/export`. Secrets remain server-side. Without credentials, the same endpoints return explicit demo-mode or preview-only responses.

Open the Vite URL. The app intentionally runs in **DEMO MODE** without credentials using deterministic, clearly labelled illustrative fixtures. To connect delivery URLs, set `VITE_CLOUDINARY_CLOUD_NAME`; server-side upload signing belongs behind a deployment API boundary and must never expose the API secret to the browser.

## Product architecture

```text
Original upload → Cloudinary asset → structured analysis → element regions
       │                                      │
       └──────── immutable evidence ledger ←──┘
                                              ↓
                         Cloudinary derivative / comparison / report
```

The UI separates OBSERVATION from INTERPRETATION, labels originals and derivatives, and keeps the original asset ID in the evidence chain. `src/lib/cloudinary.js` is the capability boundary: unavailable add-ons are represented explicitly instead of being simulated as live API success. `src/lib/provenance.js` implements a SHA-256 hash chain and verification result.

## Cloudinary integration

The server uses the official Cloudinary Node SDK for configuration, signing, and derivative URL generation. The current demo uses Cloudinary-compatible asset IDs and delivery semantics. Upload signing is available when credentials are configured. Search API, structured metadata, AI Vision/add-ons, video analysis, and generative transformations remain capability-gated; no unavailable analysis or generative API is presented as live in demo mode.

## Checks

```bash
npm test
npm run build
npm run server
```

## Limitations

The included fixtures are labelled illustrative demo data. Persistence currently uses a local `.data/impactlens.json` ledger so the integration can be exercised without a database. A production deployment should replace that store with Postgres/Drizzle, add authenticated organizations and background jobs, and connect a model-backed element-analysis provider. The API and provenance boundaries are already separated for that migration.
