import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import PostCard from "@/components/post-card";
import PostFilter from "@/components/ui/post-filter";
import { Input } from "@/components/ui/input";
import { Search, Loader2 } from "lucide-react";
import type { Post, User, PostMention } from "@db/schema";

interface PostFeedProps {
  userId?: number;
}

type PostWithDetails = Post & {
  user: User;
  mentions: (PostMention & { mentionedUser: User })[];
  likeCount: number;
  liked: boolean;
};

export default function PostFeed({ userId }: PostFeedProps) {
  const [showStatusOnly, setShowStatusOnly] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  const { data: posts, isLoading } = useQuery<PostWithDetails[]>({
    queryKey: [userId ? `/api/posts/user/${userId}` : "/api/posts", { status: showStatusOnly }],
  });

  const filteredPosts = useMemo(() => {
    if (!posts) return [];

    // First apply status filter
    let filtered = showStatusOnly 
      ? posts.filter(post => post.status !== 'none')
      : posts;

    // Then apply search filter if there's a search query
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(post => 
        post.content.toLowerCase().includes(query) ||
        post.mentions.some(mention => 
          mention.mentionedUser.username.toLowerCase().includes(query)
        )
      );
    }

    return filtered;
  }, [posts, searchQuery, showStatusOnly]);

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center px-4 py-4 sticky top-0 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 z-10 border-b">
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

      {isLoading ? (
        <div className="text-center py-8">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground mx-auto" />
        </div>
      ) : filteredPosts.length === 0 ? (
        <p className="text-muted-foreground text-center py-8">
          {searchQuery ? "No posts found matching your search." : "No posts yet"}
        </p>
      ) : (
        filteredPosts.map((post) => (
          <PostCard key={post.id} post={post} />
        ))
      )}
    </div>
  );
}