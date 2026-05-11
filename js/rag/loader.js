/**
 * loader.js
 * Lazy-loads chunks.json and index.json once and caches them in memory.
 * Call loadRAG() before any retrieval.
 */

let _chunks = null;
let _index  = null;

export async function loadRAG() {
  if (_chunks && _index) return { chunks: _chunks, index: _index };

  const [chunksRes, indexRes] = await Promise.all([
    fetch('rag/data/chunks.json'),
    fetch('rag/data/index.json'),
  ]);

  if (!chunksRes.ok) throw new Error('Failed to load chunks.json: ' + chunksRes.status);
  if (!indexRes.ok)  throw new Error('Failed to load index.json: '  + indexRes.status);

  _chunks = await chunksRes.json();
  _index  = await indexRes.json();

  return { chunks: _chunks, index: _index };
}
