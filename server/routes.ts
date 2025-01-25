import type { Express } from "express";
import { createServer, type Server } from "http";
import { setupAuth } from "./auth";
import { db } from "@db";
import { posts, users, friends, postMentions, postLikes, comments, commentLikes } from "@db/schema";
import { eq, desc, and, or, inArray, ilike, sql, not } from "drizzle-orm";

export function registerRoutes(app: Express): Server {
  setupAuth(app);

  // Add status update endpoint
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

    // Verify post exists and belongs to user
    const post = await db.query.posts.findFirst({
      where: eq(posts.id, postId),
    });

    if (!post) {
      return res.status(404).send("Post not found");
    }

    if (post.userId !== req.user.id) {
      return res.status(403).send("Not authorized to update this post");
    }

    const [updatedPost] = await db
      .update(posts)
      .set({ status })
      .where(eq(posts.id, postId))
      .returning();

    res.json(updatedPost);
  });

  // Add these endpoints after the status update endpoint
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

    if (existingLike) {
      // Unlike: remove the like
      await db
        .delete(postLikes)
        .where(eq(postLikes.id, existingLike.id));

      // Get updated like count
      const likeCount = await db
        .select({ count: sql<number>`count(*)` })
        .from(postLikes)
        .where(eq(postLikes.postId, postId));

      res.json({ liked: false, likeCount: likeCount[0].count });
    } else {
      // Like: add new like
      await db.insert(postLikes).values({
        postId,
        userId: req.user.id,
      });

      // Get updated like count
      const likeCount = await db
        .select({ count: sql<number>`count(*)` })
        .from(postLikes)
        .where(eq(postLikes.postId, postId));

      res.json({ liked: true, likeCount: likeCount[0].count });
    }
  });

  // Add this endpoint after the existing like endpoint
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

  // Add comment likes endpoints
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

  // Add this endpoint after the existing comment likes endpoints
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

  // Add this endpoint after the existing comments endpoints
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

  // Update the get comments endpoint to include likes
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


  // Add comments endpoints with proper error handling
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


  // Add new Looking For update endpoint
  app.put("/api/user/looking-for", async (req, res) => {
    if (!req.user) {
      return res.status(401).send("Not authenticated");
    }

    const { lookingFor } = req.body;
    if (typeof lookingFor !== "string") {
      return res.status(400).send("Looking for must be a string");
    }

    const [updatedUser] = await db
      .update(users)
      .set({ lookingFor })
      .where(eq(users.id, req.user.id))
      .returning();

    res.json(updatedUser);
  });

  // Add new LinkedIn URL update endpoint
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

  // Update user profile endpoint to include linkedinUrl and lookingFor
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

  // Search users for mentions
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

  // Get all users for mentions
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

  // Update the post route to properly handle mentions with type safety
  app.post("/api/posts", async (req, res) => {
    if (!req.user) {
      return res.status(401).send("Not authenticated");
    }

    const { content, targetUserId } = req.body;
    if (!content) {
      return res.status(400).send("Content is required");
    }

    try {
      // If targetUserId is provided, verify it exists
      if (targetUserId) {
        const targetUser = await db.query.users.findFirst({
          where: eq(users.id, targetUserId),
        });

        if (!targetUser) {
          return res.status(400).send("Target user not found");
        }
      }

      // Extract mentions from content using regex
      const mentionMatches = content.match(/@(\w+)/g) || [];
      const mentionedUsernames = mentionMatches.map(match => match.substring(1));

      // Find mentioned users
      const mentionedUsers = await db.query.users.findMany({
        where: inArray(users.username, mentionedUsernames),
      });

      // Create post with status
      const [newPost] = await db
        .insert(posts)
        .values({
          content,
          userId: req.user.id,
          status: 'none', // Default status
        })
        .returning();

      // Create mentions
      if (mentionedUsers.length > 0 || targetUserId) {
        const mentionsToCreate = [
          ...mentionedUsers.map(user => ({
            postId: newPost.id,
            mentionedUserId: user.id,
          }))
        ];

        // If posting on someone's timeline, add them as a mention
        if (targetUserId && targetUserId !== req.user.id) {
          mentionsToCreate.push({
            postId: newPost.id,
            mentionedUserId: targetUserId,
          });
        }

        if (mentionsToCreate.length > 0) {
          await db.insert(postMentions).values(mentionsToCreate);
        }
      }

      // Return post with mentions
      const postWithMentions = await db.query.posts.findFirst({
        where: eq(posts.id, newPost.id),
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
          }
        },
      });

      res.json(postWithMentions);
    } catch (error) {
      console.error('Error creating post:', error);
      res.status(500).json({ message: "Error creating post" });
    }
  });

  // Update the posts GET endpoint to support status filtering
  app.get("/api/posts", async (req, res) => {
    const userId = req.user?.id;
    const showStatusOnly = req.query.status === 'true';

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

  // Update the user posts endpoint to support status filtering
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

  // Add new endpoint for dismissing friend requests
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

  const httpServer = createServer(app);
  return httpServer;
}