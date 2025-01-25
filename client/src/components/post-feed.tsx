import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import PostCard from "@/components/post-card";
import PostFilter from "@/components/ui/post-filter";
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

  const { data: posts, isLoading } = useQuery<PostWithDetails[]>({
    queryKey: [userId ? `/api/posts/user/${userId}` : "/api/posts"],
    // Pass the status filter as a search parameter
    queryFn: async ({ queryKey }) => {
      const baseUrl = queryKey[0] as string;
      const url = new URL(baseUrl, window.location.origin);
      url.searchParams.set('status', showStatusOnly.toString());
      const res = await fetch(url, { credentials: 'include' });
      if (!res.ok) throw new Error('Failed to fetch posts');
      return res.json();
    }
  });

  if (isLoading) {
    return <div className="text-center py-8">Loading posts...</div>;
  }

  if (!posts?.length) {
    return <div className="text-center py-8 text-muted-foreground">No posts found</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-end px-4 py-4 sticky top-0 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 z-10 border-b">
        <PostFilter 
          showStatusOnly={showStatusOnly} 
          onFilterChange={setShowStatusOnly}
        />
      </div>
      {posts.map((post) => (
        <PostCard key={post.id} post={post} />
      ))}
    </div>
  );
}