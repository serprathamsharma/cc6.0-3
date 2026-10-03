import { validateManualAnnotation } from './evidence.js';

// Return the new active collection and append-only proof events as one change.
// Callers commit both together using their serialized persistence boundary.
export function changeManualAnnotation(asset, input, action) {
  const fail = (message, status) => { throw Object.assign(new Error(message), { status }); };
  if (!asset) fail('Asset not found.', 404);
  if (!['update', 'delete'].includes(action)) fail('Unknown annotation action.', 400);
  if (typeof input.annotationId !== 'string' || !input.annotationId.trim()) fail('annotationId is required.', 400);
  if (asset.mode === 'preview') fail('Render this derivative before managing annotations; its preview shows the parent image.', 422);
  const previous = asset.manualAnnotations?.find(item => item.id === input.annotationId && item.source === 'MANUAL');
  if (!previous) fail('Manual annotation not found.', 404);
  const revision = previous.revision || 1;
  if (input.expectedRevision !== undefined) {
    if (!Number.isInteger(input.expectedRevision) || input.expectedRevision < 1) fail('expectedRevision must be a positive integer.', 400);
    if (input.expectedRevision !== revision) fail('This annotation has changed. Refresh the workspace before saving or deleting it.', 409);
  }
  if (action === 'update' && !validateManualAnnotation(input.annotation)) {
    fail('Annotation requires separate observation and interpretation, a label, category, confidence and valid normalized region.', 400);
  }
  const annotation = action === 'update' ? {
    ...input.annotation, id: previous.id, source: 'MANUAL', createdAt: previous.createdAt,
    revision: revision + 1, updatedAt: new Date().toISOString()
  } : null;
  const events = [{
    type: 'RETRACT_ANNOTATION', assetId: asset.id, annotationId: previous.id,
    annotation: previous, reason: action === 'update' ? 'updated' : 'deleted', demo: Boolean(asset.demo)
  }];
  if (annotation) events.push({ type: 'MANUAL_ANNOTATION', assetId: asset.id, annotation, demo: Boolean(asset.demo) });
  return {
    annotation, events,
    manualAnnotations: asset.manualAnnotations.flatMap(item => item.id === previous.id ? annotation ? [annotation] : [] : [item])
  };
}
