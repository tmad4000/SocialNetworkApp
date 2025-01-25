import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import PostCard from "@/components/post-card";
import PostFilter from "@/components/ui/post-filter";

interface PostFeedProps {
  userId?: number;
}

export default function PostFeed({ userId }: PostFeedProps) {
  const [showStatusOnly, setShowStatusOnly] = useState(false);
  
  const { data: posts, isLoading } = useQuery({
    queryKey: [userId ? `/api/posts/user/${userId}` : "/api/posts", { status: showStatusOnly }],
  });

  if (isLoading) {
    return <div className="text-center py-8">Loading posts...</div>;
  }

  if (!posts?.length) {
    return <div className="text-center py-8 text-muted-foreground">No posts found</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-end px-4">
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
