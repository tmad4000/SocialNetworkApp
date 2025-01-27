import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import PostCard from "@/components/post-card";
import PostFilter from "@/components/ui/post-filter";
import { Input } from "@/components/ui/input";
import { Search, Loader2 } from "lucide-react";
import type { Post, User, PostMention, Group } from "@db/schema";
import type { Status } from "@/components/ui/status-pill";

interface PostFeedProps {
  userId?: number;
  groupId?: number;
  searchQuery?: string;
  showStatusOnly?: boolean;
  showStarredOnly?: boolean;
  selectedStatuses?: Status[];
  onSearchChange?: (query: string) => void;
  onStatusOnlyChange?: (show: boolean) => void;
  onStarredOnlyChange?: (show: boolean) => void;
  onStatusesChange?: (statuses: Status[]) => void;
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
  searchQuery: externalSearchQuery,
  showStatusOnly: externalShowStatusOnly,
  showStarredOnly: externalShowStarredOnly,
  selectedStatuses: externalSelectedStatuses,
  onSearchChange,
  onStatusOnlyChange,
  onStarredOnlyChange,
  onStatusesChange,
}: PostFeedProps) {
  // Internal state for uncontrolled mode
  const [internalSearchQuery, setInternalSearchQuery] = useState("");
  const [internalShowStatusOnly, setInternalShowStatusOnly] = useState(false);
  const [internalShowStarredOnly, setInternalShowStarredOnly] = useState(false);
  const [internalSelectedStatuses, setInternalSelectedStatuses] = useState<Status[]>(
    STATUSES.filter(status => status !== 'none')
  );

  // Use external or internal state based on whether props are provided
  const searchQuery = externalSearchQuery ?? internalSearchQuery;
  const showStatusOnly = externalShowStatusOnly ?? internalShowStatusOnly;
  const showStarredOnly = externalShowStarredOnly ?? internalShowStarredOnly;
  const selectedStatuses = externalSelectedStatuses ?? internalSelectedStatuses;

  // Handlers that update either external or internal state
  const handleSearchChange = (query: string) => {
    if (onSearchChange) {
      onSearchChange(query);
    } else {
      setInternalSearchQuery(query);
    }
  };

  const handleStatusOnlyChange = (show: boolean) => {
    if (onStatusOnlyChange) {
      onStatusOnlyChange(show);
    } else {
      setInternalShowStatusOnly(show);
    }
  };

  const handleStarredOnlyChange = (show: boolean) => {
    if (onStarredOnlyChange) {
      onStarredOnlyChange(show);
    } else {
      setInternalShowStarredOnly(show);
    }
  };

  const handleStatusesChange = (statuses: Status[]) => {
    if (onStatusesChange) {
      onStatusesChange(statuses);
    } else {
      setInternalSelectedStatuses(statuses);
    }
  };

  const { data: posts, isInitialLoading } = useQuery<PostWithDetails[]>({
    queryKey: [groupId ? `/api/groups/${groupId}/posts` : userId ? `/api/posts/user/${userId}` : "/api/posts"],
    staleTime: 5000, // Consider data fresh for 5 seconds
  });

  const filteredPosts = useMemo(() => {
    if (!posts) return [];

    // Always sort by createdAt first
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
  const showFilterBar = !externalSearchQuery && !externalShowStatusOnly && !externalShowStarredOnly;

  if (isInitialLoading) {
    return (
      <div className="text-center py-8">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground mx-auto" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {showFilterBar && (
        <div className="flex items-center justify-between px-4 py-4 sticky top-0 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 z-10 border-b">
          <div className="relative w-64">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search posts..."
              value={searchQuery}
              onChange={(e) => handleSearchChange(e.target.value)}
              className="pl-10"
            />
          </div>
          <PostFilter 
            showStatusOnly={showStatusOnly}
            onFilterChange={handleStatusOnlyChange}
            selectedStatuses={selectedStatuses}
            onStatusesChange={handleStatusesChange}
            statusCounts={statusCounts}
            showStarredOnly={showStarredOnly}
            onStarredFilterChange={handleStarredOnlyChange}
          />
        </div>
      )}

      {filteredPosts.length === 0 ? (
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