import { db } from "@db";
import { users, userEmbeddings } from "@db/schema";
import { generateEmbedding } from "../server/embeddings";
import { eq } from "drizzle-orm";

async function generateUserEmbeddings() {
  try {
    console.log("Starting user embeddings generation...");

    // Get all users with bio or lookingFor fields
    const allUsers = await db.query.users.findMany();
    console.log(`Found ${allUsers.length} users total`);

    // Process each user
    for (const user of allUsers) {
      try {
        console.log(`\nProcessing user ${user.id}:`, user.username);
        let bioEmbedding = null;
        let lookingForEmbedding = null;

        if (user.bio?.trim()) {
          console.log("Generating bio embedding...");
          bioEmbedding = await generateEmbedding(user.bio);
        }

        if (user.lookingFor?.trim()) {
          console.log("Generating lookingFor embedding...");
          lookingForEmbedding = await generateEmbedding(user.lookingFor);
        }

        // Only create embeddings if we have either bio or lookingFor
        if (bioEmbedding || lookingForEmbedding) {
          // Store or update the embeddings
          await db
            .insert(userEmbeddings)
            .values({
              userId: user.id,
              bioEmbedding,
              lookingForEmbedding,
            })
            .onConflictDoUpdate({
              target: [userEmbeddings.userId],
              set: { bioEmbedding, lookingForEmbedding },
            });

          console.log(`Successfully generated/updated embeddings for user ${user.id}`);
        }
      } catch (error) {
        console.error(`Error processing user ${user.id}:`, error);
      }
    }

    console.log("\nFinished generating user embeddings!");
  } catch (error) {
    console.error("Error in generateUserEmbeddings:", error);
    process.exit(1);
  }
}

// Run the script
generateUserEmbeddings().catch(console.error);
