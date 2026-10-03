# Assumptions

- The application runs on Node.js 22.12+ with a Vite/React frontend and a Node API.
- Demo media is from Unsplash URLs and is labelled illustrative in the UI.
- Offline sandbox means API-independent operation after loading the frontend. Remote demo images still require network access; local uploads do not.
- Current transformations are non-generative derivatives; local previews retain the parent image and are visibly unrendered.
- Persisted review statuses represent analyst decisions. Hash chains and manifest digests establish recorded integrity, not factual or identity certification.
- The JSON store coordinates a single API process. Browser sandbox storage is separate; serverless file storage is temporary and instance-local.
- Optional Cloudinary analysis, visual search, generative removal, and transcription are disabled until account capabilities and server credentials are present.
