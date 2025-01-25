import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import type { User } from "@db/schema";
import LexicalEditor from "./lexical-editor";

interface CreatePostProps {
  onSuccess?: () => void;
  targetUserId?: number;
}

export default function CreatePost({ onSuccess, targetUserId }: CreatePostProps) {
  const [content, setContent] = useState("");
  const [editorState, setEditorState] = useState("");
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: users } = useQuery<User[]>({
    queryKey: ["/api/users"],
    staleTime: 60000, // Cache for 1 minute
  });

  const createPost = useMutation({
    mutationFn: async (content: string) => {
      const res = await fetch("/api/posts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content, targetUserId }),
        credentials: "include",
      });

      if (!res.ok) {
        throw new Error(await res.text());
      }

      return res.json();
    },
    onSuccess: () => {
      setContent("");
      setEditorState("");
      queryClient.invalidateQueries({ queryKey: ["/api/posts"] });
      if (targetUserId) {
        queryClient.invalidateQueries({ queryKey: [`/api/posts/user/${targetUserId}`] });
      }
      onSuccess?.();
      toast({
        title: "Success",
        description: "Post created successfully",
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

  const handleSubmit = (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!content.trim()) return;
    createPost.mutate(content);
  };

  return (
    <Card>
      <CardContent className="p-4">
        <form onSubmit={handleSubmit} className="space-y-4">
          <LexicalEditor
            onChange={(text, state) => {
              setContent(text);
              setEditorState(state || "");
            }}
            users={users || []}
            placeholder={targetUserId ? "Write something on their timeline..." : "What's on your mind? Use @ to mention users"}
            onSubmit={handleSubmit}
          />
          <div className="flex justify-end">
            <Button
              type="submit"
              disabled={!content.trim() || createPost.isPending}
            >
              Post
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}