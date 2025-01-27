import { useQuery } from "@tanstack/react-query";
import PostCard from "@/components/post-card";
import { Loader2 } from "lucide-react";
import type { Post, User, PostMention, Group } from "@db/schema";

type PostWithDetails = Post & {
  user: User;
  mentions: (PostMention & { mentionedUser: User })[];
  group?: Group;
  likeCount: number;
  liked: boolean;
  starred: boolean;
};

export default function BestIdeasPage() {
  const { data: posts, isLoading } = useQuery<PostWithDetails[]>({
    queryKey: ["/api/posts/starred"],
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!posts?.length) {
    return (
      <div className="max-w-2xl mx-auto py-8 px-4">
        <div className="text-center text-muted-foreground">
          <h1 className="text-2xl font-bold mb-2">Best Ideas</h1>
          <p>No starred posts yet. Star some posts to see them here!</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto py-8 px-4">
      <h1 className="text-2xl font-bold mb-6">Best Ideas</h1>
      <div className="space-y-6">
        {posts.map((post) => (
          <PostCard key={post.id} post={post} />
        ))}
      </div>
    </div>
  );
}
