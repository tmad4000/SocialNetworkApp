import { useState, useMemo, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import PostCard from "@/components/post-card";
import PostFilter from "@/components/ui/post-filter";
import { Input } from "@/components/ui/input";
import { Search, Loader2 } from "lucide-react";
import type { Post, User, PostMention, Group } from "@db/schema";
import type { Status } from "@/components/ui/status-pill";
import { useLocation } from "wouter";

interface PostFeedProps {
  userId?: number;
  groupId?: number;
  searchQuery?: string;
  showStatusOnly?: boolean;
  showStarredOnly?: boolean;
  selectedStatuses?: Status[];
}

type PostWithDetails = Post & {
  user: User;
  mentions: (PostMention & { mentionedUser: User })[];
  group?: Group;
  likeCount: number;
  liked: boolean;
  starred: boolean;
};

const STATUSES: Status[] = ['none', 'not acknowledged', 'acknowledged', 'in progress', 'done'];

export default function PostFeed({ 
  userId, 
  groupId,
  searchQuery = "",
  showStatusOnly = false,
  showStarredOnly = false,
  selectedStatuses = STATUSES.filter(status => status !== 'none')
}: PostFeedProps) {
  const [location] = useLocation();

  const { data: posts, isLoading } = useQuery<PostWithDetails[]>({
    queryKey: [groupId ? `/api/groups/${groupId}/posts` : userId ? `/api/posts/user/${userId}` : "/api/posts"],
    staleTime: 5000, // Consider data fresh for 5 seconds
  });

  const filteredPosts = useMemo(() => {
    if (!posts) return [];

    // Always sort by createdAt first, regardless of other filters
    let sorted = [...posts].sort((a, b) => 
      new Date(b.createdAt!).getTime() - new Date(a.createdAt!).getTime()
    );

    // Apply starred filter if enabled
    if (showStarredOnly) {
      sorted = sorted.filter(post => post.starred);
    }
    // Then apply status filter if enabled
    else if (showStatusOnly && selectedStatuses.length > 0) {
      sorted = sorted.filter(post => selectedStatuses.includes(post.status as Status));
    }

    // Finally apply search filter if there's a search query
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      sorted = sorted.filter(post => 
        post.content.toLowerCase().includes(query) ||
        post.mentions.some(mention => 
          mention.mentionedUser.username.toLowerCase().includes(query)
        )
      );
    }

    return sorted;
  }, [posts, searchQuery, showStatusOnly, selectedStatuses, showStarredOnly]);

  // Calculate status counts from all posts
  const statusCounts = useMemo(() => {
    if (!posts) return {} as Record<Status, number>;
    return posts.reduce((acc: Record<Status, number>, post) => {
      const status = post.status as Status;
      acc[status] = (acc[status] || 0) + 1;
      return acc;
    }, {} as Record<Status, number>);
  }, [posts]);

  // Only show filter bar if not being controlled by parent
  const showFilterBar = searchQuery === "" && !showStatusOnly && !showStarredOnly;

  return (
    <div className="space-y-6">
      {showFilterBar && (
        <div className="flex items-center justify-between px-4 py-4 sticky top-0 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 z-10 border-b">
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
            selectedStatuses={selectedStatuses}
            onStatusesChange={setSelectedStatuses}
            statusCounts={statusCounts}
            showStarredOnly={showStarredOnly}
            onStarredFilterChange={setShowStarredOnly}
          />
        </div>
      )}

      {isLoading && !posts ? (
        <div className="text-center py-8">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground mx-auto" />
        </div>
      ) : filteredPosts.length === 0 ? (
        <p className="text-muted-foreground text-center py-8">
          {searchQuery ? "No posts found matching your search." : "No posts yet"}
        </p>
      ) : (
        <div className="space-y-4">
          {filteredPosts.map((post) => (
            <PostCard key={post.id} post={post} />
          ))}
        </div>
      )}
    </div>
  );
}