import type { Express } from "express";
import { createServer, type Server } from "http";
import { setupAuth } from "./auth";
import { db } from "@db";
import { posts, users, friends, postMentions, postLikes, comments, commentLikes, userEmbeddings, postEmbeddings, groups, groupMembers, postFollowers, relatedPosts } from "@db/schema";
import { eq, desc, and, or, inArray, ilike, sql, not } from "drizzle-orm";
import { generateEmbedding, calculateCosineSimilarity } from "./embeddings";
import qr from 'qrcode';

export function registerRoutes(app: Express): Server {
  const httpServer = createServer(app);

  setupAuth(app);

  // Friend request routes
  app.post("/api/friends/request", async (req, res) => {
    if (!req.user) {
      return res.status(401).send("Not authenticated");
    }

    const { friendId } = req.body;
    if (!friendId || typeof friendId !== "number") {
      return res.status(400).send("Friend ID is required");
    }

    try {
      const friend = await db.query.users.findFirst({
        where: eq(users.id, friendId),
      });

      if (!friend) {
        return res.status(404).send("User not found");
      }

      // Check if request already exists
      const existingRequest = await db.query.friends.findFirst({
        where: and(
          or(
            and(
              eq(friends.userId, req.user.id),
              eq(friends.friendId, friendId)
            ),
            and(
              eq(friends.userId, friendId),
              eq(friends.friendId, req.user.id)
            )
          )
        ),
      });

      if (existingRequest) {
        return res.status(400).send("Friend request already exists");
      }

      // Create friend request
      const [newRequest] = await db
        .insert(friends)
        .values({
          userId: req.user.id,
          friendId,
          status: "pending",
        })
        .returning();

      res.json(newRequest);
    } catch (error) {
      console.error('Error creating friend request:', error);
      res.status(500).send("Error creating friend request");
    }
  });

  app.post("/api/friends/accept", async (req, res) => {
    if (!req.user) {
      return res.status(401).send("Not authenticated");
    }

    const { requestId } = req.body;
    if (!requestId) {
      return res.status(400).send("Request ID is required");
    }

    try {
      const friendRequest = await db.query.friends.findFirst({
        where: eq(friends.id, requestId),
        with: {
          user: true
        }
      });

      if (!friendRequest) {
        return res.status(404).send("Friend request not found");
      }

      if (friendRequest.friendId !== req.user.id) {
        return res.status(403).send("Not authorized to accept this request");
      }

      const [updatedRequest] = await db
        .update(friends)
        .set({ status: "accepted" })
        .where(eq(friends.id, requestId))
        .returning();

      res.json(updatedRequest);
    } catch (error) {
      console.error('Error accepting friend request:', error);
      res.status(500).send("Error accepting friend request");
    }
  });

  app.put("/api/posts/:id/status", async (req, res) => {
    if (!req.user) {
      return res.status(401).send("Not authenticated");
    }

    const postId = parseInt(req.params.id);
    if (isNaN(postId)) {
      return res.status(400).send("Invalid post ID");
    }

    const { status } = req.body;
    if (typeof status !== "string") {
      return res.status(400).send("Status must be a string");
    }

    // Validate status
    const validStatuses = ['none', 'not acknowledged', 'acknowledged', 'in progress', 'done'];
    if (!validStatuses.includes(status)) {
      return res.status(400).send("Invalid status");
    }

    // Verify post exists
    const post = await db.query.posts.findFirst({
      where: eq(posts.id, postId),
    });

    if (!post) {
      return res.status(404).send("Post not found");
    }

    // Update post status (removed ownership check)
    const [updatedPost] = await db
      .update(posts)
      .set({ status })
      .where(eq(posts.id, postId))
      .returning();

    res.json(updatedPost);
  });

  app.post("/api/posts/:id/like", async (req, res) => {
    if (!req.user) {
      return res.status(401).send("Not authenticated");
    }

    const postId = parseInt(req.params.id);
    if (isNaN(postId)) {
      return res.status(400).send("Invalid post ID");
    }

    // Check if post exists
    const post = await db.query.posts.findFirst({
      where: eq(posts.id, postId),
      with: {
        user: {
          columns: {
            id: true,
            username: true,
          }
        }
      }
    });

    if (!post) {
      return res.status(404).send("Post not found");
    }

    // Check if user already liked the post
    const existingLike = await db.query.postLikes.findFirst({
      where: and(
        eq(postLikes.postId, postId),
        eq(postLikes.userId, req.user.id)
      ),
    });

    let result;
    if (existingLike) {
      await db.delete(postLikes).where(eq(postLikes.id, existingLike.id));
      const likeCount = await db
        .select({ count: sql<number>`count(*)` })
        .from(postLikes)
        .where(eq(postLikes.postId, postId));
      result = { liked: false, likeCount: likeCount[0].count };
    } else {
      await db.insert(postLikes).values({
        postId,
        userId: req.user.id,
      });
      const likeCount = await db
        .select({ count: sql<number>`count(*)` })
        .from(postLikes)
        .where(eq(postLikes.postId, postId));
      result = { liked: true, likeCount: likeCount[0].count };
    }

    res.json(result);
  });

  app.get("/api/posts/:id/likes", async (req, res) => {
    const postId = parseInt(req.params.id);
    if (isNaN(postId)) {
      return res.status(400).send("Invalid post ID");
    }

    try {
      const likes = await db.query.postLikes.findMany({
        where: eq(postLikes.postId, postId),
        with: {
          user: {
            columns: {
              id: true,
              username: true,
              avatar: true,
            }
          }
        },
        orderBy: desc(postLikes.createdAt),
      });

      res.json(likes);
    } catch (error) {
      console.error('Error fetching post likes:', error);
      res.status(500).json({ message: "Error fetching post likes" });
    }
  });

  app.post("/api/comments/:id/like", async (req, res) => {
    if (!req.user) {
      return res.status(401).json({ message: "Not authenticated" });
    }

    try {
      const commentId = parseInt(req.params.id);
      if (isNaN(commentId)) {
        return res.status(400).json({ message: "Invalid comment ID" });
      }

      // Check if comment exists
      const comment = await db.query.comments.findFirst({
        where: eq(comments.id, commentId),
      });

      if (!comment) {
        return res.status(404).json({ message: "Comment not found" });
      }

      // Check if user already liked the comment
      const existingLike = await db.query.commentLikes.findFirst({
        where: and(
          eq(commentLikes.commentId, commentId),
          eq(commentLikes.userId, req.user.id)
        ),
      });

      if (existingLike) {
        // Unlike: remove the like
        await db
          .delete(commentLikes)
          .where(eq(commentLikes.id, existingLike.id));

        // Get updated like count
        const likeCount = await db
          .select({ count: sql<number>`count(*)` })
          .from(commentLikes)
          .where(eq(commentLikes.commentId, commentId));

        res.json({ liked: false, likeCount: likeCount[0].count });
      } else {
        // Like: add new like
        await db.insert(commentLikes).values({
          commentId,
          userId: req.user.id,
        });

        // Get updated like count
        const likeCount = await db
          .select({ count: sql<number>`count(*)` })
          .from(commentLikes)
          .where(eq(commentLikes.commentId, commentId));

        res.json({ liked: true, likeCount: likeCount[0].count });
      }
    } catch (error) {
      console.error('Error toggling comment like:', error);
      res.status(500).json({ message: "Error toggling comment like" });
    }
  });

  app.get("/api/comments/:id/likes", async (req, res) => {
    const commentId = parseInt(req.params.id);
    if (isNaN(commentId)) {
      return res.status(400).json({ message: "Invalid comment ID" });
    }

    try {
      const likes = await db.query.commentLikes.findMany({
        where: eq(commentLikes.commentId, commentId),
        with: {
          user: {
            columns: {
              id: true,
              username: true,
              avatar: true,
            }
          }
        },
        orderBy: desc(commentLikes.createdAt),
      });

      res.json(likes);
    } catch (error) {
      console.error('Error fetching comment likes:', error);
      res.status(500).json({ message: "Error fetching comment likes" });
    }
  });

  app.get("/api/comments/:id/count", async (req, res) => {
    try {
      const commentId = parseInt(req.params.id);
      if (isNaN(commentId)) {
        return res.status(400).json({ message: "Invalid comment ID" });
      }

      const count = await db
        .select({ count: sql<number>`count(*)` })
        .from(commentLikes)
        .where(eq(commentLikes.commentId, commentId));

      res.json({ count: count[0].count });
    } catch (error) {
      console.error('Error fetching comment count:', error);
      res.status(500).json({ message: "Error fetching comment count" });
    }
  });

  app.get("/api/posts/:id/comments/count", async (req, res) => {
    try {
      const postId = parseInt(req.params.id);
      if (isNaN(postId)) {
        return res.status(400).json({ message: "Invalid post ID" });
      }

      const count = await db
        .select({ count: sql<number>`count(*)` })
        .from(comments)
        .where(eq(comments.postId, postId));

      res.json({ count: count[0].count });
    } catch (error) {
      console.error('Error fetching comment count:', error);
      res.status(500).json({ message: "Error fetching comment count" });
    }
  });

  app.get("/api/posts/:id/comments", async (req, res) => {
    try {
      const postId = parseInt(req.params.id);
      if (isNaN(postId)) {
        return res.status(400).json({ message: "Invalid post ID" });
      }

      const postComments = await db.query.comments.findMany({
        where: eq(comments.postId, postId),
        with: {
          user: {
            columns: {
              id: true,
              username: true,
              avatar: true,
            }
          },
          likes: true,
        },
        orderBy: desc(comments.createdAt),
      });

      // Transform comments to include like count and liked status
      const commentsWithLikes = postComments.map(comment => ({
        ...comment,
        likeCount: comment.likes.length,
        liked: req.user ? comment.likes.some(like => like.userId === req.user.id) : false,
        likes: undefined, // Remove the likes array from the response
      }));

      res.json(commentsWithLikes);
    } catch (error) {
      console.error('Error fetching comments:', error);
      res.status(500).json({ message: "Error fetching comments" });
    }
  });



  app.post("/api/posts/:id/comments", async (req, res) => {
    try {
      if (!req.user) {
        return res.status(401).json({ message: "Not authenticated" });
      }

      const postId = parseInt(req.params.id);
      if (isNaN(postId)) {
        return res.status(400).json({ message: "Invalid post ID" });
      }

      const { content } = req.body;
      if (!content || typeof content !== "string") {
        return res.status(400).json({ message: "Content is required" });
      }

      // Verify post exists
      const post = await db.query.posts.findFirst({
        where: eq(posts.id, postId),
        with: {
          user: {
            columns: {
              id: true,
              username: true,
            }
          }
        }
      });

      if (!post) {
        return res.status(404).json({ message: "Post not found" });
      }

      // Create comment
      const [newComment] = await db
        .insert(comments)
        .values({
          content,
          postId,
          userId: req.user.id,
        })
        .returning();

      // Return comment with user information
      const commentWithUser = await db.query.comments.findFirst({
        where: eq(comments.id, newComment.id),
        with: {
          user: {
            columns: {
              id: true,
              username: true,
              avatar: true,
            }
          }
        }
      });

      res.json(commentWithUser);
    } catch (error) {
      console.error('Error creating comment:', error);
      res.status(500).json({ message: "Error creating comment" });
    }
  });

  app.put("/api/user/looking-for", async (req, res) => {
    if (!req.user) {
      return res.status(401).json({ message: "Not authenticated" });
    }

    const { lookingFor } = req.body;
    if (typeof lookingFor !== "string") {
      return res.status(400).json({ message: "Looking for must be a string" });
    }

    try {
      const [updatedUser] = await db
        .update(users)
        .set({ lookingFor })
        .where(eq(users.id, req.user.id))
        .returning();

      // Only attempt to generate embedding if lookingFor is not empty
      if (lookingFor.trim()) {
        try {
          const lookingForEmbedding = await generateEmbedding(lookingFor);

          // Upsert the embedding
          await db
            .insert(userEmbeddings)
            .values({
              userId: req.user.id,
              lookingForEmbedding,
            })
            .onConflictDoUpdate({
              target: [userEmbeddings.userId],
              set: { lookingForEmbedding },
            });
        } catch (embeddingError) {
          console.error('Error generating lookingFor embedding:', embeddingError);
        }
      }

      res.json(updatedUser);
    } catch (error) {
      console.error('Error updating looking for:', error);
      res.status(500).json({ message: "Error updating looking for" });
    }
  });

  app.get("/api/user-embeddings", async (req, res) => {
    try {
      const embeddings = await db.query.userEmbeddings.findMany();
      res.json(embeddings);
    } catch (error) {
      console.error('Error fetching user embeddings:', error);
      res.status(500).json({ message: "Error fetching user embeddings" });
    }
  });

  app.put("/api/user/bio", async (req, res) => {
    if (!req.user) {
      return res.status(401).json({ message: "Not authenticated" });
    }

    const { bio } = req.body;
    if (typeof bio !== "string") {
      return res.status(400).json({ message: "Bio must be a string" });
    }

    try {
      // First update the user bio
      const [updatedUser] = await db
        .update(users)
        .set({ bio })
        .where(eq(users.id, req.user.id))
        .returning();

      // Only attempt to generate embedding if bio is not empty
      if (bio.trim()) {
        try {
          const bioEmbedding = await generateEmbedding(bio);

          // Upsert the embedding
          await db
            .insert(userEmbeddings)
            .values({
              userId: req.user.id,
              bioEmbedding,
            })
            .onConflictDoUpdate({
              target: [userEmbeddings.userId],
              set: { bioEmbedding },
            });
        } catch (embeddingError) {
          // Log embedding error but don't fail the request
          console.error('Error generating bio embedding:', embeddingError);
        }
      }

      res.json(updatedUser);
    } catch (error) {
      console.error('Error updating bio:', error);
      res.status(500).json({ message: "Error updating bio" });
    }
  });

  app.put("/api/user/linkedin", async (req, res) => {
    if (!req.user) {
      return res.status(401).send("Not authenticated");
    }

    const { linkedinUrl } = req.body;
    if (typeof linkedinUrl !== "string") {
      return res.status(400).send("LinkedIn URL must be a string");
    }

    // Basic URL validation
    try {
      if (linkedinUrl && !linkedinUrl.startsWith('https://www.linkedin.com/')) {
        return res.status(400).send("Invalid LinkedIn URL format");
      }
    } catch (error) {
      return res.status(400).send("Invalid URL format");
    }

    const [updatedUser] = await db
      .update(users)
      .set({ linkedinUrl })
      .where(eq(users.id, req.user.id))
      .returning();

    res.json(updatedUser);
  });

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
        linkedinUrl: true,
        lookingFor: true,
        createdAt: true,
      },
    });

    if (!user) {
      return res.status(404).send("User not found");
    }

    res.json(user);
  });

  app.get("/api/user/:id/matches", async (req, res) => {
    const userId = parseInt(req.params.id);
    if (isNaN(userId)) {
      return res.status(400).send("Invalid user ID");
    }

    try {
      // First check if user exists and get their profile info
      const user = await db.query.users.findFirst({
        where: eq(users.id, userId),
      });

      if (!user) {
        return res.status(404).send("User not found");
      }

      // Get the user's embeddings
      const userEmbedding = await db.query.userEmbeddings.findFirst({
        where: eq(userEmbeddings.userId, userId),
      });

      // If user has no embeddings, check if they have bio or lookingFor
      if (!userEmbedding || (!userEmbedding.bioEmbedding && !userEmbedding.lookingForEmbedding)) {
        if (!user.bio && !user.lookingFor) {
          return res.status(404).json({
            message: "No matches available. Add a bio or 'looking for' section to your profile to find matches.",
            reason: "no_profile_info"
          });
        }

        // They have profile info but no embeddings, generate them
        let bioEmbedding = null;
        let lookingForEmbedding = null;

        if (user.bio?.trim()) {
          bioEmbedding = await generateEmbedding(user.bio);
        }
        if (user.lookingFor?.trim()) {
          lookingForEmbedding = await generateEmbedding(user.lookingFor);
        }

        // Store the embeddings
        await db
          .insert(userEmbeddings)
          .values({
            userId,
            bioEmbedding,
            lookingForEmbedding,
          })
          .onConflictDoUpdate({
            target: [userEmbeddings.userId],
            set: { bioEmbedding, lookingForEmbedding },
          });

        // Fetch the newly created embedding
        const newUserEmbedding = await db.query.userEmbeddings.findFirst({
          where: eq(userEmbeddings.userId, userId),
        });

        if (!newUserEmbedding || (!newUserEmbedding.bioEmbedding && !newUserEmbedding.lookingForEmbedding)) {
          return res.status(500).json({
            message: "Error generating embeddings for your profile",
            reason: "embedding_generation_failed"
          });
        }

        // Continue with the new embedding
        userEmbedding = newUserEmbedding;
      }

      // Get all other users' embeddings
      const allEmbeddings = await db.query.userEmbeddings.findMany({
        where: not(eq(userEmbeddings.userId, userId)),
        with: {
          user: {
            columns: {
              id: true,
              username: true,
              avatar: true,
              bio: true,
              lookingFor: true,
            }
          }
        }
      });

      const matches = allEmbeddings
        .map(other => {
          let totalScore = 0;
          let scoreCount = 0;

          // Calculate bio similarity if both users have bio embeddings
          if (userEmbedding.bioEmbedding && other.bioEmbedding) {
            totalScore += calculateCosineSimilarity(
              userEmbedding.bioEmbedding as number[],
              other.bioEmbedding as number[]
            );
            scoreCount++;
          }

          // Calculate lookingFor similarity if both users have lookingFor embeddings
          if (userEmbedding.lookingForEmbedding && other.lookingForEmbedding) {
            totalScore += calculateCosineSimilarity(
              userEmbedding.lookingForEmbedding as number[],
              other.lookingForEmbedding as number[]
            );
            scoreCount++;
          }

          // Calculate average similarity score
          const averageScore = scoreCount > 0 ? totalScore / scoreCount : 0;

          return {
            user: other.user,
            matchScore: averageScore,
          };
        })
        .filter(match => match.matchScore > 0) // Only include matches with positive scores
        .sort((a, b) => b.matchScore - a.matchScore) // Sort by score descending
        .slice(0, 5); // Get top 5 matches

      // If no matches found after all calculations
      if (matches.length === 0) {
        return res.json({
          message: "No matches found. Try updating your profile to find better matches.",
          matches: []
        });
      }

      res.json({
        message: "Matches found based on your profile",
        matches
      });
    } catch (error) {
      console.error('Error finding matches:', error);
      res.status(500).send("Error finding matches");
    }
  });

  app.get("/api/users/search", async (req, res) => {
    const { query } = req.query;
    if (!query || typeof query !== "string") {
      return res.status(400).send("Search query is required");
    }

    try {
      console.log('Searching users with query:', query);
      const searchResults = await db
        .select({
          id: users.id,
          username: users.username,
          avatar: users.avatar,
        })
        .from(users)
        .where(ilike(users.username, `%${query}%`))
        .limit(10);

      console.log('Search results:', searchResults);
      res.json(searchResults);
    } catch (error) {
      console.error('Error searching users:', error);
      res.status(500).json({ message: "Error searching users" });
    }
  });

  app.get("/api/users", async (req, res) => {
    try {
      const allUsers = await db
        .select({
          id: users.id,
          username: users.username,
          avatar: users.avatar,
          bio: users.bio,  // Added bio field
        })
        .from(users)
        .limit(100); // Limit to prevent loading too many users

      res.json(allUsers);
    } catch (error) {
      console.error('Error fetching users:', error);
      res.status(500).json({ message: "Error fetching users" });
    }
  });

  // Add new group routes to the existing routes
  // Place this after the user routes but before the posts routes

  // Create group
  app.post("/api/groups", async (req, res) => {
    if (!req.user) {
      return res.status(401).send("Not authenticated");
    }

    const { name, description } = req.body;
    if (!name || typeof name !== "string") {
      return res.status(400).send("Group name is required");
    }

    try {
      const [newGroup] = await db
        .insert(groups)
        .values({
          name,
          description,
          createdBy: req.user.id,
        })
        .returning();

      // Add creator as first member with admin role
      await db.insert(groupMembers).values({
        groupId: newGroup.id,
        userId: req.user.id,
        role: 'admin',
      });

      res.json(newGroup);
    } catch (error) {
      console.error('Error creating group:', error);
      res.status(500).send("Error creating group");
    }
  });

  // Get all groups
  app.get("/api/groups", async (req, res) => {
    try {
      const allGroups = await db.query.groups.findMany({
        orderBy: desc(groups.createdAt),
        with: {
          creator: {
            columns: {
              id: true,
              username: true,
              avatar: true,
            }
          },
          members: {
            with: {
              user: {
                columns: {
                  id: true,
                  username: true,
                  avatar: true,
                }
              }
            }
          }
        },
      });

      const groupsWithMemberCount = allGroups.map(group => ({
        ...group,
        memberCount: group.members.length,
        members: undefined, // Don't send full member list in groups overview
      }));

      res.json(groupsWithMemberCount);
    } catch (error) {
      console.error('Error fetching groups:', error);
      res.status(500).send("Error fetching groups");
    }
  });

  // Get single group
  app.get("/api/groups/:id", async (req, res) => {
    const groupId = parseInt(req.params.id);
    if (isNaN(groupId)) {
      return res.status(400).send("Invalid group ID");
    }

    try {
      const group = await db.query.groups.findFirst({
        where: eq(groups.id, groupId),
        with: {
          creator: {
            columns: {
              id: true,
              username: true,
              avatar: true,
            }
          },
          members: {
            columns: {
              role: true,
              joinedAt: true,
            },
            with: {
              user: {
                columns: {
                  id: true,
                  username: true,
                  avatar: true,
                }
              }
            },
            orderBy: desc(groupMembers.joinedAt),
          }
        }
      });

      if (!group) {
        return res.status(404).send("Group not found");
      }

      // Check if current user is a member
      const isMember = req.user ? group.members.some(member => member.user.id === req.user?.id) : false;

      // Transform the response to include role information
      const formattedGroup = {
        ...group,
        isMember,
        memberCount: group.members.length,
        members: group.members.map(member => ({
          ...member.user,
          role: member.role,
          joinedAt: member.joinedAt,
        }))
      };

      res.json(formattedGroup);
    } catch (error) {
      console.error('Error fetching group:', error);
      res.status(500).send("Error fetching group");
    }
  });

  // Join group
  app.post("/api/groups/:id/join", async (req, res) => {
    if (!req.user) {
      return res.status(401).send("Not authenticated");
    }

    const groupId = parseInt(req.params.id);
    if (isNaN(groupId)) {
      return res.status(400).send("Invalid group ID");
    }

    try {
      // Check if user is already a member
      const existingMember = await db.query.groupMembers.findFirst({
        where: and(
          eq(groupMembers.groupId, groupId),
          eq(groupMembers.userId, req.user.id)
        ),
      });

      if (existingMember) {
        return res.status(400).send("Already a member of this group");
      }

      // Add user as member
      const [newMember] = await db
        .insert(groupMembers)
        .values({
          groupId,
          userId: req.user.id,
          role: 'member',
        })
        .returning();

      res.json(newMember);
    } catch (error) {
      console.error('Error joining group:', error);
      res.status(500).send("Error joining group");
    }
  });

  // Leave group - UPDATED
  app.post("/api/groups/:id/leave", async (req, res) => {
    if (!req.user) {
      return res.status(401).send("Not authenticated");
    }

    const groupId = parseInt(req.params.id);
    if (isNaN(groupId)) {
      return res.status(400).send("Invalid group ID");
    }

    try {
      // Remove user from group members
      await db
        .delete(groupMembers)
        .where(
          and(
            eq(groupMembers.groupId, groupId),
            eq(groupMembers.userId, req.user.id)
          )
        );

      res.json({ message: "Successfully left group" });
    } catch (error) {
      console.error('Error leaving group:', error);
      res.status(500).send("Error leaving group");
    }
  });

  // Update group description
  app.put("/api/groups/:id", async (req, res) => {
    if (!req.user) {
      return res.status(401).send("Not authenticated");
    }

    const groupId = parseInt(req.params.id);
    if (isNaN(groupId)) {
      return res.status(400).send("Invalid group ID");
    }

    const { description } = req.body;
    if (typeof description !== "string") {
      return res.status(400).send("Description must be a string");
    }

    try {
      // Check if user is an admin
      const membership = await db.query.groupMembers.findFirst({
        where: and(
          eq(groupMembers.groupId, groupId),
          eq(groupMembers.userId, req.user.id),
          eq(groupMembers.role, 'admin')
        ),
      });

      if (!membership) {
        return res.status(403).send("Only admins can update group details");
      }

      const [updatedGroup] = await db
        .update(groups)
        .set({ description })
        .where(eq(groups.id, groupId))
        .returning();

      res.json(updatedGroup);
    } catch (error) {
      console.error('Error updating group:', error);
      res.status(500).send("Error updating group");
    }
  });

  // Delete group
  app.delete("/api/groups/:id", async (req, res) => {
    if (!req.user) {
      return res.status(401).send("Not authenticated");
    }

    const groupId = parseInt(req.params.id);
    if (isNaN(groupId)) {
      return res.status(400).send("Invalid group ID");
    }

    try {
      // Check if group exists and user is creator
      const group = await db.query.groups.findFirst({
        where: eq(groups.id, groupId),
      });

      if (!group) {
        return res.status(404).send("Group not found");
      }

      if (group.createdBy !== req.user.id) {
        return res.status(403).send("Only group creator can delete the group");
      }

      // Get all posts in the group
      const groupPosts = await db.query.posts.findMany({
        where: eq(posts.groupId, groupId),
      });

      // Delete all related records in the correct order to handle foreign key constraints
      for (const post of groupPosts) {
        // First delete post embeddings
        await db.delete(postEmbeddings).where(eq(postEmbeddings.postId, post.id));
        // Then delete post likes
        await db.delete(postLikes).where(eq(postLikes.postId, post.id));
        // Then delete post mentions
        await db.delete(postMentions).where(eq(postMentions.postId, post.id));
      }

      // Now delete all comments and their likes
      const postIds = groupPosts.map(p => p.id);
      if (postIds.length > 0) {
        const groupComments = await db.query.comments.findMany({
          where: inArray(comments.postId, postIds),
        });

        // Delete comment likes first
        for (const comment of groupComments) {
          await db.delete(commentLikes).where(eq(commentLikes.commentId, comment.id));
        }

        // Then delete comments
        await db.delete(comments).where(inArray(comments.postId, postIds));
      }

      // Delete group members
      await db.delete(groupMembers).where(eq(groupMembers.groupId, groupId));

      // Delete posts
      await db.delete(posts).where(eq(posts.groupId, groupId));

      // Finally delete the group
      await db.delete(groups).where(eq(groups.id, groupId));

      res.json({ message: "Group deleted successfully" });
    } catch (error) {
      console.error('Error deleting group:', error);
      res.status(500).send("Error deleting group");
    }
  });

  // Get group posts
  app.get("/api/groups/:id/posts", async (req, res) => {
    const groupId = parseInt(req.params.id);
    if(isNaN(groupId)) {      return res.status(400).send("Invalid group ID");
    }

    try {
      const groupPosts = await db.query.posts.findMany({
        where: eq(posts.groupId, groupId),
        with: {
          user: {
            columns: {
              id: true,
              username: true,
              avatar: true,
            }
          },
          mentions: {
            with: {
              mentionedUser: {
                columns: {
                  id: true,
                  username: true,
                  avatar: true,
                }
              }
            }
          },
          likes: true,
        },
        orderBy: desc(posts.createdAt),
      });

      // Transform posts to include like count and liked status
      const postsWithLikeInfo = groupPosts.map(post => ({
        ...post,
        likeCount: post.likes.length,
        liked: req.user ? post.likes.some(like => like.userId === req.user.id) : false,
        likes: undefined, // Remove the likes array from the response
      }));

      res.json(postsWithLikeInfo);
    } catch (error) {
      console.error('Error fetching group posts:', error);
      res.status(500).send("Error fetching group posts");
    }
  });

  // Get matched users in group
  app.get("/api/groups/:id/matches", async (req, res) => {
    if (!req.user) {
      return res.status(401).send("Not authenticated");
    }

    const groupId = parseInt(req.params.id);
    if (isNaN(groupId)) {
      return res.status(400).send("Invalid group ID");
    }

    try {
      // Get current user's looking for and bio embeddings
      const userEmbed = await db.query.userEmbeddings.findFirst({
        where: eq(userEmbeddings.userId, req.user.id),
      });

      if (!userEmbed || (!userEmbed.lookingForEmbedding && !userEmbed.bioEmbedding)) {
        return res.status(40).send("User embeddings not found");
      }

      // Get all group members' embeddings
      const groupMembersWithEmbeddings = await db.query.groupMembers.findMany({
        where: eq(groupMembers.groupId, groupId),
        with: {
          user: {
            columns: {
              id: true,
              username: true,
              avatar: true,
              bio: true,
              lookingFor: true,
            },
            with: {
              embeddings: true,
            }
          }
        }
      });

      // Calculate similarity scores
      const membersWithScores = groupMembersWithEmbeddings
        .filter(member => member.userId !== req.user.id)
        .map(member => {
          let score = 0;
          const memberEmbed = member.user.embeddings;

          if (memberEmbed && userEmbed.lookingForEmbedding && memberEmbed.bioEmbedding) {
            score += calculateCosineSimilarity(
              userEmbed.lookingForEmbedding as number[],
              memberEmbed.bioEmbedding as number[]
            );
          }

          if (memberEmbed && userEmbed.bioEmbedding && memberEmbed.lookingForEmbedding) {
            score += calculateCosineSimilarity(
              userEmbed.bioEmbedding as number[],
              memberEmbed.lookingForEmbedding as number[]
            );
          }

          return {
            ...member.user,
            score: score / 2, // Average of both similarity scores
            embeddings: undefined, // Remove embeddings from response
          };
        })
        .sort((a, b) => b.score - a.score);

      res.json(membersWithScores);
    } catch (error) {
      console.error('Error fetching group matches:', error);
      res.status(500).send("Error fetching group matches");
    }
  });

  // Create post endpoint
  app.post("/api/posts", async (req, res) => {
    if (!req.user) {
      return res.status(401).send("Not authenticated");
    }

    const { content, groupId, privacy = "public" } = req.body;

    if (!content || typeof content !== "string") {
      return res.status(400).send("Content is required");
    }

    try {
      // If posting to a group, verify membership
      if (groupId) {
        const member = await db.query.groupMembers.findFirst({
          where: and(
            eq(groupMembers.groupId, groupId),
            eq(groupMembers.userId, req.user.id)
          ),
        });

        if (!member) {
          return res.status(403).send("You must be a member of the group to post");
        }
      }

      // Get the highest manual order value for ordering
      const [highestOrder] = await db
        .select({ maxOrder: sql<number>`COALESCE(MAX(manual_order), 0)` })
        .from(posts);

      // Create the post
      const [newPost] = await db
        .insert(posts)
        .values({
          content,
          userId: req.user.id,
          groupId: groupId || null,
          privacy: groupId ? "public" : privacy,
          manualOrder: highestOrder.maxOrder + 1000,
          status: "none",
        })
        .returning();

      // Process mentions if content is not empty
      if (content) {
        const mentionedUsernames = content.match(/@(\w+)/g)?.map(mention => mention.slice(1)) || [];
        if (mentionedUsernames.length > 0) {
          const mentionedUsers = await db
            .select()
            .from(users)
            .where(inArray(users.username, mentionedUsernames));

          if (mentionedUsers.length > 0) {
            await db.insert(postMentions).values(
              mentionedUsers.map((user) => ({
                postId: newPost.id,
                mentionedUserId: user.id,
              }))
            );
          }
        }

        // Generate embedding
        try {
          const embedding = await generateEmbedding(content);
          await db.insert(postEmbeddings).values({
            postId: newPost.id,
            embedding,
          });
        } catch (embeddingError) {
          console.error('Error generating post embedding:', embeddingError);
        }
      }

      // Get full post data
      const createdPost = await db.query.posts.findFirst({
        where: eq(posts.id, newPost.id),
        with: {
          user: {
            columns: {
              id: true,
              username: true,
              avatar: true,
            }
          },
          mentions: {
            with: {
              mentionedUser: {
                columns: {
                  id: true,
                  username: true,
                  avatar: true,
                }
              }
            }
          },
          likes: true,
        }
      });

      if (!createdPost) {
        throw new Error("Failed to fetch created post");
      }

      // Transform the response
      const transformedPost = {
        ...createdPost,
        likeCount: createdPost.likes.length,
        liked: createdPost.likes.some(like => like.userId === req.user?.id),
        likes: undefined, // Remove likes array from response
      };

      res.json(transformedPost);
    } catch (error) {
      console.error('Error creating post:', error);
      res.status(500).send("Error creating post");
    }
  });

  app.get("/api/posts", async (req, res) => {
    const userId = req.user?.id;
    const showStatusOnly = req.query.status === 'true';
    const groupId = parseInt(req.query.groupId as string || ""); //Added groupId parameter handling

    try {
      const allPosts = await db.query.posts.findMany({
        where: showStatusOnly ?
          not(eq(posts.status, 'none')) : undefined,
        with: {
          user: {
            columns: {
              id: true,
              username: true,
              avatar: true,
            },
          },
          mentions: {
            with: {
              mentionedUser: {
                columns: {
                  id: true,
                  username: true,
                  avatar: true,
                }
              }
            }
          },
          likes: true,
        },
        orderBy: desc(posts.createdAt),
      });

      // Add liked status for current user
      const postsWithLikeInfo = allPosts.map(post => ({
        ...post,
        likeCount: post.likes.length,
        liked: userId ? post.likes.some(like => like.userId === userId) : false,
        likes: undefined, // Remove the likes array from the response
      }));

      res.json(postsWithLikeInfo);
    } catch (error) {
      console.error('Error fetching posts:', error);
      res.status(500).json({ message: "Error fetching posts" });
    }
  });

  app.get("/api/posts/user/:id", async (req, res) => {
    const userId = parseInt(req.params.id);
    const currentUserId = req.user?.id;
    const showStatusOnly = req.query.status === 'true';

    if (isNaN(userId)) {
      return res.status(400).send("Invalid user ID");
    }

    try {
      // First get posts created by the user
      const userPosts = await db.query.posts.findMany({
        where: and(
          eq(posts.userId, userId),
          showStatusOnly ? not(eq(posts.status, 'none')) : undefined
        ),
        with: {
          user: {
            columns: {
              id: true,
              username: true,
              avatar: true,
            },
          },
          mentions: {
            with: {
              mentionedUser: {
                columns: {
                  id: true,
                  username: true,
                  avatar: true,
                }
              }
            }
          },
          likes: true,
        },
      });

      // Then get posts where the user is mentioned
      const mentionedPosts = await db.query.postMentions.findMany({
        where: eq(postMentions.mentionedUserId, userId),
        with: {
          post: {
            with: {
              user: {
                columns: {
                  id: true,
                  username: true,
                  avatar: true,
                }
              },
              mentions: {
                with: {
                  mentionedUser: {
                    columns: {
                      id: true,
                      username: true,
                      avatar: true,
                    }
                  }
                }
              },
              likes: true,
            }
          }
        }
      });

      // Filter mentioned posts if showStatusOnly is true
      const filteredMentionedPosts = showStatusOnly
        ? mentionedPosts.filter(mention => mention.post.status !== 'none')
        : mentionedPosts;

      // Combine and sort posts
      const allPosts = [
        ...userPosts.map(post => ({
          ...post,
          likeCount: post.likes.length,
          liked: currentUserId ? post.likes.some(like => like.userId === currentUserId) : false,
          likes: undefined,
        })),
        ...filteredMentionedPosts.map(mention => ({
          ...mention.post,
          likeCount: mention.post.likes.length,
          liked: currentUserId ? mention.post.likes.some(like => like.userId === currentUserId) : false,
          likes: undefined,
        }))
      ].sort((a, b) =>
        (b.createdAt?.getTime() || 0) - (a.createdAt?.getTime() || 0)
      );

      // Remove duplicates (in case a user is both creator and mentioned)
      const uniquePosts = Array.from(
        new Map(allPosts.map(post => [post.id, post])).values()
      );

      res.json(uniquePosts);
    } catch (error) {
      console.error('Error fetching user posts:', error);
      res.status(500).json({ message: "Error fetching user posts" });
    }
  });

  app.get("/api/posts/:id", async (req, res) => {
    const postId = parseInt(req.params.id);
    if (isNaN(postId)) {
      return res.status(400).send("Invalid post ID");
    }

    try {
      const post = await db.query.posts.findFirst({
        where: eq(posts.id, postId),
        with: {
          user: {
            columns: {
              id: true,
              username: true,
              avatar: true,
            }
          },
          mentions: {
            with: {
              mentionedUser: {
                columns: {
                  id: true,
                  username: true,
                  avatar: true,
                }
              }
            }
          },
          likes: true,
        },
      });

      if (!post) {
        return res.status(404).send("Post not found");
      }

      const postWithLikeInfo = {
        ...post,
        likeCount: post.likes.length,
        liked: req.user ? post.likes.some(like => like.userId === req.user.id) : false,
        likes: undefined, // Remove the likes array from the response
      };

      res.json(postWithLikeInfo);
    } catch (error) {
      console.error('Error fetching post:', error);
      res.status(500).json({ message: "Error fetching post" });
    }
  });

  app.put("/api/posts/:id", async (req, res) => {
    if (!req.user) {
      return res.status(401).send("Not authenticated");
    }

    const postId = parseInt(req.params.id);
    if (isNaN(postId)) {
      return res.status(400).send("Invalid post ID");
    }

    const { content, privacy } = req.body;
    if (!content || typeof content !== "string") {
      return res.status(400).send("Content must be a string");
    }

    // Verify post exists and belongs to user
    const post = await db.query.posts.findFirst({
      where: eq(posts.id, postId),
    });

    if (!post) {
      return res.status(404).send("Post not found");
    }

    if (post.userId !== req.user.id) {
      return res.status(403).send("Not authorized to edit this post");
    }

    // Extract mentions from content using regex
    const mentionMatches = content.match(/@(\w+)/g) || [];
    const mentionedUsernames = mentionMatches.map(match => match.substring(1));

    // Find mentioned users
    const mentionedUsers = await db.query.users.findMany({
      where: inArray(users.username, mentionedUsernames),
    });

    // Update post
    const [updatedPost] = await db
      .update(posts)
      .set({ 
        content,
        privacy: privacy || post.privacy // Keep existing privacy if not provided
      })
      .where(eq(posts.id, postId))
      .returning();

    // Delete existing mentions
    await db
      .delete(postMentions)
      .where(eq(postMentions.postId, postId));

    // Create new mentions
    if (mentionedUsers.length > 0) {
      await db.insert(postMentions).values(
        mentionedUsers.map(user => ({
          postId,
          mentionedUserId: user.id,
        }))
      );
    }

    // Return post with updated mentions
    const postWithMentions = await db.query.posts.findFirst({
      where: eq(posts.id, postId),
      with: {
        user: {
          columns: {
            id: true,
            username: true,
            avatar: true,
          },
        },
        mentions: {
          with: {
            mentionedUser: {
              columns: {
                id: true,
                username: true,
                avatar: true,
              }
            }
          }
        },
        likes: true,
      },
    });

    // Transform response to include like count and liked status
    const response = {
      ...postWithMentions,
      likeCount: postWithMentions?.likes.length || 0,
      liked: postWithMentions?.likes.some(like => like.userId === req.user?.id) || false,
      likes: undefined, // Remove the likes array from the response
    };

    res.json(response);
  });

  app.delete("/api/posts/:id", async (req, res) => {
    if (!req.user) {
      return res.status(401).send("Not authenticated");
    }

    const postId = parseInt(req.params.id);
    if (isNaN(postId)) {
      return res.status(400).send("Invalid post ID");
    }

    try {
      // Verify post exists and belongs to user
      const post = await db.query.posts.findFirst({
        where: eq(posts.id, postId),
      });

      if (!post) {
        return res.status(404).send("Post not found");
      }

      if (post.userId !== req.user.id) {
        return res.status(403).send("Not authorized to delete this post");
      }

      // Delete all related data in the correct order to handle foreign key constraints

      // 1. Delete comment likes
      await db.execute(sql`
        DELETE FROM comment_likes
        WHERE comment_id IN (
          SELECT id FROM comments WHERE post_id = ${postId}
        )
      `);

      // 2. Delete comments
      await db.execute(sql`
        DELETE FROM comments WHERE post_id = ${postId}
      `);

      // 3. Delete post likes
      await db.execute(sql`
        DELETE FROM post_likes WHERE post_id = ${postId}
      `);

      // 4. Delete post mentions
      await db.execute(sql`
        DELETE FROM post_mentions WHERE post_id = ${postId}
      `);

      // 5. Finally delete the post
      await db.execute(sql`
        DELETE FROM posts WHERE id = ${postId}
      `);

      res.json({ message: "Post deleted successfully" });
    } catch (error) {
      console.error('Error deleting post:', error);
      res.status(500).json({ message: "Error deleting post", error: error.message });
    }
  });

  const POST_SIMILARITY_THRESHOLD = 0; // Show all posts with their scores for debugging

  app.get("/api/posts/:id/related", async (req, res) => {
    try {
      const postId = parseInt(req.params.id);
      if (isNaN(postId)) {
        return res.status(400).json({ message: "Invalid post ID" });
      }

      // Get manually related posts
      const manuallyRelated = await db.query.relatedPosts.findMany({
        where: eq(relatedPosts.postId, postId),
        with: {
          relatedPost: {
            with: {
              user: true,
              group: true
            }
          }
        }
      });

      // Get semantically similar posts using embeddings
      const [sourcePost, allPosts] = await Promise.all([
        db.query.posts.findFirst({
          where: eq(posts.id, postId),
          with: { embedding: true }
        }),
        db.query.posts.findMany({
          where: not(eq(posts.id, postId)),
          with: {
            embedding: true,
            user: true,
            group: true
          }
        })
      ]);

      if (!sourcePost || !sourcePost.embedding) {
        return res.json([]);
      }

      // Calculate similarities for posts that have embeddings
      const similarPosts = allPosts
        .filter(post => post.embedding)
        .map(post => ({
          ...post,
          similarity: calculateCosineSimilarity(
            sourcePost.embedding!.embedding as number[],
            post.embedding!.embedding as number[]
          )
        }))
        .sort((a, b) => b.similarity - a.similarity)
        .slice(0, 5);

      // Combine and format response
      const combinedResults = [
        ...manuallyRelated.map(rel => ({
          ...rel.relatedPost,
          similarity: 1 // Manually related posts get highest similarity
        })),
        ...similarPosts.filter(post => 
          !manuallyRelated.some(manual => manual.relatedPost.id === post.id)
        )
      ];

      res.json(combinedResults);
    } catch (error) {
      console.error('Error fetching related posts:', error);
      res.status(500).json({ message: "Error fetching related posts" });
    }
  });

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
        user: {
          columns: {
            id: true,
            username: true,
            avatar: true,
          }
        },
        friend: {
          columns: {
            id: true,
            username: true,
            avatar: true,
          }
        },
      },
    });

    res.json(userFriends);
  });

  app.post("/api/friends/request", async (req, res) => {
    if (!req.user) {
      return res.status(401).json({ message: "Not authenticated" });
    }

    const { friendId } = req.body;
    if (!friendId) {
      return res.status(400).json({ message: "Friend ID is required" });
    }

    try {
      // Check if friend exists
      const friend = await db.query.users.findFirst({
        where: eq(users.id, friendId),
      });

      if (!friend) {
        return res.status(404).json({ message: "User not found" });
      }

      // Check for existing request
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
        return res.status(400).json({ message: "Friend request already exists" });
      }

      // Create new request
      const [newRequest] = await db
        .insert(friends)
        .values({
          userId: req.user.id,
          friendId: friendId,
          status: "pending",
        })
        .returning();


      res.json(newRequest);
    } catch (error) {
      console.error('Error creating friend request:', error);
      res.status(500).json({ message: "Error creating friend request" });
    }
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

  app.post("/api/friends/dismiss", async (req, res) => {
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

    // Delete the friend request
    await db.delete(friends).where(eq(friends.id, requestId));

    res.json({ message: "Friend request dismissed" });
  });

  app.post("/api/friends/remove", async (req, res) => {
    if (!req.user) {
      return res.status(401).send("Not authenticated");
    }

    const { friendshipId } = req.body;
    if (!friendshipId) {
      return res.status(400).send("Friendship ID is required");
    }

    try {
      const friendship = await db.query.friends.findFirst({
        where: eq(friends.id, friendshipId),
      });

      if (!friendship) {
        return res.status(404).send("Friendship not found");
      }

      // Check if the user is part of this friendship
      if (friendship.userId !== req.user.id && friendship.friendId !== req.user.id) {
        return res.status(403).send("Not authorized to remove this friendship");
      }

      // Delete the friendship
      await db
        .delete(friends)
        .where(eq(friends.id, friendshipId));

      res.json({ message: "Friendship removed successfully" });
    } catch (error) {
      console.error('Error removing friendship:', error);
      res.status(500).send("Error removing friendship");
    }
  });

  // Add new group members endpoint
  app.get("/api/groups/:id/members", async (req, res) => {
    const groupId = parseInt(req.params.id);
    if (isNaN(groupId)) {
      return res.status(400).send("Invalid group ID");
    }

    try {
      const members = await db.query.groupMembers.findMany({
        where: eq(groupMembers.groupId, groupId),
        with: {
          user: {
            columns: {
              id: true,
              username: true,
              avatar: true,
            }
          }
        },
        orderBy: desc(groupMembers.joinedAt),
      });

      // Map to just return user info
      const formattedMembers = members.map(member => ({
        ...member.user,
        role: member.role,
        joinedAt: member.joinedAt,
      }));

      res.json(formattedMembers);
    } catch (error) {
      console.error('Error fetching group members:', error);
      res.status(500).send("Error fetching group members");
    }
  });

  // Add star/unstar post endpoint
  app.post("/api/posts/:id/star", async (req, res) => {
    if (!req.user) {
      return res.status(401).send("Not authenticated");
    }

    const postId = parseInt(req.params.id);
    if (isNaN(postId)) {
      return res.status(400).send("Invalid post ID");
    }

    try {
      // Check if post exists
      const post = await db.query.posts.findFirst({
        where: eq(posts.id, postId),
      });

      if (!post) {
        return res.status(404).send("Post not found");
      }

      // Toggle starred status
      const [updatedPost] = await db
        .update(posts)
        .set({ starred: sql`NOT ${posts.starred}` })
        .where(eq(posts.id, postId))
        .returning();

      res.json({ starred: updatedPost.starred });
    } catch (error) {
      console.error('Error toggling star status:', error);
      res.status(500).send("Error toggling star status");
    }
  });

  // Add post follow/unfollow routes after the existing post routes
  app.post("/api/posts/:id/follow", async (req, res) => {
    if (!req.user) {
      return res.status(401).send("Not authenticated");
    }

    const postId = parseInt(req.params.id);
    if (isNaN(postId)) {
      return res.status(400).send("Invalid post ID");
    }

    try {
      // Check if post exists
      const post = await db.query.posts.findFirst({
        where: eq(posts.id, postId),
      });

      if (!post) {
        return res.status(404).send("Post not found");
      }

      // Check if already following
      const existingFollow = await db.query.postFollowers.findFirst({
        where: and(
          eq(postFollowers.postId, postId),
          eq(postFollowers.userId, req.user.id)
        ),
      });

      if (existingFollow) {
        // Unfollow
        await db
          .delete(postFollowers)
          .where(eq(postFollowers.id, existingFollow.id));
        res.json({ following: false });
      } else {
        // Follow
        await db.insert(postFollowers).values({
          postId,
          userId: req.user.id,
        });
        res.json({ following: true });
      }
    } catch (error) {
      console.error('Error following/unfollowing post:', error);
      res.status(500).send("Error following/unfollowing post");
    }
  });

  app.get("/api/posts/:id/following", async (req, res) => {
    if (!req.user) {
      return res.status(401).send("Not authenticated");
    }

    const postId = parseInt(req.params.id);
    if(isNaN(postId)) {
      return res.status(400).send("Invalid post ID");
    }

    try {
      const following = await db.query.postFollowers.findFirst({
        where: and(
          eq(postFollowers.postId, postId),
          eq(postFollowers.userId, req.user.id)
        ),
      });

      res.json({ following: !!following });
    } catch (error) {
      console.error('Error checking follow status:', error);
      res.status(500).send("Error checking follow status");
    }
  });

  // Add QR code routes

  app.get("/api/groups/:id/qr", async (req, res) => {
    const groupId = parseInt(req.params.id);
    if (isNaN(groupId)) {
      return res.status(400).send("Invalid group ID");
    }

    try {
      const group = await db.query.groups.findFirst({
        where: eq(groups.id, groupId),
      });

      if (!group) {
        return res.status(404).send("Group not found");
      }

      const url = `${req.protocol}://${req.get('host')}/groups/${groupId}`;
      const qrCode = await qr.toDataURL(url);
      res.json({ qrCode });
    } catch (error) {
      console.error('Error generating group QR code:', error);
      res.status(500).send("Error generating QR code");
    }
  });

  app.get("/api/posts/:id/qr", async (req, res) => {
    const postId = parseInt(req.params.id);
    if (isNaN(postId)) {
      return res.status(400).send("Invalid post ID");
    }

    try {
      const post = await db.query.posts.findFirst({
        where: eq(posts.id, postId),
      });

      if (!post) {
        return res.status(404).send("Post not found");
      }

      const url = `${req.protocol}://${req.get('host')}/post/${postId}`;
      const qrCode = await qr.toDataURL(url);
      res.json({ qrCode });
    } catch (error) {
      console.error('Error generating post QR code:', error);
      res.status(500).send("Error generating QR code");
    }
  });

  // Add related post
  app.post("/api/posts/:id/related", async (req, res) => {
    if (!req.user) {
      return res.status(401).json({ message: "Not authenticated" });
    }

    try {
      const postId = parseInt(req.params.id);
      const { relatedPostId } = req.body;

      if (isNaN(postId) || !relatedPostId) {
        return res.status(400).json({ message: "Invalid post IDs" });
      }

      // Verify both posts exist
      const [sourcePost, targetPost] = await Promise.all([
        db.query.posts.findFirst({ where: eq(posts.id, postId) }),
        db.query.posts.findFirst({ where: eq(posts.id, relatedPostId) })
      ]);

      if (!sourcePost || !targetPost) {
        return res.status(404).json({ message: "One or both posts not found" });
      }

      // Add the relationship
      await db.insert(relatedPosts).values({
        postId: postId,
        relatedPostId,
        createdBy: req.user.id
      });

      res.json({ message: "Related post added successfully" });
    } catch (error) {
      console.error('Error adding related post:', error);
      res.status(500).json({ message: "Error adding related post" });
    }
  });

  // Get related posts
  app.get("/api/posts/:id/related", async (req, res) => {
    try {
      const postId = parseInt(req.params.id);
      if (isNaN(postId)) {
        return res.status(400).json({ message: "Invalid post ID" });
      }

      // Get manually related posts
      const manuallyRelated = await db.query.relatedPosts.findMany({
        where: eq(relatedPosts.postId, postId),
        with: {
          relatedPost: {
            with: {
              user: true,
              group: true
            }
          }
        }
      });

      // Get semantically similar posts using embeddings
      const [sourcePost, allPosts] = await Promise.all([
        db.query.posts.findFirst({
          where: eq(posts.id, postId),
          with: { embedding: true }
        }),
        db.query.posts.findMany({
          where: not(eq(posts.id, postId)),
          with: {
            embedding: true,
            user: true,
            group: true
          }
        })
      ]);

      if (!sourcePost || !sourcePost.embedding) {
        return res.json([]);
      }

      // Calculate similarities for posts that have embeddings
      const similarPosts = allPosts
        .filter(post => post.embedding)
        .map(post => ({
          ...post,
          similarity: calculateCosineSimilarity(
            sourcePost.embedding!.embedding as number[],
            post.embedding!.embedding as number[]
          )
        }))
        .sort((a, b) => b.similarity - a.similarity)
        .slice(0, 5);

      // Combine and format response
      const combinedResults = [
        ...manuallyRelated.map(rel => ({
          ...rel.relatedPost,
          similarity: 1 // Manually related posts get highest similarity
        })),
        ...similarPosts.filter(post =>
          !manuallyRelated.some(manual => manual.relatedPost.id === post.id)
        )
      ];

      res.json(combinedResults);
    } catch (error) {
      console.error('Error fetching related posts:', error);
      res.status(500).json({ message: "Error fetching related posts" });
    }
  });

  // Add the PUT endpoint for updating post order
  app.put("/api/posts/:id/order", async (req, res) => {
    if (!req.user) {
      return res.status(401).send("Not authenticated");
    }

    const postId = parseInt(req.params.id);
    if (isNaN(postId)) {
      return res.status(400).send("Invalid post ID");
    }

    const { order } = req.body;
    if (typeof order !== "number") {
      return res.status(400).send("Order must be a number");
    }

    try {
      // Update the post's manual order
      const [updatedPost] = await db
        .update(posts)
        .set({ manualOrder: order })
        .where(eq(posts.id, postId))
        .returning();

      if (!updatedPost) {
        return res.status(404).send("Post not found");
      }

      res.json(updatedPost);
    } catch (error) {
      console.error('Error updating post order:', error);
      res.status(500).send("Error updating post order");
    }
  });

  function extractMentions(text: string): string[] {
    const mentions = text.match(/@(\w+)/g) || [];
    return mentions.map(mention => mention.substring(1));
  }
  // Add this new endpoint after the existing group routes
  app.put("/api/groups/:id", async (req, res) => {
    if (!req.user) {
      return res.status(401).send("Not authenticated");
    }

    const groupId = parseInt(req.params.id);
    if (isNaN(groupId)) {
      return res.status(400).send("Invalid group ID");
    }

    const { name } = req.body;
    if (!name || typeof name !== "string") {
      return res.status(400).send("Name is required");
    }

    try {
      // Check if user is an admin of the group
      const membership = await db.query.groupMembers.findFirst({
        where: and(
          eq(groupMembers.groupId, groupId),
          eq(groupMembers.userId, req.user.id),
          eq(groupMembers.role, 'admin')
        ),
      });

      if (!membership) {
        return res.status(403).send("Only group admins can rename the group");
      }

      // Update group name
      const [updatedGroup] = await db
        .update(groups)
        .set({ name })
        .where(eq(groups.id, groupId))
        .returning();

      res.json(updatedGroup);
    } catch (error) {
      console.error('Error updating group:', error);
      res.status(500).send("Error updating group");
    }
  });

  return httpServer;
}