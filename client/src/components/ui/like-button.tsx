import { Heart } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

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
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/posts"] });
      queryClient.invalidateQueries({ queryKey: ["/api/posts/user"] });
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
          initialLiked ? "fill-current text-red-500" : "text-muted-foreground"
        )}
      />
      <span className="text-muted-foreground">{initialLikeCount}</span>
    </Button>
  );
}
