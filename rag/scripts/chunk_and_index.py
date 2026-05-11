"""
chunk_and_index.py
------------------
Offline script: reads all .md files in rag/knowledge/, splits into chunks,
computes a BM25 index, and writes:
  - rag/data/chunks.json
  - rag/data/index.json

Run from the project root:
    python rag/scripts/chunk_and_index.py
"""

import json
import math
import os
import re
import sys

# ── Config ────────────────────────────────────────────────────
KNOWLEDGE_DIR = os.path.join(os.path.dirname(__file__), "../knowledge")
OUT_DIR       = os.path.join(os.path.dirname(__file__), "../data")
CHUNK_SIZE    = 200   # target words per chunk
OVERLAP       = 30    # words shared between consecutive chunks
BM25_K1       = 1.5
BM25_B        = 0.75

# EN + ES stopwords (common words that carry little retrieval signal)
STOPWORDS = {
    # English
    "a","an","the","and","or","but","in","on","at","to","for","of","with",
    "by","from","is","was","are","were","be","been","being","have","has",
    "had","do","does","did","will","would","could","should","may","might",
    "his","her","he","she","they","we","you","i","it","its","this","that",
    "these","those","as","if","not","no","so","up","out","about","into",
    "also","than","then","there","when","where","which","who","how","what",
    "all","more","some","any","can","just","over","after","before",
    # Spanish
    "el","la","los","las","un","una","unos","unas","y","o","pero","en",
    "de","del","al","con","por","para","a","que","se","su","sus","lo",
    "le","les","es","son","fue","era","una","más","mi","tu","si","no",
    "como","cuando","donde","quien","hay","ya","así","muy","también",
    "porque","sobre","entre","desde","hasta","hacia","sin","con",
}

# ── Tokenizer ─────────────────────────────────────────────────
def tokenize(text):
    """Lowercase, remove punctuation, split, remove stopwords."""
    text = text.lower()
    text = re.sub(r"[^a-z0-9áéíóúüñ\s]", " ", text)
    return [t for t in text.split() if t and t not in STOPWORDS and len(t) > 1]


# ── Chunker ───────────────────────────────────────────────────
def chunk_text(text, section_title, chunk_size=CHUNK_SIZE, overlap=OVERLAP):
    """Split text into overlapping word-window chunks."""
    words = text.split()
    chunks = []
    start = 0
    while start < len(words):
        end = min(start + chunk_size, len(words))
        chunk_words = words[start:end]
        chunks.append({
            "text": " ".join(chunk_words),
            "section": section_title,
        })
        if end == len(words):
            break
        start += chunk_size - overlap
    return chunks


# ── Read knowledge base ───────────────────────────────────────
def load_knowledge(knowledge_dir):
    all_chunks = []
    files = sorted([f for f in os.listdir(knowledge_dir) if f.endswith(".md")])
    for fname in files:
        path = os.path.join(knowledge_dir, fname)
        with open(path, encoding="utf-8") as f:
            content = f.read()

        # Use first heading as section title
        title_match = re.search(r"^#\s+(.+)", content, re.MULTILINE)
        section_title = title_match.group(1).strip() if title_match else fname

        # Split on markdown H2 headings to create natural sub-chunks
        sections = re.split(r"\n##\s+", content)
        for sec in sections:
            sec = sec.strip()
            if not sec:
                continue
            sub_title = section_title
            lines = sec.splitlines()
            if lines and not lines[0].startswith("#"):
                sub_title = section_title + " — " + lines[0].strip("# ").strip()
            chunks = chunk_text(sec, sub_title)
            all_chunks.extend(chunks)

    # Add sequential IDs
    for i, c in enumerate(all_chunks):
        c["id"] = i

    return all_chunks


# ── BM25 index builder ────────────────────────────────────────
def build_bm25_index(chunks):
    N = len(chunks)
    df = {}        # document frequency per term
    doc_lens = []  # word count per chunk

    tokenized = []
    for chunk in chunks:
        tokens = tokenize(chunk["text"])
        tokenized.append(tokens)
        doc_lens.append(len(tokens))
        for term in set(tokens):
            df[term] = df.get(term, 0) + 1

    avgdl = sum(doc_lens) / N if N else 1

    # IDF (BM25 variant)
    idf = {}
    for term, freq in df.items():
        idf[term] = math.log((N - freq + 0.5) / (freq + 0.5) + 1)

    return {
        "idf": idf,
        "avgdl": round(avgdl, 2),
        "doc_count": N,
        "k1": BM25_K1,
        "b": BM25_B,
    }


# ── Main ──────────────────────────────────────────────────────
def main():
    if not os.path.isdir(KNOWLEDGE_DIR):
        print(f"ERROR: knowledge dir not found: {KNOWLEDGE_DIR}")
        sys.exit(1)

    os.makedirs(OUT_DIR, exist_ok=True)

    print(f"Reading knowledge base from: {KNOWLEDGE_DIR}")
    chunks = load_knowledge(KNOWLEDGE_DIR)
    print(f"  → {len(chunks)} chunks created")

    print("Building BM25 index...")
    index = build_bm25_index(chunks)
    print(f"  → {len(index['idf'])} unique terms indexed")
    print(f"  → avg doc length: {index['avgdl']} tokens")

    chunks_path = os.path.join(OUT_DIR, "chunks.json")
    index_path  = os.path.join(OUT_DIR, "index.json")

    with open(chunks_path, "w", encoding="utf-8") as f:
        json.dump(chunks, f, ensure_ascii=False, indent=2)

    with open(index_path, "w", encoding="utf-8") as f:
        json.dump(index, f, ensure_ascii=False, indent=2)

    print(f"\n✅ Output written:")
    print(f"   {chunks_path} ({os.path.getsize(chunks_path)//1024} KB)")
    print(f"   {index_path} ({os.path.getsize(index_path)//1024} KB)")


if __name__ == "__main__":
    main()
