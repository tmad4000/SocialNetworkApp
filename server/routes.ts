import type { Express } from "express";
import { createServer, type Server } from "http";
import { setupAuth } from "./auth";
import { db } from "@db";
import { posts, users, friends } from "@db/schema";
import { eq, desc, and, or } from "drizzle-orm";

export function registerRoutes(app: Express): Server {
  setupAuth(app);

  // Update bio
  app.put("/api/user/bio", async (req, res) => {
    if (!req.user) {
      return res.status(401).send("Not authenticated");
    }

    const { bio } = req.body;
    if (typeof bio !== "string") {
      return res.status(400).send("Bio must be a string");
    }

    const [updatedUser] = await db
      .update(users)
      .set({ bio })
      .where(eq(users.id, req.user.id))
      .returning();

    res.json(updatedUser);
  });

  // User profile
  app.get("/api/user/:id", async (req, res) => {
    const userId = parseInt(req.params.id);
    if (isNaN(userId)) {
      return res.status(400).send("Invalid user ID");
    }

    const user = await db.query.users.findFirst({
      where: eq(users.id, userId),
      columns: {
        id: true,
        username: true,
        avatar: true,
        bio: true,
        createdAt: true,
      },
    });

    if (!user) {
      return res.status(404).send("User not found");
    }

    res.json(user);
  });

  // User posts
  app.get("/api/posts/user/:id", async (req, res) => {
    const userId = parseInt(req.params.id);
    if (isNaN(userId)) {
      return res.status(400).send("Invalid user ID");
    }

    const userPosts = await db.query.posts.findMany({
      where: eq(posts.userId, userId),
      with: {
        user: {
          columns: {
            id: true,
            username: true,
            avatar: true,
          },
        },
      },
      orderBy: desc(posts.createdAt),
    });

    res.json(userPosts);
  });

  // Posts
  app.get("/api/posts", async (req, res) => {
    const allPosts = await db.query.posts.findMany({
      with: {
        user: {
          columns: {
            id: true,
            username: true,
            avatar: true,
          },
        },
      },
      orderBy: desc(posts.createdAt),
    });
    res.json(allPosts);
  });

  app.post("/api/posts", async (req, res) => {
    if (!req.user) {
      return res.status(401).send("Not authenticated");
    }

    const { content } = req.body;
    if (!content) {
      return res.status(400).send("Content is required");
    }

    const newPost = await db.insert(posts)
      .values({
        content,
        userId: req.user.id,
      })
      .returning();

    res.json(newPost[0]);
  });

  // Friends
  app.get("/api/friends", async (req, res) => {
    if (!req.user) {
      return res.status(401).send("Not authenticated");
    }

    const userFriends = await db.query.friends.findMany({
      where: or(
        eq(friends.userId, req.user.id),
        eq(friends.friendId, req.user.id)
      ),
      with: {
        user: true,
        friend: true,
      },
    });

    res.json(userFriends);
  });

  app.post("/api/friends/request", async (req, res) => {
    if (!req.user) {
      return res.status(401).send("Not authenticated");
    }

    const { friendId } = req.body;
    if (!friendId) {
      return res.status(400).send("Friend ID is required");
    }

    const existingRequest = await db.query.friends.findFirst({
      where: or(
        and(
          eq(friends.userId, req.user.id),
          eq(friends.friendId, friendId)
        ),
        and(
          eq(friends.userId, friendId),
          eq(friends.friendId, req.user.id)
        )
      ),
    });

    if (existingRequest) {
      return res.status(400).send("Friend request already exists");
    }

    const newRequest = await db.insert(friends)
      .values({
        userId: req.user.id,
        friendId: friendId,
        status: "pending",
      })
      .returning();

    res.json(newRequest[0]);
  });

  app.post("/api/friends/accept", async (req, res) => {
    if (!req.user) {
      return res.status(401).send("Not authenticated");
    }

    const { requestId } = req.body;
    if (!requestId) {
      return res.status(400).send("Request ID is required");
    }

    const request = await db.query.friends.findFirst({
      where: eq(friends.id, requestId),
    });

    if (!request || request.friendId !== req.user.id) {
      return res.status(400).send("Invalid request");
    }

    const updatedRequest = await db
      .update(friends)
      .set({ status: "accepted" })
      .where(eq(friends.id, requestId))
      .returning();

    res.json(updatedRequest[0]);
  });

  // Users
  app.get("/api/users/search", async (req, res) => {
    const { query } = req.query;
    if (!query || typeof query !== "string") {
      return res.status(400).send("Search query is required");
    }

    const searchResults = await db.query.users.findMany({
      where: (users) => {
        return users.username.toLowerCase().includes(query.toLowerCase());
      },
      limit: 10,
    });

    res.json(searchResults);
  });

  const httpServer = createServer(app);
  return httpServer;
}