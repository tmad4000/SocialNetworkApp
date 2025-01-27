import { Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";

interface StarButtonProps {
  postId: number;
  initialStarred: boolean;
}

export default function StarButton({
  postId,
  initialStarred,
}: StarButtonProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const toggleStar = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/posts/${postId}/star`, {
        method: "POST",
        credentials: "include",
      });

      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
    onMutate: async () => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey: ["/api/posts"] });
      await queryClient.cancelQueries({ queryKey: [`/api/posts/${postId}`] });

      // Snapshot the previous value
      const previousPosts = queryClient.getQueryData(["/api/posts"]);

      // Optimistically update all relevant queries
      queryClient.setQueryData(["/api/posts"], (old: any[]) => 
        old?.map(post => 
          post.id === postId 
            ? { ...post, starred: !post.starred }
            : post
        )
      );

      queryClient.setQueryData([`/api/posts/${postId}`], (old: any) => ({
        ...old,
        starred: !initialStarred,
      }));

      return { previousPosts };
    },
    onError: (error, _, context) => {
      // Revert optimistic update on error
      queryClient.setQueryData(["/api/posts"], context?.previousPosts);
      queryClient.setQueryData([`/api/posts/${postId}`], context?.previousPosts);

      toast({
        variant: "destructive",
        title: "Error",
        description: error.message,
      });
    },
    onSuccess: (data) => {
      // Update queries with the actual server response
      queryClient.setQueryData(["/api/posts"], (old: any[]) =>
        old?.map(post =>
          post.id === postId
            ? { ...post, starred: data.starred }
            : post
        )
      );

      queryClient.setQueryData([`/api/posts/${postId}`], (old: any) => ({
        ...old,
        starred: data.starred,
      }));
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
      <Star 
        className={`h-4 w-4 ${
          initialStarred ? "fill-yellow-400 text-yellow-400" : "text-muted-foreground"
        }`}
      />
      <span className="sr-only">{initialStarred ? 'Remove from best ideas' : 'Mark as best idea'}</span>
    </Button>
  );
}