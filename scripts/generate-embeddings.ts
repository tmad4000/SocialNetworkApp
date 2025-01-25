import { db } from "@db";
import { users, userEmbeddings } from "@db/schema";
import { pipeline } from "@xenova/transformers";
import { eq } from "drizzle-orm";

async function generateEmbeddings() {
  console.log("Starting embeddings generation...");

  try {
    // Get all users with either bio or lookingFor fields
    const allUsers = await db.query.users.findMany({
      where: (users, { or, isNotNull }) =>
        or(isNotNull(users.bio), isNotNull(users.lookingFor)),
    });

    console.log(`Found ${allUsers.length} users with content to process`);

    // Initialize the model - use a simpler model for faster processing
    const model = await pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2');

    for (const user of allUsers) {
      console.log(`Processing user ${user.id}: ${user.username}`);

      let bioEmbedding = null;
      let lookingForEmbedding = null;

      // Generate bio embedding if exists
      if (user.bio) {
        console.log(`Generating bio embedding for user ${user.id}`);
        const output = await model(user.bio, {
          pooling: 'mean',
          normalize: true
        });
        // Convert Float32Array to regular array and ensure it's a proper JSON array
        bioEmbedding = Array.from(output.data).map(x => Number(x));
        console.log(`Bio embedding generated with length: ${bioEmbedding.length}`);
      }

      // Generate lookingFor embedding if exists
      if (user.lookingFor) {
        console.log(`Generating lookingFor embedding for user ${user.id}`);
        const output = await model(user.lookingFor, {
          pooling: 'mean',
          normalize: true
        });
        // Convert Float32Array to regular array and ensure it's a proper JSON array
        lookingForEmbedding = Array.from(output.data).map(x => Number(x));
        console.log(`LookingFor embedding generated with length: ${lookingForEmbedding.length}`);
      }

      try {
        // Check if user already has embeddings
        const existingEmbedding = await db.query.userEmbeddings.findFirst({
          where: eq(userEmbeddings.userId, user.id),
        });

        if (existingEmbedding) {
          console.log(`Updating embeddings for user ${user.id}`);
          // Update existing embeddings
          await db
            .update(userEmbeddings)
            .set({
              bioEmbedding: bioEmbedding ? bioEmbedding : existingEmbedding.bioEmbedding,
              lookingForEmbedding: lookingForEmbedding ? lookingForEmbedding : existingEmbedding.lookingForEmbedding,
              updatedAt: new Date(),
            })
            .where(eq(userEmbeddings.userId, user.id));
        } else {
          console.log(`Creating new embeddings for user ${user.id}`);
          // Create new embeddings
          await db.insert(userEmbeddings).values({
            userId: user.id,
            bioEmbedding,
            lookingForEmbedding,
          });
        }
        console.log(`Successfully saved embeddings for user ${user.id}`);
      } catch (error) {
        console.error(`Error saving embeddings for user ${user.id}:`, error);
        throw error;
      }

      console.log(`Completed processing for user ${user.id}`);
    }

    console.log("Embedding generation completed successfully!");
  } catch (error) {
    console.error("Error generating embeddings:", error);
    process.exit(1);
  }

  process.exit(0);
}

generateEmbeddings();