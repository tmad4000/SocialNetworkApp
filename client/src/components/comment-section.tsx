import { useState } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { formatDistanceToNow } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "wouter";
import CommentLikeButton from "@/components/ui/comment-like-button";
import type { Comment, User } from "@db/schema";

interface CommentSectionProps {
  postId: number;
}

type CommentWithUser = Comment & { 
  user: Pick<User, "id" | "username" | "avatar">;
  likeCount: number;
  liked: boolean;
};

export default function CommentSection({ postId }: CommentSectionProps) {
  const [comment, setComment] = useState("");
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: comments, isLoading } = useQuery<CommentWithUser[]>({
    queryKey: [`/api/posts/${postId}/comments`],
  });

  const addComment = useMutation({
    mutationFn: async (content: string) => {
      const res = await fetch(`/api/posts/${postId}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content }),
        credentials: "include",
      });

      if (!res.ok) {
        throw new Error(await res.text());
      }

      return res.json();
    },
    onSuccess: () => {
      setComment("");
      queryClient.invalidateQueries({ queryKey: [`/api/posts/${postId}/comments`] });
      toast({
        title: "Success",
        description: "Comment added successfully",
      });
    },
    onError: (error) => {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message,
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!comment.trim()) return;
    addComment.mutate(comment);
  };

  return (
    <div className="space-y-4 px-6">
      <form onSubmit={handleSubmit} className="flex gap-2 items-start">
        <Textarea
          placeholder="Write a comment..."
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          className="min-h-[60px] flex-1 resize-none"
        />
        <Button
          type="submit"
          size="sm"
          disabled={!comment.trim() || addComment.isPending}
        >
          Comment
        </Button>
      </form>

      {isLoading ? (
        <div className="text-center text-muted-foreground">Loading comments...</div>
      ) : !comments?.length ? (
        <div className="text-center text-muted-foreground">No comments yet</div>
      ) : (
        <div className="space-y-4">
          {comments.map((comment) => (
            <div key={comment.id} className="flex gap-3">
              <Link href={`/profile/${comment.user.id}`}>
                <Avatar className="h-8 w-8 cursor-pointer">
                  <AvatarImage
                    src={comment.user.avatar || `https://api.dicebear.com/7.x/avatars/svg?seed=${comment.user.username}`}
                  />
                  <AvatarFallback>{comment.user.username[0]}</AvatarFallback>
                </Avatar>
              </Link>
              <div className="flex-1">
                <div className="bg-muted rounded-lg p-3">
                  <div className="flex items-center justify-between">
                    <Link href={`/profile/${comment.user.id}`}>
                      <span className="font-semibold hover:underline cursor-pointer">
                        {comment.user.username}
                      </span>
                    </Link>
                    <CommentLikeButton
                      commentId={comment.id}
                      initialLiked={comment.liked}
                      initialLikeCount={comment.likeCount}
                    />
                  </div>
                  <p className="mt-1 text-sm whitespace-pre-wrap">{comment.content}</p>
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  {formatDistanceToNow(new Date(comment.createdAt!), { addSuffix: true })}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}