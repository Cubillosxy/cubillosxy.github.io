/**
 * loader.js
 * Lazy-loads chunks.json and index.json once and caches them in memory.
 * Uses absolute URLs because Web Workers resolve relative paths from the
 * worker script location (js/chatbot/worker.js), NOT the site root.
 */

let _chunks = null;
let _index = null;

// Derive the site root from the worker's own URL
// e.g. "http://localhost:8000/js/chatbot/worker.js" → "http://localhost:8000"
const SITE_ROOT = self.location.href.split('/js/chatbot/')[0];

export async function loadRAG() {
  if (_chunks && _index) return { chunks: _chunks, index: _index };

  const [chunksRes, indexRes] = await Promise.all([
    fetch(SITE_ROOT + '/rag/data/chunks.json'),
    fetch(SITE_ROOT + '/rag/data/index.json'),
  ]);

  if (!chunksRes.ok) throw new Error('Failed to load chunks.json: ' + chunksRes.status);
  if (!indexRes.ok) throw new Error('Failed to load index.json: ' + indexRes.status);

  _chunks = await chunksRes.json();
  _index = await indexRes.json();

  return { chunks: _chunks, index: _index };
}
