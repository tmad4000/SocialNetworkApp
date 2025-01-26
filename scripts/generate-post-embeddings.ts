import { db } from "@db";
import { posts, postEmbeddings } from "@db/schema";
import { generateEmbedding } from "../server/embeddings";
import { eq } from "drizzle-orm";

async function generatePostEmbeddings() {
  try {
    console.log("Starting post embeddings generation...");

    // Get all posts
    const allPosts = await db.query.posts.findMany();
    console.log(`Found ${allPosts.length} posts total`);

    // Process each post
    for (const post of allPosts) {
      try {
        console.log(`\nGenerating embedding for post ${post.id}:`, post.content);
        const embedding = await generateEmbedding(post.content);

        // Store or update the embedding
        await db
          .insert(postEmbeddings)
          .values({
            postId: post.id,
            embedding,
          })
          .onConflictDoUpdate({
            target: [postEmbeddings.postId],
            set: { embedding },
          });

        console.log(`Successfully generated/updated embedding for post ${post.id}`);
      } catch (error) {
        console.error(`Error processing post ${post.id}:`, error);
      }
    }

    console.log("\nFinished generating post embeddings!");
  } catch (error) {
    console.error("Error in generatePostEmbeddings:", error);
    process.exit(1);
  }
}

// Run the script
generatePostEmbeddings().catch(console.error);