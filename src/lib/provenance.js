export async function sha256(value) {
  const hash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return [...new Uint8Array(hash)].map(byte => byte.toString(16).padStart(2, '0')).join('');
}

export async function appendLedger(entries, event) {
  const previousHash = entries.at(-1)?.hash || 'GENESIS';
  // Proofs are snapshots, not references to mutable claim/annotation records.
  const payload = { ...structuredClone(event), previousHash };
  return [...entries, { ...payload, hash: await sha256(JSON.stringify(payload)) }];
}
export async function verifyLedger(entries) {
  if (!Array.isArray(entries)) return { valid: false, index: 0 };
  let previousHash = 'GENESIS';
  for (let i = 0; i < entries.length; i++) {
    if (!entries[i] || typeof entries[i] !== 'object' || Array.isArray(entries[i])) return { valid: false, index: i + 1 };
    const { hash, ...event } = entries[i];
    if (event.previousHash !== previousHash || hash !== await sha256(JSON.stringify(event))) {
      return { valid: false, index: i + 1 };
    }
    previousHash = hash;
  }
  return { valid: true };
}

export async function buildLedgerCertificate(provenance) {
  const { ledger = [], verification: evidenceVerification = null, mode = 'server' } = structuredClone(provenance);
  if (!Array.isArray(ledger)) throw new Error('A ledger array is required to create a certificate.');
  const generatedAt = new Date().toISOString();
  const [chain, ledgerDigest] = await Promise.all([verifyLedger(ledger), sha256(JSON.stringify(ledger))]);
  const payload = {
    kind: 'ImpactLens Ledger Certificate', version: 1, generatedAt, mode,
    label: mode === 'sandbox' ? 'LOCAL SANDBOX · browser-only ledger' : 'SERVER WORKSPACE LEDGER',
    hashAlgorithm: 'SHA-256', encoding: 'UTF-8', entryCount: ledger.length,
    headHash: ledger.length ? ledger.at(-1)?.hash ?? null : 'GENESIS', ledgerDigest,
    verification: {
      valid: chain.valid && evidenceVerification?.valid === true,
      chain, evidence: evidenceVerification, checkedAt: generatedAt,
      method: 'SHA-256(JSON.stringify(entry without hash)); previousHash links each entry, beginning at GENESIS.',
      scope: `${mode === 'sandbox' ? 'Local sandbox only.' : 'Server workspace snapshot.'} Chain recomputed at export; evidence verification is the supplied workspace result. Content integrity, not factual or identity certification.`
    },
    ledger
  };
  return { ...payload, signature: { algorithm: 'SHA-256', digest: await sha256(JSON.stringify(payload)), scope: 'JSON.stringify(certificate without signature)' } };
}

export function formatChainDigest(certificate) {
  const result = value => value === true ? 'PASSED' : value === false ? 'FAILED' : 'UNAVAILABLE';
  return [
    'ImpactLens Chain Digest', certificate.label,
    `Ledger head: ${certificate.headHash || 'MISSING'}`,
    `Algorithm: ${certificate.hashAlgorithm} · ${certificate.entryCount} events`,
    `Overall verification: ${result(certificate.verification.valid)}`,
    `Chain verification: ${result(certificate.verification.chain.valid)}`,
    `Evidence record verification: ${result(certificate.verification.evidence?.valid)}`,
    `Checked at: ${certificate.verification.checkedAt}`,
    certificate.verification.scope
  ].join('\n');
}
