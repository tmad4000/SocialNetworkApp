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
    console.log("Generating embedding for text:", preprocessedText);

    // Get embeddings iterator
    const embeddingsIterator = await model.embed([preprocessedText]);

    // Get the first embeddings result from the iterator
    const result = await embeddingsIterator.next();

    if (!result.value || !result.value.length) {
      throw new Error("Failed to generate embedding: Invalid embedding result");
    }

    // Convert Float32Array to regular array and log first few values
    const embedding = Array.from(result.value[0]);
    console.log("Generated embedding first 5 values:", embedding.slice(0, 5));
    return embedding;
  } catch (error) {
    console.error("Error in generateEmbedding:", error);
    throw new Error(`Failed to generate embedding: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

export function calculateCosineSimilarity(embedding1: number[], embedding2: number[]): number {
  if (!Array.isArray(embedding1) || !Array.isArray(embedding2)) {
    console.error('Invalid embedding format:', {
      embedding1Type: typeof embedding1,
      embedding2Type: typeof embedding2
    });
    return 0;
  }

  if (embedding1.length !== embedding2.length) {
    console.error('Embedding length mismatch:', {
      embedding1Length: embedding1.length,
      embedding2Length: embedding2.length
    });
    return 0;
  }

  console.log("Calculating similarity between embeddings:", {
    embedding1First5: embedding1.slice(0, 5),
    embedding2First5: embedding2.slice(0, 5)
  });

  // Calculate dot product
  const dotProduct = embedding1.reduce((sum, a, i) => sum + a * embedding2[i], 0);

  // Calculate magnitudes
  const magnitude1 = Math.sqrt(embedding1.reduce((sum, a) => sum + a * a, 0));
  const magnitude2 = Math.sqrt(embedding2.reduce((sum, a) => sum + a * a, 0));

  // Avoid division by zero
  if (magnitude1 === 0 || magnitude2 === 0) {
    console.error('Zero magnitude encountered:', { magnitude1, magnitude2 });
    return 0;
  }

  // Calculate cosine similarity
  const similarity = dotProduct / (magnitude1 * magnitude2);
  console.log("Calculated similarity:", similarity);

  return similarity;
}