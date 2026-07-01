import { prisma } from './prisma';

export interface SearchResult {
  chunk: string;
  documentTitle: string;
  documentId: string;
  score: number;
}

/**
 * Tokenize a text string into a clean array of terms.
 */
function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .split(/\s+/)
    .filter((word) => word.length > 2);
}

/**
 * Perform a keyword-based search on document chunks using TF-IDF / Cosine Similarity.
 * Provides zero-dependency semantic-like matching for RAG context injection.
 */
export async function searchKnowledgeBase(
  query: string,
  organizationId: string,
  limit = 3
): Promise<SearchResult[]> {
  // Fetch all company documents
  const docs = await prisma.document.findMany({
    where: { organizationId },
  });

  if (docs.length === 0) return [];

  const queryTokens = tokenize(query);
  if (queryTokens.length === 0) return [];

  // Create document chunks (split by paragraph or double linebreaks)
  const chunks: { text: string; docTitle: string; docId: string }[] = [];
  for (const doc of docs) {
    // Split by double newline (paragraphs) or large segments
    const paragraphs = doc.content
      .split(/\n\s*\n/)
      .map((p) => p.trim())
      .filter((p) => p.length > 20);

    for (const para of paragraphs) {
      // If a paragraph is extremely long, split it further
      if (para.length > 800) {
        const sentences = para.split(/[.!?]\s+/);
        let currentChunk = '';
        for (const sent of sentences) {
          if (currentChunk.length + sent.length > 600) {
            chunks.push({ text: currentChunk.trim(), docTitle: doc.title, docId: doc.id });
            currentChunk = sent + ' ';
          } else {
            currentChunk += sent + ' ';
          }
        }
        if (currentChunk.trim().length > 10) {
          chunks.push({ text: currentChunk.trim(), docTitle: doc.title, docId: doc.id });
        }
      } else {
        chunks.push({ text: para, docTitle: doc.title, docId: doc.id });
      }
    }
  }

  if (chunks.length === 0) return [];

  // Compute TF-IDF
  const corpusTokens = chunks.map((c) => tokenize(c.text));
  const docCount = chunks.length;

  // 1. Calculate Document Frequency (DF) for each term in query
  const df: Record<string, number> = {};
  for (const term of queryTokens) {
    let count = 0;
    for (const tokens of corpusTokens) {
      if (tokens.includes(term)) {
        count++;
      }
    }
    df[term] = count;
  }

  // 2. Calculate Inverse Document Frequency (IDF)
  const idf: Record<string, number> = {};
  for (const term of queryTokens) {
    const val = df[term] || 0;
    // Standard IDF formula with smoothing
    idf[term] = Math.log((docCount + 1) / (val + 1)) + 1;
  }

  // 3. Compute cosine similarity scores
  const results: SearchResult[] = [];

  for (let i = 0; i < chunks.length; i++) {
    const chunkText = chunks[i].text;
    const tokens = corpusTokens[i];

    // Compute Term Frequency (TF) for chunk
    const tf: Record<string, number> = {};
    for (const token of tokens) {
      tf[token] = (tf[token] || 0) + 1;
    }

    // Dot product & magnitudes for Cosine Similarity
    let dotProduct = 0;
    let queryMagnitudeSq = 0;
    let docMagnitudeSq = 0;

    // Vector terms are the query tokens
    const uniqueQueryTokens = Array.from(new Set(queryTokens));
    for (const term of uniqueQueryTokens) {
      // Query TF * IDF (query TF is term count in query)
      const queryTf = queryTokens.filter((t) => t === term).length;
      const queryWeight = queryTf * idf[term];
      queryMagnitudeSq += queryWeight * queryWeight;

      // Doc TF * IDF
      const docTf = tf[term] || 0;
      const docWeight = docTf * idf[term];
      docMagnitudeSq += docWeight * docWeight;

      dotProduct += queryWeight * docWeight;
    }

    // Include other terms in doc for magnitude to properly normalize
    const uniqueDocTokens = Array.from(new Set(tokens));
    for (const term of uniqueDocTokens) {
      if (!queryTokens.includes(term)) {
        const docTf = tf[term] || 0;
        // IDF for non-query terms is estimated or ignored (here standard TF is sufficient)
        const docWeight = docTf * 1.0; 
        docMagnitudeSq += docWeight * docWeight;
      }
    }

    const queryMagnitude = Math.sqrt(queryMagnitudeSq);
    const docMagnitude = Math.sqrt(docMagnitudeSq);

    let score = 0;
    if (queryMagnitude > 0 && docMagnitude > 0) {
      score = dotProduct / (queryMagnitude * docMagnitude);
    }

    // Boost score if there are exact word overlaps
    let overlapCount = 0;
    for (const qToken of queryTokens) {
      if (tokens.includes(qToken)) {
        overlapCount++;
      }
    }
    const overlapRatio = overlapCount / queryTokens.length;
    score = score * 0.7 + overlapRatio * 0.3;

    if (score > 0.05) { // Threshold
      results.push({
        chunk: chunkText,
        documentTitle: chunks[i].docTitle,
        documentId: chunks[i].docId,
        score,
      });
    }
  }

  // Sort and return top results
  return results.sort((a, b) => b.score - a.score).slice(0, limit);
}
