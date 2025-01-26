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
  groupId?: number;
}

export default function CreatePost({ onSuccess, targetUserId, groupId }: CreatePostProps) {
  const [content, setContent] = useState("");
  const [editorState, setEditorState] = useState("");
  const [showSplitDialog, setShowSplitDialog] = useState(false);
  const [pendingPosts, setPendingPosts] = useState<string[]>([]);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [editor, setEditor] = useState<any>(null);

  const { data: users } = useQuery<User[]>({
    queryKey: ["/api/users"],
    staleTime: 60000,
  });

  const { data: group } = useQuery({
    queryKey: [`/api/groups/${groupId}`],
    enabled: !!groupId,
  });

  const createPost = useMutation({
    mutationFn: async (content: string) => {
      const res = await fetch("/api/posts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content, targetUserId, groupId }),
        credentials: "include",
      });

      if (!res.ok) {
        throw new Error(await res.text());
      }

      return res.json();
    },
    onMutate: async (newContent) => {
      // Cancel any outgoing refetches so they don't overwrite our optimistic update
      await queryClient.cancelQueries({ queryKey: ["/api/posts"] });
      if (groupId) {
        await queryClient.cancelQueries({ queryKey: [`/api/groups/${groupId}/posts`] });
      }
      if (targetUserId) {
        await queryClient.cancelQueries({ queryKey: [`/api/posts/user/${targetUserId}`] });
      }

      // Create optimistic post
      const optimisticPost = {
        id: -1, // Temporary ID
        content: newContent,
        createdAt: new Date().toISOString(),
        status: 'none',
        userId: -1,
        mentions: [],
        user: group?.creator || {}, // Will be replaced with actual user data
        likeCount: 0,
        liked: false,
        group: groupId && group ? {
          id: group.id,
          name: group.name,
          description: group.description,
          createdAt: group.createdAt,
          createdBy: group.createdBy,
        } : undefined,
      };

      // Update all relevant queries with optimistic data
      const queries = [
        ["/api/posts"],
        groupId ? [`/api/groups/${groupId}/posts`] : null,
        targetUserId ? [`/api/posts/user/${targetUserId}`] : null,
      ].filter(Boolean);

      queries.forEach(queryKey => {
        if (queryKey) {
          const previousPosts = queryClient.getQueryData(queryKey) as any[];
          queryClient.setQueryData(queryKey, previousPosts ? [optimisticPost, ...previousPosts] : [optimisticPost]);
        }
      });

      return { optimisticPost };
    },
    onSuccess: (data) => {
      // Clear editor state
      setContent("");
      setEditorState("");
      editor?.update(() => {
        const root = $getRoot();
        root.clear();
        root.append($createParagraphNode());
      });

      // Invalidate to get fresh data
      queryClient.invalidateQueries({ queryKey: ["/api/posts"] });
      if (groupId) {
        queryClient.invalidateQueries({ queryKey: [`/api/groups/${groupId}`] });
        queryClient.invalidateQueries({ queryKey: [`/api/groups/${groupId}/posts`] });
      }
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

  const placeholderText = groupId 
    ? "Share something with the group..."
    : targetUserId 
      ? "Write something on their timeline..." 
      : "What's on your mind? Use @ to mention users";

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
              placeholder={placeholderText}
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
        onConfirm={() => {
          pendingPosts.forEach(async (post) => {
            await createPost.mutateAsync(post);
          });
          setPendingPosts([]);
          setShowSplitDialog(false);
        }}
        postCount={pendingPosts.length}
      />
    </>
  );
}