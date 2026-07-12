import { pipeline } from '@xenova/transformers';

let extractor: any = null;
let modelLoading: Promise<any> | null = null;

const EMBEDDING_TIMEOUT_MS = 8000;

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error(`Embedding timed out after ${ms}ms`)), ms)
    ),
  ]);
}

/**
 * Computes semantic vector embedding for a given text query.
 * Uses the lightweight 'all-MiniLM-L6-v2' sentence transformer.
 * Falls back gracefully if model download or inference times out.
 */
export async function getEmbedding(text: string): Promise<number[]> {
  try {
    if (!extractor) {
      if (!modelLoading) {
        console.log('🌱 Loading Hugging Face sentence-transformer model (all-MiniLM-L6-v2)...');
        modelLoading = pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2')
          .then((p) => { extractor = p; modelLoading = null; console.log('✅ Model loaded.'); return p; })
          .catch((err) => { modelLoading = null; throw err; });
      }
      extractor = await withTimeout(modelLoading, EMBEDDING_TIMEOUT_MS);
    }

    const output: any = await withTimeout(
      extractor(text, { pooling: 'mean', normalize: true }),
      EMBEDDING_TIMEOUT_MS
    );

    return Array.from(output.data);
  } catch (err) {
    console.error('❌ Failed to calculate embedding:', err);
    throw err;
  }
}

/**
 * Calculates cosine similarity between two vectors.
 */
export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) return 0;
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  if (normA === 0 || normB === 0) return 0;
  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}
