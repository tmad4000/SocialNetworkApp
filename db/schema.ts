import { pgTable, text, serial, integer, boolean, timestamp, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { relations } from "drizzle-orm";

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").unique().notNull(),
  password: text("password").notNull(),
  avatar: text("avatar"),
  bio: text("bio"),
  linkedinUrl: text("linkedin_url"),
  lookingFor: text("looking_for"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const userEmbeddings = pgTable("user_embeddings", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id).notNull(),
  bioEmbedding: jsonb("bio_embedding"),
  lookingForEmbedding: jsonb("looking_for_embedding"),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const posts = pgTable("posts", {
  id: serial("id").primaryKey(),
  content: text("content").notNull(),
  userId: integer("user_id").references(() => users.id).notNull(),
  status: text("status").notNull().default('none'),
  createdAt: timestamp("created_at").defaultNow(),
});

// New table for post embeddings
export const postEmbeddings = pgTable("post_embeddings", {
  id: serial("id").primaryKey(),
  postId: integer("post_id").references(() => posts.id).notNull().unique(), // Add unique constraint
  embedding: jsonb("embedding").notNull(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const comments = pgTable("comments", {
  id: serial("id").primaryKey(),
  content: text("content").notNull(),
  postId: integer("post_id").references(() => posts.id).notNull(),
  userId: integer("user_id").references(() => users.id).notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const commentLikes = pgTable("comment_likes", {
  id: serial("id").primaryKey(),
  commentId: integer("comment_id").references(() => comments.id).notNull(),
  userId: integer("user_id").references(() => users.id).notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const postLikes = pgTable("post_likes", {
  id: serial("id").primaryKey(),
  postId: integer("post_id").references(() => posts.id).notNull(),
  userId: integer("user_id").references(() => users.id).notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const postMentions = pgTable("post_mentions", {
  id: serial("id").primaryKey(),
  postId: integer("post_id").references(() => posts.id).notNull(),
  mentionedUserId: integer("mentioned_user_id").references(() => users.id).notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const friends = pgTable("friends", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id).notNull(),
  friendId: integer("friend_id").references(() => users.id).notNull(),
  status: text("status").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const usersRelations = relations(users, ({ many, one }) => ({
  posts: many(posts),
  comments: many(comments),
  commentLikes: many(commentLikes),
  likes: many(postLikes),
  mentions: many(postMentions, { relationName: "mentionedIn" }),
  sentFriendRequests: many(friends, { relationName: "sentFriendRequests" }),
  receivedFriendRequests: many(friends, { relationName: "receivedFriendRequests" }),
  embeddings: one(userEmbeddings),
}));

export const postsRelations = relations(posts, ({ one, many }) => ({
  user: one(users, {
    fields: [posts.userId],
    references: [users.id],
  }),
  comments: many(comments),
  mentions: many(postMentions),
  likes: many(postLikes),
  embedding: one(postEmbeddings), // Add relation to embedding
}));

export const commentsRelations = relations(comments, ({ one, many }) => ({
  post: one(posts, {
    fields: [comments.postId],
    references: [posts.id],
  }),
  user: one(users, {
    fields: [comments.userId],
    references: [users.id],
  }),
  likes: many(commentLikes),
}));

export const commentLikesRelations = relations(commentLikes, ({ one }) => ({
  comment: one(comments, {
    fields: [commentLikes.commentId],
    references: [comments.id],
  }),
  user: one(users, {
    fields: [commentLikes.userId],
    references: [users.id],
  }),
}));

export const postLikesRelations = relations(postLikes, ({ one }) => ({
  post: one(posts, {
    fields: [postLikes.postId],
    references: [posts.id],
  }),
  user: one(users, {
    fields: [postLikes.userId],
    references: [users.id],
  }),
}));

export const postMentionsRelations = relations(postMentions, ({ one }) => ({
  post: one(posts, {
    fields: [postMentions.postId],
    references: [posts.id],
  }),
  mentionedUser: one(users, {
    fields: [postMentions.mentionedUserId],
    references: [users.id],
    relationName: "mentionedIn",
  }),
}));

export const friendsRelations = relations(friends, ({ one }) => ({
  user: one(users, {
    fields: [friends.userId],
    references: [users.id],
    relationName: "sentFriendRequests",
  }),
  friend: one(users, {
    fields: [friends.friendId],
    references: [users.id],
    relationName: "receivedFriendRequests",
  }),
}));

export const userEmbeddingsRelations = relations(userEmbeddings, ({ one }) => ({
  user: one(users, {
    fields: [userEmbeddings.userId],
    references: [users.id],
  }),
}));

export const postEmbeddingsRelations = relations(postEmbeddings, ({ one }) => ({
  post: one(posts, {
    fields: [postEmbeddings.postId],
    references: [posts.id],
  }),
}));

export const insertUserSchema = createInsertSchema(users);
export const selectUserSchema = createSelectSchema(users);
export type NewUser = typeof users.$inferInsert;
export type User = typeof users.$inferSelect;

export const insertPostSchema = createInsertSchema(posts);
export const selectPostSchema = createSelectSchema(posts);
export type Post = typeof posts.$inferSelect;
export type NewPost = typeof posts.$inferInsert;

export const insertCommentSchema = createInsertSchema(comments);
export const selectCommentSchema = createSelectSchema(comments);
export type Comment = typeof comments.$inferSelect;
export type NewComment = typeof comments.$inferInsert;

export const insertCommentLikeSchema = createInsertSchema(commentLikes);
export const selectCommentLikeSchema = createSelectSchema(commentLikes);
export type CommentLike = typeof commentLikes.$inferSelect;
export type NewCommentLike = typeof commentLikes.$inferInsert;

export const insertPostLikeSchema = createInsertSchema(postLikes);
export const selectPostLikeSchema = createSelectSchema(postLikes);
export type PostLike = typeof postLikes.$inferSelect;
export type NewPostLike = typeof postLikes.$inferInsert;

export const insertPostMentionSchema = createInsertSchema(postMentions);
export const selectPostMentionSchema = createSelectSchema(postMentions);
export type PostMention = typeof postMentions.$inferSelect;
export type NewPostMention = typeof postMentions.$inferInsert;

export const insertFriendSchema = createInsertSchema(friends);
export const selectFriendSchema = createSelectSchema(friends);
export type Friend = typeof friends.$inferSelect;
export type NewFriend = typeof friends.$inferInsert;

export const insertUserEmbeddingSchema = createInsertSchema(userEmbeddings);
export const selectUserEmbeddingSchema = createSelectSchema(userEmbeddings);
export type UserEmbedding = typeof userEmbeddings.$inferSelect;
export type NewUserEmbedding = typeof userEmbeddings.$inferInsert;

export const insertPostEmbeddingSchema = createInsertSchema(postEmbeddings);
export const selectPostEmbeddingSchema = createSelectSchema(postEmbeddings);
export type PostEmbedding = typeof postEmbeddings.$inferSelect;
export type NewPostEmbedding = typeof postEmbeddings.$inferInsert;