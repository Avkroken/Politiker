import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { runInNewContext } from 'node:vm';

const here = dirname(fileURLToPath(import.meta.url));
const dbSource = readFileSync(join(here, '..', 'src', 'db.ts'), 'utf8');

function loadExplicitEmailJsonChunks(): (values: string[]) => string[] {
  const start = dbSource.indexOf('const MAX_EXPLICIT_EMAIL_BIND_BYTES');
  const endMarker = '\n}\n\nexport async function getRecipientsForAreas';
  const end = dbSource.indexOf(endMarker, start);
  assert.ok(start >= 0 && end > start, 'chunk helper and bind limit must exist before getRecipientsForAreas');
  const helperSource = dbSource
    .slice(start, end + 2)
    .replace('function explicitEmailJsonChunks(values:string[]):string[]{', 'function explicitEmailJsonChunks(values){')
    .replace('chunks:string[]=[],current:string[]=[]', 'chunks=[],current=[]');
  const context: { chunker?: (values: string[]) => string[] } = { TextEncoder, JSON } as unknown as { chunker?: (values: string[]) => string[] };
  runInNewContext(`${helperSource}; chunker=explicitEmailJsonChunks;`, context);
  assert.equal(typeof context.chunker, 'function');
  return context.chunker!;
}

test('explicit recipient lookup chunks 10,000 long addresses below the D1 bind limit', () => {
  const values = Array.from({ length: 10_000 }, (_, i) => `${String(i).padStart(5, '0')}${'a'.repeat(235)}@e.se`);
  const chunks = loadExplicitEmailJsonChunks()(values);
  const encoder = new TextEncoder();

  assert.ok(chunks.length > 1, '10,000 long addresses must use multiple D1 bindings');
  for (const chunk of chunks) {
    assert.ok(encoder.encode(chunk).byteLength <= 1_500_000, 'each JSON binding must stay below the conservative cap');
  }
  assert.deepEqual(chunks.flatMap(chunk => JSON.parse(chunk) as string[]), values);
  assert.match(dbSource, /for\(const emailJson of explicitEmailJsonChunks\(\[\.\.\.requestedByEmail\.keys\(\)\]\)\)/);
  assert.match(dbSource, /\.bind\(emailJson\)\.all/);
});
