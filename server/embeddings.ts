import { FlagEmbedding } from "fastembed";

let model: any = null;

export const preprocessText = (text: string): string => {
  return text
    .toLowerCase()
    // Replace newlines with spaces
    .replace(/\n+/g, ' ')
    // Remove special characters except letters and numbers and spaces
    .replace(/[^a-z0-9\s]/g, ' ')
    // Remove extra spaces
    .replace(/\s+/g, ' ')
    .trim();
};

export async function generateEmbedding(text: string): Promise<number[]> {
  if (!text.trim()) {
    throw new Error("Cannot generate embedding for empty text");
  }

  try {
    // Initialize model if not already done
    if (!model) {
      model = await FlagEmbedding.init();
      console.log("FlagEmbedding model initialized successfully");
    }

    const preprocessedText = preprocessText(text);
    console.log("Preprocessed text:", preprocessedText);

    // Get embeddings iterator
    const embeddingsIterator = await model.embed([preprocessedText]);

    // Get the first embeddings result from the iterator
    const result = await embeddingsIterator.next();
    console.log("Generated embeddings result:", result);

    if (!result.value || !result.value.length) {
      throw new Error("Failed to generate embedding: Invalid embedding result");
    }

    // Convert Float32Array to regular array
    return Array.from(result.value);
  } catch (error) {
    console.error("Error in generateEmbedding:", error);
    throw new Error(`Failed to generate embedding: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

export function calculateCosineSimilarity(embedding1: number[], embedding2: number[]): number {
  // Calculate dot product
  const dotProduct = embedding1.reduce((sum, a, i) => sum + a * embedding2[i], 0);

  // Calculate magnitudes
  const magnitude1 = Math.sqrt(embedding1.reduce((sum, a) => sum + a * a, 0));
  const magnitude2 = Math.sqrt(embedding2.reduce((sum, a) => sum + a * a, 0));

  // Calculate cosine similarity
  return dotProduct / (magnitude1 * magnitude2);
}