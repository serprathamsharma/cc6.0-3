# ImpactLens

**Visual evidence, understood.** ImpactLens is a Cloudinary-centered visual intelligence workspace that turns media into inspectable elements, non-destructive derivatives, comparisons, and evidence-backed reporting.

## Run locally

Use **Node.js 22.12 or newer**. From the project directory:

```bash
npm install
npm run dev
```

Open **http://127.0.0.1:5173**. `npm run dev` starts both the Vite frontend and the Node API, and Ctrl+C stops both. `npm run dev:all` is an alias. The API listens on `http://127.0.0.1:8787`; Vite proxies `/api` to it. For separate terminals, use `npm run server` and `npm run client`.

### Connect OpenAI and Cloudinary

If `.env` does not exist, copy `.env.example` to `.env`. Set the server-side credentials:

```bash
CLOUDINARY_CLOUD_NAME=...
CLOUDINARY_API_KEY=...
CLOUDINARY_API_SECRET=...
OPENAI_API_KEY=...
OPENAI_VISION_MODEL=gpt-4o-mini
```

Restart `npm run dev` after changing `.env`. No `VITE_` credentials are needed; API secrets stay server-side.

- Click **OpenAI · Check connection** or **Cloudinary · Check connection** in the header to verify the corresponding credentials. The OpenAI check verifies model access; running an analysis also exercises inference quota.
- Click **Analyze image** to analyze the selected image. Results are schema-validated, with observation and interpretation kept separate. Missing credentials, quota errors and provider failures are displayed explicitly.
- Click **Upload evidence**, choose **Cloudinary** or **Local server workspace**, and select an image or enter an image URL. Optional analysis runs after the upload is saved, so an AI failure does not lose the upload.
- Uploads, analyses, derivatives, manual annotations, claims and review events persist in `.data/impactlens.json`. State mutations are serialized, and each save atomically replaces the file. `IMPACTLENS_DATA_DIR` can select another storage directory.
- Without credentials, local uploads and manual annotations work. Demo fixtures remain visibly illustrative.

### Offline sandbox and optional mock vision

Click **Offline sandbox** in the header, or **Open offline sandbox** when the API cannot be reached. The browser workspace supports uploads, illustrative analysis, annotations, derivative previews, claims, reports and a local hash chain without an API connection. Data is stored under `impactlens-sandbox-v1` in local storage. If storage is unavailable when opened, the banner identifies a session-only workspace. A failed storage write is reported without committing the change.

**Return to server** restores the server collection. Sandbox data is separate and is not automatically synchronized. Remote demo image URLs still need network access; local image files can be inspected without it. Browser storage is limited, so prefer small files in sandbox mode.

For explicit server-side demonstrations, add this to `.env` and restart:

```bash
MOCK_VISION=true
```

This enables schema-validated, category-based fixtures when OpenAI is unconfigured or returns HTTP 429. Results are labelled **SIMULATED_ANALYSIS / ILLUSTRATIVE DEMO**, never shown as successful OpenAI inference. Unknown categories return no detections. Credential errors and malformed model output remain errors. The default is `MOCK_VISION=false`.

## Workspace guide

