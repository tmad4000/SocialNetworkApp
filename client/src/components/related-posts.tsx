import { useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useQuery } from "@tanstack/react-query";
import type { Post } from "@db/schema";
import PostCard from "./post-card";

interface RelatedPostsProps {
  postId: number;
}

type RelatedPost = Post & {
  user: {
    id: number;
    username: string;
    avatar: string | null;
  };
  similarity: number;
  likeCount: number;
  liked: boolean;
  mentions: { mentionedUser: { id: number; username: string; avatar: string | null; } }[];
};

export default function RelatedPosts({ postId }: RelatedPostsProps) {
  const [isOpen, setIsOpen] = useState(false);

  const { data: relatedPosts, isLoading } = useQuery<RelatedPost[]>({
    queryKey: [`/api/posts/${postId}/related`],
    enabled: isOpen,
  });

  if (!isOpen) {
    return (
      <Button
        variant="ghost"
        className="w-full flex justify-between items-center py-2 px-4"
        onClick={() => setIsOpen(true)}
      >
        <span className="text-sm text-muted-foreground">Show related posts</span>
        <ChevronDown className="h-4 w-4" />
      </Button>
    );
  }

  return (
    <div className="space-y-4">
      <Button
        variant="ghost"
        className="w-full flex justify-between items-center py-2 px-4"
        onClick={() => setIsOpen(false)}
      >
        <span className="text-sm text-muted-foreground">Hide related posts</span>
        <ChevronUp className="h-4 w-4" />
      </Button>

      {isLoading ? (
        <div className="text-center text-muted-foreground py-4">
          Finding related posts...
        </div>
      ) : !relatedPosts?.length ? (
        <div className="text-center text-muted-foreground py-4">
          No related posts found
        </div>
      ) : (
        <div className="space-y-4">
          {relatedPosts.map((post) => (
            <div key={post.id} className="opacity-80 hover:opacity-100 transition-opacity">
              <div className="text-sm text-muted-foreground mb-2 px-4">
                {Math.round(post.similarity * 100)}% similar
              </div>
              <PostCard post={post} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}