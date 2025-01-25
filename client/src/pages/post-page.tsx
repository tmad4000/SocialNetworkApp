import { useRoute } from "wouter";
import { useQuery } from "@tanstack/react-query";
import PostCard from "@/components/post-card";
import { Loader2 } from "lucide-react";
import type { Post, User, PostMention } from "@db/schema";

type PostWithDetails = Post & {
  user: User;
  mentions: (PostMention & { mentionedUser: User })[];
  likeCount: number;
  liked: boolean;
};

export default function PostPage() {
  const [, params] = useRoute<{ id: string }>("/post/:id");
  const postId = params?.id;

  const { data: post, isLoading } = useQuery<PostWithDetails>({
    queryKey: [`/api/posts/${postId}`],
    enabled: !!postId,
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!post) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-muted-foreground">Post not found</p>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto py-8 px-4">
      <PostCard post={post} />
    </div>
  );
}
