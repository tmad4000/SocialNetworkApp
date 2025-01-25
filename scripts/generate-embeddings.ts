import { db } from "@db";
import { users, userEmbeddings } from "@db/schema";
import { pipeline } from "@xenova/transformers";
import { eq } from "drizzle-orm";

async function generateEmbeddings() {
  console.log("Starting embeddings generation...");

  try {
    // Get all users
    const allUsers = await db.query.users.findMany();
    console.log(`Found ${allUsers.length} users to process`);

    // Initialize the model
    const model = await pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2');

    for (const user of allUsers) {
      console.log(`Processing user ${user.id}: ${user.username}`);

      let bioEmbedding = null;
      let lookingForEmbedding = null;

      // Function to safely generate embeddings
      async function generateEmbedding(text: string | null, fieldName: string) {
        // Check for both null and empty string
        if (!text?.trim()) {
          console.log(`Skipping ${fieldName} embedding for user ${user.id} - no content`);
          return null;
        }

        try {
          console.log(`Generating ${fieldName} embedding for user ${user.id}`);
          const output = await model(text, {
            pooling: 'mean',
            normalize: true
          });
          const embedding = Array.from(output.data).map(x => Number(x));
          console.log(`${fieldName} embedding generated with length: ${embedding.length}`);
          return embedding;
        } catch (error) {
          console.error(`Error generating ${fieldName} embedding for user ${user.id}:`, error);
          return null;
        }
      }

      // Generate embeddings if content exists
      bioEmbedding = await generateEmbedding(user.bio, 'bio');
      lookingForEmbedding = await generateEmbedding(user.lookingFor, 'lookingFor');

      try {
        // Check if user already has embeddings
        const existingEmbedding = await db.query.userEmbeddings.findFirst({
          where: eq(userEmbeddings.userId, user.id),
        });

        const embeddings = {
          userId: user.id,
          bioEmbedding,
          lookingForEmbedding,
          updatedAt: new Date(),
        };

        if (existingEmbedding) {
          if (bioEmbedding || lookingForEmbedding) {
            console.log(`Updating embeddings for user ${user.id}`);
            await db
              .update(userEmbeddings)
              .set(embeddings)
              .where(eq(userEmbeddings.userId, user.id));
          } else {
            console.log(`No content to generate embeddings for user ${user.id}`);
          }
        } else {
          console.log(`Creating new embeddings for user ${user.id}`);
          await db.insert(userEmbeddings).values(embeddings);
        }

        console.log(`Successfully processed embeddings for user ${user.id}`);
      } catch (error) {
        console.error(`Error saving embeddings for user ${user.id}:`, error);
        console.error('Error details:', error);
      }

      console.log(`Completed processing for user ${user.id}`);
    }

    console.log("Embedding generation completed successfully!");
  } catch (error) {
    console.error("Error during embedding generation:", error);
    process.exit(1);
  }

  process.exit(0);
}

generateEmbeddings();