- **Elements and annotations:** inspect separate OBSERVATION and INTERPRETATION fields. The canvas toolbar's crosshair **Annotate** button enables direct mouse/touch drawing on the primary evidence image. Releasing a rectangle opens the form with its exact normalized coordinates (`left`, `top`, `width`, `height`, all 0–1). Escape cancels drawing; **Enter coordinates** or the panel's **Add annotation** provides keyboard entry. Drawing resets zoom and is disabled on unrendered or displayed child previews. Manual confidence is stored as 0–1, including zero.
- **Annotation management:** select a MANUAL element to **Edit Annotation** or **Delete Annotation**. Edits retain its ID, increment its revision, append a `RETRACT_ANNOTATION` snapshot of the previous revision, then record the replacement as `MANUAL_ANNOTATION`. Deletes remove it from the active canvas and append a retraction. Both operations preserve the source image and the complete historical ledger. Stale revisions are rejected instead of overwriting a newer edit.
- **Transformations:** Focus offers 1.2×, 1.5× and 2× padding, Enhance controls contrast/sharpen intensity, Isolate offers a grayscale crop or rectangular color splash, and Optimize records automatic delivery parameters. Every derivative retains both `parentAsset` and `parentAssetId`, its exact transformation and description. Chained Cloudinary derivatives resolve back to the original resource. Local derivatives are labelled **unrendered previews** that show the parent image; they cannot be analyzed or annotated as rendered evidence.
- **Comparisons:** choose both assets from the complete collection, including saved derivatives. Switch between side-by-side and curtain layouts. Drag the divider, or focus it and use arrow keys, Page Up/Down, Home and End. Images retain their aspect ratios; alignment is manual.
- **Evidence library:** category chips are derived from all loaded assets and current detected/manual elements, with active element-count badges. Category names are matched exactly after whitespace/case normalization; asset-only categories may have zero elements. Counts update when annotations change. Combine category and ORIGINAL / DERIVATIVE / AI-GENERATED / illustrative filters with search, then sort by date, detection confidence or element count. Ledger badges reflect actual registration and verification. Select multiple assets to export a manifest with their related descendants and ancestors.
- **Audit & reports:** create evidence-linked claims and persist VERIFIED, PENDING REVIEW or CONFLICTED review decisions. **All Claims**, **Verified Only**, **Pending Review** and **Conflicted** tabs combine with quick search over statement text or linked asset IDs. Tabs support arrow keys, Home and End. Summary metrics are derived from current records. Export JSON or choose **Print / save PDF** for an evidence inventory, claims, integrity digest and prepared/reviewed signature lines. Claim status is analyst judgement, separate from cryptographic integrity.
- **Provenance:** open the activity button or **Verify SHA-256 chain**. Select a lineage node to inspect the actor, timestamp, annotation revision/retraction, exact transformation, hashed payload, previous hash, stored hash and independently recomputed hash. **Copy Chain Digest** copies the ledger head and verification summary; if clipboard access fails, a selectable text summary appears. **Download Ledger Certificate (.json)** exports the complete chain with freshly recomputed SHA-256 verification, the supplied evidence-verification result, head hash, ledger digest, timestamp, scope and a content digest. Sandbox and failed/unavailable verification remain explicitly labelled.

`Ctrl/Cmd+U` opens uploads; `Ctrl/Cmd+K` opens and focuses library search. Dialogs support Escape and keyboard focus containment; mobile navigation exposes all four views. The workspace dropdown dismisses on an outside click, focus moving outside it, or Escape.

### Local troubleshooting

- **API unavailable:** start with `npm run dev`, or open the labelled offline sandbox.
- **Port already in use:** stop the previous process. To move the API, set `PORT` in `.env`; the Vite proxy uses the same port.
- **Provider errors:** check the inline error, credentials, model access and account credits, then retry. A configured key is not proof of available inference quota.
- **Missing Rollup/SWC native module after switching between Windows and WSL:** run `npm install --include=optional` in the environment where you will run the app.

### Main API routes

| Route | Method | Purpose |
| --- | --- | --- |
| `/api/status` | GET | Configuration, mock mode and capabilities |
| `/api/assets` | GET / POST | List all originals/derivatives or register a Cloudinary original |
| `/api/upload` | POST | Save a local image or upload to Cloudinary |
| `/api/analysis` | POST | Analyze a registered asset (`assetId`) |
| `/api/annotations` | POST | Append a validated manual annotation (`assetId`, `annotation`), starting at revision 1 |
| `/api/annotations` | PATCH | Replace a manual annotation (`assetId`, `annotationId`, `annotation`, optional `expectedRevision`) with retraction/replacement events |
| `/api/annotations` | DELETE | Retract a manual annotation (`assetId`, `annotationId`, optional `expectedRevision`) |
| `/api/derivatives` | POST | Record a parent-linked exact transformation |
| `/api/claims` | GET / POST | List claims; create or review one using `id`, `statement`, `assetIds`, `status` |
| `/api/provenance` | GET | Complete ledger and evidence verification |
| `/api/provenance/verify` | GET | Verification result only |
| `/api/reports/export` | POST | Manifest for `title`, `assetIds`, optional `includeRelated` (default true) |
| `/api/integrations/openai/check` | POST | OpenAI model access check |
| `/api/integrations/cloudinary/check` | POST | Cloudinary connection check |

