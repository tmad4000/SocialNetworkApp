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
      await queryClient.cancelQueries({ queryKey: [`/api/posts/user`] });

      // Snapshot the previous values
      const previousPost = queryClient.getQueryData([`/api/posts/${postId}`]);
      const previousPosts = queryClient.getQueryData(["/api/posts"]);
      const previousUserPosts = queryClient.getQueryData(["/api/posts/user"]);

      // Optimistically update
      const updatePost = (post: any) => 
        post?.id === postId 
          ? { ...post, starred: !initialStarred }
          : post;

      queryClient.setQueryData([`/api/posts/${postId}`], (old: any) => 
        updatePost(old)
      );

      queryClient.setQueryData(["/api/posts"], (old: any[]) => 
        old?.map(updatePost)
      );

      queryClient.setQueryData(["/api/posts/user"], (old: any[]) => 
        old?.map(updatePost)
      );

      return { previousPost, previousPosts, previousUserPosts };
    },
    onError: (error, _, context) => {
      // Revert optimistic updates
      if (context) {
        queryClient.setQueryData([`/api/posts/${postId}`], context.previousPost);
        queryClient.setQueryData(["/api/posts"], context.previousPosts);
        queryClient.setQueryData(["/api/posts/user"], context.previousUserPosts);
      }

      toast({
        variant: "destructive",
        title: "Error",
        description: error.message,
      });
    },
    onSuccess: (data) => {
      // Update all relevant queries with the server response
      const updatePost = (post: any) =>
        post?.id === postId
          ? { ...post, starred: data.starred }
          : post;

      queryClient.setQueryData([`/api/posts/${postId}`], (old: any) => 
        updatePost(old)
      );

      queryClient.setQueryData(["/api/posts"], (old: any[]) =>
        old?.map(updatePost)
      );

      queryClient.setQueryData(["/api/posts/user"], (old: any[]) =>
        old?.map(updatePost)
      );

      toast({
        title: data.starred ? "Added to best ideas" : "Removed from best ideas",
        description: data.starred 
          ? "This post has been marked as a best idea"
          : "This post has been removed from best ideas",
      });
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