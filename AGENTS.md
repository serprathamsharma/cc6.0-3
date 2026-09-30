# ImpactLens contributor notes

- Preserve the distinction between ORIGINAL, DERIVATIVE, and AI-GENERATED.
- Never overwrite a source asset. Every transformation must retain `parentAsset` and an exact transformation description.
- Keep visual model output schema-validated and keep OBSERVATION separate from INTERPRETATION.
- Cloudinary secrets belong server-side only. Demo fixtures must remain visibly labelled.
- Run `npm test` and `npm run build` before shipping.
