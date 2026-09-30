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

The server uses the official Cloudinary Node SDK for configuration, signing, upload delivery, indexed Search API queries, resource lookup by immutable `asset_id`, transformation URL generation, and the optional Analysis API. The implementation follows the SDK repository's bundled docs (`docs/platform-capabilities.md`, `docs/sign-browser-upload.md`, `docs/upload-image.md`, `docs/search-and-manage-assets.md`, and `docs/transform-and-deliver-image.md`). The current demo uses Cloudinary-compatible asset IDs and delivery semantics. Upload signing is available when credentials are configured. Structured metadata, visual search, video analysis, and generative transformations remain capability-gated; no unavailable analysis or generative API is presented as live in demo mode.

## Checks

```bash
npm test
npm run build
npm run server
```

## Vercel Deployment

ImpactLens is configured for fullstack deployment on Vercel:

- **Frontend**: Vite SPA built from `src/` to `dist/` and served via Vercel Edge/CDN.
- **Serverless API**: All endpoints (`/api/status`, `/api/cloudinary/signature`, `/api/assets`, `/api/analysis`, `/api/derivatives`, `/api/provenance`, `/api/reports/export`) are served as Vercel Serverless Functions via `api/index.js` and `api/[...path].js`.
- **Environment variables**: Configure `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, and `CLOUDINARY_API_SECRET` in the Vercel Project Settings for server-side signing and delivery, plus `VITE_CLOUDINARY_CLOUD_NAME` for client-side asset URLs.

### Deploying via Vercel CLI or GitHub

1. **Deploy with CLI**:
   ```bash
   npx vercel
   # or for production
   npx vercel --prod
   ```

2. **Deploy via GitHub**:
   Import the repository into Vercel. The preset will automatically detect Vite and use `vercel.json` for routing.


## Limitations

The included fixtures are labelled illustrative demo data. Persistence currently uses a local `.data/impactlens.json` ledger so the integration can be exercised without a database. A production deployment should replace that store with Postgres/Drizzle, add authenticated organizations and background jobs, and connect a model-backed element-analysis provider. The API and provenance boundaries are already separated for that migration.
