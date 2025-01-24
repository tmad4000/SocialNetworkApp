import { useQuery } from "@tanstack/react-query";
import PostCard from "@/components/post-card";
import CreatePost from "@/components/create-post";
import { Loader2 } from "lucide-react";
import type { Post } from "@db/schema";

export default function HomePage() {
  const { data: posts, isLoading } = useQuery<(Post & { user: { username: string; avatar: string | null } })[]>({
    queryKey: ["/api/posts"],
  });

  return (
    <div className="max-w-2xl mx-auto">
      <CreatePost />
      
      {isLoading ? (
        <div className="flex justify-center p-8">
          <Loader2 className="h-8 w-8 animate-spin text-border" />
        </div>
      ) : (
        <div className="space-y-6 mt-6">
          {posts?.map((post) => (
            <PostCard key={post.id} post={post} />
          ))}
        </div>
      )}
    </div>
  );
}
