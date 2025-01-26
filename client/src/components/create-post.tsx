import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import type { User } from "@db/schema";
import LexicalEditor from "./lexical-editor";
import { $getRoot, $createParagraphNode } from 'lexical';
import SplitPostsDialog from "./split-posts-dialog";

interface CreatePostProps {
  onSuccess?: () => void;
  targetUserId?: number;
}

export default function CreatePost({ onSuccess, targetUserId }: CreatePostProps) {
  const [content, setContent] = useState("");
  const [editorState, setEditorState] = useState("");
  const [showSplitDialog, setShowSplitDialog] = useState(false);
  const [pendingPosts, setPendingPosts] = useState<string[]>([]);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [editor, setEditor] = useState<any>(null);

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
      // Clear content state
      setContent("");
      setEditorState("");

      // Reset Lexical editor state
      try {
        if (editor) {
          editor.update(() => {
            const root = $getRoot();
            root.clear();
            const paragraph = $createParagraphNode();
            root.append(paragraph);
          });

          // Force editor to re-render with empty state
          editor.setEditorState(editor.parseEditorState(""));
        }
      } catch (error) {
        console.error("Error resetting editor:", error);
      }

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

  const createMultiplePosts = async () => {
    try {
      // Create posts sequentially to maintain order
      for (const post of pendingPosts) {
        await createPost.mutateAsync(post);
      }
      setPendingPosts([]);
      setShowSplitDialog(false);
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message,
      });
    }
  };

  const handleSubmit = (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!content.trim()) return;

    // Split content by double line breaks (indicating separate ideas)
    const posts = content
      .split(/\n\s*\n/)
      .map(post => post.trim())
      .filter(post => post.length > 0);

    // If we have multiple non-empty posts, show the dialog
    if (posts.length > 1) {
      setPendingPosts(posts);
      setShowSplitDialog(true);
      return;
    }

    // Otherwise, create a single post
    createPost.mutate(content);
  };

  return (
    <>
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
              setEditor={setEditor}
              editorState={editorState}
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

      <SplitPostsDialog
        isOpen={showSplitDialog}
        onOpenChange={(open) => {
          setShowSplitDialog(open);
          if (!open) {
            setPendingPosts([]);
          }
        }}
        onConfirm={createMultiplePosts}
        postCount={pendingPosts.length}
      />
    </>
  );
}