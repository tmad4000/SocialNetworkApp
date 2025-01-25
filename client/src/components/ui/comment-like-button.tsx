import { Heart } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { useState } from "react";
import CommentLikesModal from "@/components/comment-likes-modal";

interface CommentLikeButtonProps {
  commentId: number;
  initialLiked: boolean;
  initialLikeCount: number;
}

export default function CommentLikeButton({
  commentId,
  initialLiked,
  initialLikeCount,
}: CommentLikeButtonProps) {
  const [showLikesModal, setShowLikesModal] = useState(false);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const toggleLike = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/comments/${commentId}/like`, {
        method: "POST",
        credentials: "include",
      });

      if (!res.ok) {
        throw new Error(await res.text());
      }

      return res.json();
    },
    onSuccess: () => {
      // Invalidate all relevant queries
      queryClient.invalidateQueries({ 
        predicate: (query) => {
          const queryKey = query.queryKey[0]?.toString();
          return queryKey?.includes("/comments") || queryKey?.includes("/posts");
        }
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

  return (
    <>
      <div className="flex items-center gap-1">
        <Button
          variant="ghost"
          size="sm"
          className="h-6 w-6 p-0"
          onClick={() => toggleLike.mutate()}
          disabled={toggleLike.isPending}
        >
          <Heart
            className={cn(
              "h-3.5 w-3.5",
              initialLiked ? "fill-current text-red-500" : "text-muted-foreground"
            )}
          />
        </Button>
        {initialLikeCount > 0 && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowLikesModal(true)}
            className="text-xs text-muted-foreground hover:text-foreground h-6 px-1.5"
          >
            {initialLikeCount}
          </Button>
        )}
      </div>

      <CommentLikesModal
        commentId={commentId}
        open={showLikesModal}
        onOpenChange={setShowLikesModal}
      />
    </>
  );
}