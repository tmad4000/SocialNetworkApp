import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { useRoute } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { Loader2, Users, Pencil, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import PostCard from "@/components/post-card";
import CreatePost from "@/components/create-post";
import FriendRequest from "@/components/friend-request";
import { useUser } from "@/hooks/use-user";
import { useToast } from "@/hooks/use-toast";
import type { User, Post, Friend, PostMention } from "@db/schema";
import { Link } from "wouter";
import { useState, useEffect, useMemo } from "react";
import { SiLinkedin } from "react-icons/si";
import PostFilter from "@/components/ui/post-filter";

// ... rest of the types and component setup ...

export default function ProfilePage() {
  // ... other state and hooks ...

  const { data: posts, isLoading: postsLoading } = useQuery<(Post & {
    user: User;
    mentions: (PostMention & { mentionedUser: User })[];
    likeCount: number;
    liked: boolean;
  })[]>({
    queryKey: [`/api/posts/user/${params?.id}`],
    queryFn: async ({ queryKey }) => {
      const baseUrl = queryKey[0] as string;
      const url = new URL(baseUrl, window.location.origin);
      url.searchParams.set('status', showStatusOnly.toString());
      const res = await fetch(url, { credentials: 'include' });
      if (!res.ok) throw new Error('Failed to fetch posts');
      return res.json();
    }
  });

  const filteredPosts = useMemo(() => {
    if (!posts) return [];

    // If there's no search query, just return the posts (already filtered by status via API)
    if (!searchQuery.trim()) return posts;

    // If there is a search query, filter the already status-filtered posts
    const query = searchQuery.toLowerCase();
    return posts.filter(post => 
      post.content.toLowerCase().includes(query) ||
      post.mentions.some(mention => 
        mention.mentionedUser.username.toLowerCase().includes(query)
      )
    );
  }, [posts, searchQuery]);

  // ... rest of the component code ...

  return (
    <div className="max-w-4xl mx-auto">
      {/* ... other JSX ... */}

      <div className="space-y-6">
        <Separator className="my-8" />
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <h2 className="text-2xl font-semibold">Posts</h2>
          <div className="flex items-center gap-4 flex-wrap">
            <div className="relative w-64">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search posts..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
            <PostFilter 
              showStatusOnly={showStatusOnly} 
              onFilterChange={setShowStatusOnly}
            />
          </div>
        </div>

        <CreatePost
          targetUserId={!isOwnProfile ? user.id : undefined}
          onSuccess={() => {
            queryClient.invalidateQueries({ queryKey: [`/api/posts/user/${params?.id}`] });
          }}
        />

        <div className="space-y-6">
          {filteredPosts?.map((post) => (
            <PostCard key={post.id} post={post} />
          ))}
          {!filteredPosts?.length && (
            <p className="text-muted-foreground text-center py-8">
              {searchQuery ? "No posts found matching your search." : "No posts yet"}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}