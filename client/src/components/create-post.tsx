import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import type { User, Group } from "@db/schema";
import LexicalEditor from "./lexical-editor";
import { $getRoot, $createParagraphNode } from 'lexical';
import SplitPostsDialog from "./split-posts-dialog";
import { useUser } from "@/hooks/use-user";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Lock, Users, Globe } from "lucide-react";

interface CreatePostProps {
  onSuccess?: () => void;
  targetUserId?: number;
  groupId?: number;
}

export default function CreatePost({ onSuccess, targetUserId, groupId }: CreatePostProps) {
  const [content, setContent] = useState("");
  const [editorState, setEditorState] = useState("");
  const [privacy, setPrivacy] = useState("public");
  const [showSplitDialog, setShowSplitDialog] = useState(false);
  const [pendingPosts, setPendingPosts] = useState<string[]>([]);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [editor, setEditor] = useState<any>(null);
  const { user: currentUser } = useUser();

  const { data: users } = useQuery<User[]>({
    queryKey: ["/api/users"],
    staleTime: 60000,
  });

  const { data: group } = useQuery<Group & { creator: User }>({
    queryKey: [`/api/groups/${groupId}`],
    enabled: !!groupId,
  });

  const createPost = useMutation({
    mutationFn: async (content: string) => {
      const res = await fetch("/api/posts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content, targetUserId, groupId, privacy }),
        credentials: "include",
      });

      if (!res.ok) {
        throw new Error(await res.text());
      }

      return res.json();
    },
    onMutate: async (newContent) => {
      await queryClient.cancelQueries({ queryKey: ["/api/posts"] });
      if (groupId) {
        await queryClient.cancelQueries({ queryKey: [`/api/groups/${groupId}/posts`] });
      }
      if (targetUserId) {
        await queryClient.cancelQueries({ queryKey: [`/api/posts/user/${targetUserId}`] });
      }

      const optimisticPost = {
        id: Date.now(),
        content: newContent,
        createdAt: new Date().toISOString(),
        status: 'none',
        userId: currentUser?.id,
        user: currentUser,
        mentions: [],
        likeCount: 0,
        liked: false,
      };

      if (groupId && group) {
        optimisticPost.group = {
          id: group.id,
          name: group.name,
          description: group.description,
          createdAt: group.createdAt,
          createdBy: group.creator.id,
          creator: group.creator,
        };
      }

      const queries = [
        ["/api/posts"],
        groupId ? [`/api/groups/${groupId}/posts`] : null,
        targetUserId ? [`/api/posts/user/${targetUserId}`] : null,
      ].filter(Boolean);

      const previousPosts: Record<string, any> = {};

      queries.forEach(queryKey => {
        if (queryKey) {
          const posts = queryClient.getQueryData(queryKey);
          previousPosts[JSON.stringify(queryKey)] = posts;
          queryClient.setQueryData(queryKey, (old: any[] = []) => [optimisticPost, ...old]);
        }
      });

      return { previousPosts, optimisticPost };
    },
    onError: (err, newContent, context) => {
      if (context?.previousPosts) {
        Object.entries(context.previousPosts).forEach(([queryKeyStr, posts]) => {
          const queryKey = JSON.parse(queryKeyStr);
          queryClient.setQueryData(queryKey, posts);
        });
      }

      toast({
        variant: "destructive",
        title: "Error",
        description: err.message,
      });
    },
    onSuccess: () => {
      setContent("");
      setEditorState("");
      editor?.update(() => {
        const root = $getRoot();
        root.clear();
        root.append($createParagraphNode());
      });

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
  });

  const handleSubmit = (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!content.trim()) return;

    const posts = content
      .split(/\n\s*\n/)
      .map(post => post.trim())
      .filter(post => post.length > 0);

    if (posts.length > 1) {
      setPendingPosts(posts);
      setShowSplitDialog(true);
      return;
    }

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
            <div className="flex justify-between items-center mb-2">
              <Select
                value={privacy}
                onValueChange={setPrivacy}
                disabled={!!groupId}
              >
                <SelectTrigger className="w-[140px]">
                  <SelectValue placeholder="Privacy" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="public">
                    <div className="flex items-center gap-2">
                      <Globe className="h-4 w-4" />
                      <span>Public</span>
                    </div>
                  </SelectItem>
                  <SelectItem value="friends">
                    <div className="flex items-center gap-2">
                      <Users className="h-4 w-4" />
                      <span>Friends</span>
                    </div>
                  </SelectItem>
                  <SelectItem value="private">
                    <div className="flex items-center gap-2">
                      <Lock className="h-4 w-4" />
                      <span>Private</span>
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

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