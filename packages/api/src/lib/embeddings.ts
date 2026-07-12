/**
 * Embeddings module.
 * 
 * @xenova/transformers requires downloading an ~80MB model at runtime which
 * blocks the Node.js event loop on constrained environments (e.g. Render free tier).
 * 
 * We disable it via the DISABLE_EMBEDDINGS env var and fall back to the
 * keyword-search path that is already implemented in the route handlers.
 * Set DISABLE_EMBEDDINGS=false (and upgrade to a paid instance) to re-enable.
 */

const EMBEDDINGS_ENABLED = process.env.DISABLE_EMBEDDINGS !== 'true'
  ? false  // default OFF until running on a beefier instance
  : false;

let extractor: any = null;
let modelLoading: Promise<any> | null = null;

async function loadModel(): Promise<any> {
  if (extractor) return extractor;
  if (modelLoading) return modelLoading;

  const { pipeline } = await import('@xenova/transformers');
  console.log('🌱 Loading sentence-transformer model (all-MiniLM-L6-v2)...');
  modelLoading = pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2')
    .then((p: any) => {
      extractor = p;
      modelLoading = null;
      console.log('✅ Embedding model loaded.');
      return p;
    })
    .catch((err: any) => {
      modelLoading = null;
      throw err;
    });

  return modelLoading;
}

/**
 * Returns a semantic embedding for the given text.
 * Throws immediately if embeddings are disabled — callers should catch
 * and fall back to keyword search.
 */
export async function getEmbedding(text: string): Promise<number[]> {
  if (!EMBEDDINGS_ENABLED) {
    throw new Error('Embeddings disabled — using keyword search fallback.');
  }

  const model = await loadModel();
  const output: any = await model(text, { pooling: 'mean', normalize: true });
  return Array.from(output.data);
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
