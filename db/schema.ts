import { pgTable, text, serial, integer, boolean, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { relations } from "drizzle-orm";

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").unique().notNull(),
  password: text("password").notNull(),
  avatar: text("avatar"),
  bio: text("bio"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const posts = pgTable("posts", {
  id: serial("id").primaryKey(),
  content: text("content").notNull(),
  userId: integer("user_id").references(() => users.id).notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const friends = pgTable("friends", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id).notNull(),
  friendId: integer("friend_id").references(() => users.id).notNull(),
  status: text("status").notNull(), // 'pending' | 'accepted'
  createdAt: timestamp("created_at").defaultNow(),
});

export const usersRelations = relations(users, ({ many }) => ({
  posts: many(posts),
  sentFriendRequests: many(friends, { relationName: "sentFriendRequests" }),
  receivedFriendRequests: many(friends, { relationName: "receivedFriendRequests" }),
}));

export const postsRelations = relations(posts, ({ one }) => ({
  user: one(users, {
    fields: [posts.userId],
    references: [users.id],
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

export const insertUserSchema = createInsertSchema(users);
export const selectUserSchema = createSelectSchema(users);
export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;

export const insertPostSchema = createInsertSchema(posts);
export const selectPostSchema = createSelectSchema(posts);
export type Post = typeof posts.$inferSelect;
export type NewPost = typeof posts.$inferInsert;

export const insertFriendSchema = createInsertSchema(friends);
export const selectFriendSchema = createSelectSchema(friends);
export type Friend = typeof friends.$inferSelect;
export type NewFriend = typeof friends.$inferInsert;
