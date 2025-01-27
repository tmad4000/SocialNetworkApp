import { Star, StarOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";

interface StarButtonProps {
  postId: number;
  initialStarred: boolean;
  initialStarCount: number;
}

export default function StarButton({
  postId,
  initialStarred,
  initialStarCount,
}: StarButtonProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const toggleStar = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/posts/${postId}/star`, {
        method: initialStarred ? "DELETE" : "POST",
        credentials: "include",
      });

      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
    onMutate: async () => {
      await queryClient.cancelQueries({ queryKey: [`/api/posts/${postId}`] });
      const previousData = queryClient.getQueryData([`/api/posts/${postId}`]);

      queryClient.setQueryData([`/api/posts/${postId}`], (old: any) => ({
        ...old,
        starred: !initialStarred,
        starCount: initialStarred ? initialStarCount - 1 : initialStarCount + 1,
      }));

      return { previousData };
    },
    onError: (error, _, context) => {
      queryClient.setQueryData([`/api/posts/${postId}`], context?.previousData);
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message,
      });
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/posts/${postId}`] });
      queryClient.invalidateQueries({ queryKey: ["/api/posts"] });
    },
  });

  return (
    <Button
      variant="ghost"
      size="sm"
      className="gap-1.5"
      onClick={() => toggleStar.mutate()}
      disabled={toggleStar.isPending}
    >
      {initialStarred ? (
        <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
      ) : (
        <StarOff className="h-4 w-4" />
      )}
      <span className="text-muted-foreground">{initialStarCount}</span>
    </Button>
  );
}
