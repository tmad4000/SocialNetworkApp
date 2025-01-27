import { Button } from "@/components/ui/button";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { Eye, EyeOff } from "lucide-react";

interface FollowButtonProps {
  postId: number;
  variant?: "ghost" | "outline" | "secondary" | "default";
  size?: "default" | "sm" | "lg" | "icon";
}

export default function FollowButton({ postId, variant = "ghost", size = "sm" }: FollowButtonProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: followState } = useQuery({
    queryKey: [`/api/posts/${postId}/following`],
  });

  const toggleFollow = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/posts/${postId}/follow`, {
        method: "POST",
        credentials: "include",
      });

      if (!res.ok) {
        throw new Error(await res.text());
      }

      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/posts/${postId}/following`] });
      toast({
        title: followState?.following ? "Unfollowed post" : "Following post",
        description: followState?.following 
          ? "You will no longer receive updates about this post" 
          : "You will receive updates when this post changes",
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
    <Button
      variant={variant}
      size={size}
      onClick={() => toggleFollow.mutate()}
      disabled={toggleFollow.isPending}
      className="gap-2"
    >
      {followState?.following ? (
        <>
          <EyeOff className="h-4 w-4" />
          <span>Following</span>
        </>
      ) : (
        <>
          <Eye className="h-4 w-4" />
          <span>Follow</span>
        </>
      )}
    </Button>
  );
}
