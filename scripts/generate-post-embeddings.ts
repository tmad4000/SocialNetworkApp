import { db } from "@db";
import { posts, postEmbeddings } from "@db/schema";
import { generateEmbedding } from "../server/embeddings";
import { eq, isNull } from "drizzle-orm";

async function generatePostEmbeddings() {
  try {
    console.log("Starting post embeddings generation...");

    // Get all posts that don't have embeddings yet
    const postsWithoutEmbeddings = await db.query.posts.findMany({
      with: {
        embedding: true
      }
    });

    // Filter posts without embeddings
    const postsToProcess = postsWithoutEmbeddings.filter(post => !post.embedding);

    console.log(`Found ${postsToProcess.length} posts without embeddings`);

    // Process each post
    for (const post of postsToProcess) {
      try {
        console.log(`Generating embedding for post ${post.id}...`);
        const embedding = await generateEmbedding(post.content);

        // Store the embedding
        await db.insert(postEmbeddings).values({
          postId: post.id,
          embedding,
        });

        console.log(`Successfully generated embedding for post ${post.id}`);
      } catch (error) {
        console.error(`Error processing post ${post.id}:`, error);
      }
    }

    console.log("Finished generating post embeddings!");
  } catch (error) {
    console.error("Error in generatePostEmbeddings:", error);
    process.exit(1);
  }
}

// Run the script
generatePostEmbeddings().catch(console.error);