An explicitly empty `assetIds: []` exports an empty selection. Exports use persisted claims by default, flag linked assets outside a filtered pack, and include the complete ledger for independent chain verification. The manifest `signature.digest` is SHA-256 of `JSON.stringify(manifest without signature)`; `verifyManifestSignature` in `src/lib/reports.js` verifies it. This is a content digest, not a signer's identity certificate.

Ledger certificates similarly hash `JSON.stringify(certificate without signature)`. `ledgerDigest` hashes `JSON.stringify(certificate.ledger)`, and `headHash` is the latest block hash (or `GENESIS` for an empty ledger). `verifyLedger` in `src/lib/provenance.js` independently checks all block hashes and links. `verification.chain` is recomputed at export; `verification.evidence` records the server/sandbox snapshot result. The certificate does not claim an external signer or independent verification of image contents.

## Product architecture

```text
Original upload → Cloudinary asset → structured analysis → element regions
       │                                      │
       └──────── immutable evidence ledger ←──┘
                                              ↓
                         Cloudinary derivative / comparison / report
```

`src/main.jsx` coordinates workspace state and actions; `src/components/` contains the views, dialogs, controls and layout. All UI requests use `src/lib/api.js`, including deadlines, cancellation and explicit server/sandbox routing. `server/integrations.mjs` owns provider credentials and schema validation. `src/lib/provenance.js`, `src/lib/reports.js` and `src/lib/evidence.js` share verification and evidence rules between the server and sandbox. See [ARCHITECTURE.md](ARCHITECTURE.md).

## Cloudinary integration

The server uses the official Cloudinary Node SDK for configuration, signing, upload delivery, indexed Search API queries, resource lookup by immutable `asset_id`, transformation URL generation, and the optional Analysis API. The implementation follows the SDK repository's bundled docs (`docs/platform-capabilities.md`, `docs/sign-browser-upload.md`, `docs/upload-image.md`, `docs/search-and-manage-assets.md`, and `docs/transform-and-deliver-image.md`). The current demo uses Cloudinary-compatible asset IDs and delivery semantics. Upload signing is available when credentials are configured. Structured metadata, visual search, video analysis, and generative transformations remain capability-gated; no unavailable analysis or generative API is presented as live in demo mode.

## Checks

```bash
npm test
node --test tests/*.test.mjs
npm run build
```

The test script is `node --test tests/*.test.mjs tests/**/*.test.mjs`. Coverage includes concurrent uploads and annotations, atomic persistence, analysis schema boundaries, mock labelling, parent-linked transformation composition, claim review persistence, report selection/signatures and tamper detection. `tests/element-annotation.test.mjs` covers revision/retraction replay, stale writes and persistence rollback; `tests/evidence-filters.test.mjs` covers dynamic category counts and combined claim filtering; `tests/provenance.test.mjs` checks certificate digests and accurate failure/sandbox metadata.

## Vercel Deployment

ImpactLens is configured for fullstack deployment on Vercel:

- **Frontend**: Vite SPA built from `src/` to `dist/` and served via Vercel Edge/CDN.
- **Serverless API**: Endpoints are served via `api/index.js` and `api/[...path].js`, including annotations and claims.
- **Environment variables**: Configure `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET`, `OPENAI_API_KEY` and optionally `OPENAI_VISION_MODEL` server-side. A separately hosted API can use public `VITE_API_URL`; API credentials never belong in `VITE_` variables.

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

The included fixtures and simulated analyses are illustrative. SHA-256 verification checks recorded integrity, not the truth of a claim or the contents of a remotely hosted image. File uploads record an original byte digest; remote URLs record a reference digest. Printed analyst signature lines are completed separately from the manifest digest.

The file store serializes one Node process. Vercel uses temporary instance-local storage; it is not durable or shared between instances. A multi-instance deployment needs a transactional shared database and authenticated organizations. Cloudinary delivery requires configured credentials and stored Cloudinary originals; local previews do not render transformations.
