import { pipeline } from '@xenova/transformers';

let extractor: any = null;

/**
 * Computes semantic vector embedding for a given text query.
 * Uses the lightweight 'all-MiniLM-L6-v2' sentence transformer.
 */
export async function getEmbedding(text: string): Promise<number[]> {
  try {
    if (!extractor) {
      console.log('🌱 Loading Hugging Face sentence-transformer model (all-MiniLM-L6-v2)...');
      extractor = await pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2');
      console.log('✅ Model loaded successfully.');
    }
    
    const output = await extractor(text, {
      pooling: 'mean',
      normalize: true,
    });
    
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
