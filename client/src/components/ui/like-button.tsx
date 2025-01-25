import { Heart } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { useState } from "react";
import LikesModal from "@/components/likes-modal";

interface LikeButtonProps {
  postId: number;
  initialLiked: boolean;
  initialLikeCount: number;
}

export default function LikeButton({
  postId,
  initialLiked,
  initialLikeCount,
}: LikeButtonProps) {
  const [showLikesModal, setShowLikesModal] = useState(false);
  const [optimisticLiked, setOptimisticLiked] = useState(initialLiked);
  const [optimisticCount, setOptimisticCount] = useState(initialLikeCount);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const toggleLike = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/posts/${postId}/like`, {
        method: "POST",
        credentials: "include",
      });

      if (!res.ok) {
        throw new Error(await res.text());
      }

      return res.json();
    },
    onMutate: () => {
      // Optimistically update UI
      setOptimisticLiked(!optimisticLiked);
      setOptimisticCount(optimisticCount + (optimisticLiked ? -1 : 1));
    },
    onError: (error) => {
      // Revert optimistic update on error
      setOptimisticLiked(initialLiked);
      setOptimisticCount(initialLikeCount);
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message,
      });
    },
    onSuccess: () => {
      // Invalidate relevant queries after successful update
      queryClient.invalidateQueries({ queryKey: ["/api/posts"] });
      queryClient.invalidateQueries({ 
        predicate: (query) => 
          query.queryKey[0].toString().startsWith("/api/posts/user/")
      });
    },
  });

  return (
    <>
      <div className="flex items-center gap-2">
        <Button
          variant="ghost"
          size="sm"
          className="gap-1.5"
          onClick={() => toggleLike.mutate()}
          disabled={toggleLike.isPending}
        >
          <Heart
            className={cn(
              "h-4 w-4",
              optimisticLiked ? "fill-current text-red-500" : "text-muted-foreground"
            )}
          />
        </Button>
        {optimisticCount > 0 && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowLikesModal(true)}
            className="text-muted-foreground hover:text-foreground"
          >
            {optimisticCount} {optimisticCount === 1 ? 'like' : 'likes'}
          </Button>
        )}
      </div>

      <LikesModal
        postId={postId}
        open={showLikesModal}
        onOpenChange={setShowLikesModal}
      />
    </>
  );
}