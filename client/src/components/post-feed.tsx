import { useState, useMemo, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import PostCard from "@/components/post-card";
import MinimalistPostCard from "@/components/minimalist-post-card";
import PostFilter from "@/components/ui/post-filter";
import { Input } from "@/components/ui/input";
import { Search, Loader2 } from "lucide-react";
import type { Post, User, PostMention, Group } from "@db/schema";
import type { Status } from "@/components/ui/status-pill";
import { useUser } from "@/hooks/use-user";
import { useFriends } from "@/hooks/use-friends";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

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
  viewMode?: 'standard' | 'minimalist';
}

type PostWithDetails = Post & {
  user: User;
  mentions: (PostMention & { mentionedUser: User })[];
  group?: Group;
  likeCount: number;
  liked: boolean;
  starred: boolean;
  privacy: string;
  manualOrder?: number;
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
  viewMode: externalViewMode,
}: PostFeedProps) {
  const { user: currentUser } = useUser();
  const { data: friends } = useFriends();
  const queryClient = useQueryClient();
  const [internalViewMode, setInternalViewMode] = useState<'standard' | 'minimalist'>('standard');
  const [sortOrder, setSortOrder] = useState<'dateCreated' | 'manual'>('dateCreated');
  const [internalSearchQuery, setInternalSearchQuery] = useState("");
  const [internalShowStatusOnly, setInternalShowStatusOnly] = useState(false);
  const [internalShowStarredOnly, setInternalShowStarredOnly] = useState(false);
  const [internalSelectedStatuses, setInternalSelectedStatuses] = useState<Status[]>(
    STATUSES.filter(status => status !== 'none')
  );

  const activeViewMode = externalViewMode ?? internalViewMode;

  useEffect(() => {
    setSortOrder(activeViewMode === 'minimalist' ? 'manual' : 'dateCreated');
  }, [activeViewMode]);

  const searchQuery = externalSearchQuery ?? internalSearchQuery;
  const showStatusOnly = externalShowStatusOnly ?? internalShowStatusOnly;
  const showStarredOnly = externalShowStarredOnly ?? internalShowStarredOnly;
  const selectedStatuses = externalSelectedStatuses ?? internalSelectedStatuses;

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

  const updatePostOrder = useMutation({
    mutationFn: async ({ postId, newOrder }: { postId: number; newOrder: number }) => {
      const res = await fetch(`/api/posts/${postId}/order`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ manualOrder: newOrder }),
        credentials: "include",
      });

      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: [groupId ? `/api/groups/${groupId}/posts` : userId ? `/api/posts/user/${userId}` : "/api/posts"]
      });
    },
  });

  const createPost = useMutation({
    mutationFn: async (content: string) => {
      const res = await fetch("/api/posts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          content,
          groupId,
          manualOrder: Date.now()
        }),
        credentials: "include",
      });

      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: [groupId ? `/api/groups/${groupId}/posts` : userId ? `/api/posts/user/${userId}` : "/api/posts"]
      });
    },
  });

  const { data: posts, isInitialLoading } = useQuery<PostWithDetails[]>({
    queryKey: [groupId ? `/api/groups/${groupId}/posts` : userId ? `/api/posts/user/${userId}` : "/api/posts"],
    staleTime: 5000,
  });

  const handleViewChange = (view: string) => {
    setInternalViewMode(view as 'standard' | 'minimalist');
  };

  const filteredPosts = useMemo(() => {
    if (!posts) return [];

    let sorted = [...posts];

    if (sortOrder === 'manual') {
      sorted.sort((a, b) => (a.manualOrder || 0) - (b.manualOrder || 0));
    } else {
      sorted.sort((a, b) =>
        new Date(b.createdAt!).getTime() - new Date(a.createdAt!).getTime()
      );
    }

    sorted = sorted.filter(post => {
      if (post.groupId) return true;
      if (post.user.id === currentUser?.id) return true;
      if (post.privacy === 'public') return true;
      if (post.privacy === 'private') return post.user.id === currentUser?.id;
      if (post.privacy === 'friends') {
        const isFriend = friends?.some(f =>
          (f.userId === currentUser?.id && f.friendId === post.user.id ||
            f.userId === post.user.id && f.friendId === currentUser?.id) &&
          f.status === 'accepted'
        );
        return isFriend;
      }
      return false;
    });

    if (showStarredOnly) {
      sorted = sorted.filter(post => post.starred);
    } else if (showStatusOnly && selectedStatuses.length > 0) {
      sorted = sorted.filter(post => selectedStatuses.includes(post.status as Status));
    }

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
  }, [posts, searchQuery, showStatusOnly, selectedStatuses, showStarredOnly, currentUser, friends, sortOrder]);

  const statusCounts = useMemo(() => {
    if (!posts) return {} as Record<Status, number>;
    return posts.reduce((acc: Record<Status, number>, post) => {
      const status = post.status as Status;
      acc[status] = (acc[status] || 0) + 1;
      return acc;
    }, {} as Record<Status, number>);
  }, [posts]);

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
      {!externalViewMode && (
        <Tabs value={activeViewMode} onValueChange={handleViewChange} className="w-full">
          <div className="flex justify-between items-center">
            <TabsList>
              <TabsTrigger value="standard">Standard View</TabsTrigger>
              <TabsTrigger value="minimalist">Minimalist View</TabsTrigger>
            </TabsList>
          </div>

          {activeViewMode === 'standard' && (
            <TabsContent value="standard">
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
            </TabsContent>
          )}

          {activeViewMode === 'minimalist' && (
            <TabsContent value="minimalist">
              {filteredPosts.length === 0 ? (
                <p className="text-muted-foreground text-center py-8">
                  {searchQuery ? "No posts found matching your search." : "No posts yet"}
                </p>
              ) : (
                <div className="space-y-2">
                  {filteredPosts.map((post, index) => (
                    <MinimalistPostCard
                      key={post.id}
                      post={post}
                      onOrderChange={(newOrder) => updatePostOrder.mutate({ postId: post.id, newOrder })}
                      onCreatePost={(content) => {
                        const prevPost = filteredPosts[index - 1];
                        const nextPost = filteredPosts[index + 1];
                        const newOrder = prevPost && nextPost
                          ? (prevPost.manualOrder! + nextPost.manualOrder!) / 2
                          : prevPost
                            ? prevPost.manualOrder! + 1000
                            : nextPost
                              ? nextPost.manualOrder! - 1000
                              : Date.now();

                        createPost.mutate(content);
                      }}
                    />
                  ))}
                </div>
              )}
            </TabsContent>
          )}
        </Tabs>
      )}
    </div>
  );
}