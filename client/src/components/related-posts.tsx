import { useState } from "react";
import { ChevronDown, ChevronUp, Loader2 } from "lucide-react";
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
  starCount: number;
  starred: boolean;
  mentions: { mentionedUser: { id: number; username: string; avatar: string | null; } }[];
};

export default function RelatedPosts({ postId }: RelatedPostsProps) {
  const [isOpen, setIsOpen] = useState(false);

  const { data: relatedPosts, isLoading, isError } = useQuery<RelatedPost[]>({
    queryKey: [`/api/posts/${postId}/related`],
    enabled: isOpen,
  });

  return (
    <div>
      {!isOpen ? (
        <Button
          variant="ghost"
          className="w-full flex justify-between items-center py-2 px-6"
          onClick={() => setIsOpen(true)}
        >
          <span className="text-sm text-muted-foreground">Show related posts</span>
          <ChevronDown className="h-4 w-4" />
        </Button>
      ) : (
        <div className="space-y-4 px-6">
          <Button
            variant="ghost"
            className="w-full flex justify-between items-center py-2"
            onClick={() => setIsOpen(false)}
          >
            <span className="text-sm text-muted-foreground">Hide posts</span>
            <ChevronUp className="h-4 w-4" />
          </Button>

          {isLoading ? (
            <div className="flex flex-col items-center justify-center gap-2 py-8 text-muted-foreground">
              <Loader2 className="h-6 w-6 animate-spin" />
              <p>Processing related posts...</p>
              <p className="text-sm">This might take a moment while we analyze content similarities</p>
            </div>
          ) : isError ? (
            <div className="text-center text-muted-foreground py-4">
              Unable to load related posts at this time
            </div>
          ) : relatedPosts?.length === 0 ? (
            <div className="text-center text-muted-foreground py-4">
              No related posts found
            </div>
          ) : (
            <div className="space-y-6">
              {relatedPosts?.map((post) => (
                <div key={post.id} className="opacity-80 hover:opacity-100 transition-opacity">
                  <div className="text-sm text-muted-foreground mb-2">
                    <div className="flex justify-between items-center">
                      <span>
                        Similarity score: {(post.similarity * 100).toFixed(2)}%
                        {post.similarity > 0.7 ? " (Strong match)" : 
                         post.similarity > 0.4 ? " (Moderate match)" : 
                         post.similarity > 0.2 ? " (Weak match)" : " (Very weak/no match)"}
                      </span>
                      <span className="text-xs font-mono bg-muted px-2 py-1 rounded">
                        Post ID: {post.id}
                      </span>
                    </div>
                  </div>
                  <PostCard post={post} />
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}