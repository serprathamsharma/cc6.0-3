# Architecture

The Vite/React client is a presentation and interaction layer. Demo fixtures are in `src/data/demo.js`. Cloudinary delivery/capability concerns are isolated in `src/lib/cloudinary.js`; provenance is isolated in `src/lib/provenance.js`. In production, route handlers should call the official Cloudinary Node SDK for signed upload, asset management, search and transformation URL generation, while analysis jobs write structured observations and element regions to Postgres. The client should consume those records rather than treating model prose as application truth.
