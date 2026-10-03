import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { mkdir, readFile, writeFile, rename, rm } from 'node:fs/promises';

export function createStore(directory) {
  const file = path.join(directory, 'impactlens.json');
  let pending = Promise.resolve();
  const serialize = operation => {
    const result = pending.then(operation);
    pending = result.catch(() => {});
    return result;
  };
  const read = async () => {
    try {
      const db = JSON.parse(await readFile(file, 'utf8'));
      if (!Array.isArray(db.assets) || !Array.isArray(db.ledger)) throw new Error('Invalid evidence store.');
      return db;
    } catch (error) {
      if (error.code === 'ENOENT') return { assets: [], ledger: [] };
      throw error;
    }
  };
  return {
    read: () => serialize(read),
    update: operation => serialize(async () => {
      const db = await read();
      const result = await operation(db);
      await mkdir(directory, { recursive: true });
      const temporary = `${file}.${randomUUID()}.tmp`;
      try {
        await writeFile(temporary, JSON.stringify(db, null, 2), { flag: 'wx' });
        await rename(temporary, file);
      } finally {
        await rm(temporary, { force: true });
      }
      return result;
    })
  };
}
