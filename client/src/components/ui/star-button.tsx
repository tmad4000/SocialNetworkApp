import { Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { useState, useEffect } from "react";

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
  const [isStarred, setIsStarred] = useState(initialStarred);

  // Keep local state in sync with prop
  useEffect(() => {
    setIsStarred(initialStarred);
  }, [initialStarred]);

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
      // Update local state immediately
      setIsStarred(!isStarred);

      // Cancel any outgoing refetches
      await queryClient.cancelQueries({ queryKey: ["/api/posts"] });
      await queryClient.cancelQueries({ queryKey: [`/api/posts/${postId}`] });

      // Snapshot the previous values
      const previousData = {
        posts: queryClient.getQueryData(["/api/posts"]),
        post: queryClient.getQueryData([`/api/posts/${postId}`]),
      };

      // Optimistically update queries
      const updatePost = (post: any) =>
        post?.id === postId ? { ...post, starred: !isStarred } : post;

      queryClient.setQueryData(["/api/posts"], (old: any[] = []) =>
        old.map(updatePost)
      );

      queryClient.setQueryData([`/api/posts/${postId}`], updatePost);

      return previousData;
    },
    onError: (error, _, context) => {
      // Revert local state
      setIsStarred(isStarred);

      // Revert optimistic updates
      if (context) {
        queryClient.setQueryData(["/api/posts"], context.posts);
        queryClient.setQueryData([`/api/posts/${postId}`], context.post);
      }

      toast({
        variant: "destructive",
        title: "Error",
        description: error.message,
      });
    },
    onSuccess: (data) => {
      // Ensure local state matches server state
      setIsStarred(data.starred);

      // Invalidate all post queries to ensure correct filtering
      queryClient.invalidateQueries({ queryKey: ["/api/posts"] });
      queryClient.invalidateQueries({ 
        predicate: (query) => 
          String(query.queryKey[0]).startsWith("/api/posts/")
      });
      queryClient.invalidateQueries({ 
        predicate: (query) => 
          String(query.queryKey[0]).startsWith("/api/groups/")
      });

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
          isStarred ? "fill-yellow-400 text-yellow-400" : "text-muted-foreground"
        }`}
      />
      <span className="sr-only">{isStarred ? 'Remove from best ideas' : 'Mark as best idea'}</span>
    </Button>
  );
}