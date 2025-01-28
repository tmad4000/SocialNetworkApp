import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { User, Group } from "@db/schema";
import LexicalEditor from "./lexical-editor";
import { $getRoot, $createParagraphNode } from 'lexical';
import SplitPostsDialog from "./split-posts-dialog";
import { useUser } from "@/hooks/use-user";
import { Lock, Users, Globe } from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

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
  const [pendingContent, setPendingContent] = useState("");
  const [pendingPosts, setPendingPosts] = useState<string[]>([]);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [editor, setEditor] = useState<any>(null);
  const { user: currentUser } = useUser();

  const { data: users } = useQuery<User[]>({
    queryKey: ["/api/users"],
    staleTime: 60000,
  });

  const { data: groups } = useQuery<Group[]>({
    queryKey: ["/api/groups"],
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
        body: JSON.stringify({
          content,
          targetUserId,
          groupId,
          privacy
        }),
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
        privacy,
      };

      if (groupId && group) {
        optimisticPost.group = group;
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

  const handleSplitDecision = (shouldSplit: boolean) => {
    if (shouldSplit) {
      pendingPosts.forEach(async (post) => {
        await createPost.mutateAsync(post);
      });
    } else {
      createPost.mutate(pendingContent);
    }
    setPendingPosts([]);
    setPendingContent("");
    setShowSplitDialog(false);
  };

  const handleSubmit = (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!content.trim()) return;

    const posts = content
      .split(/\n\s*\n/)
      .map(post => post.trim())
      .filter(post => post.length > 0);

    if (posts.length > 1) {
      setPendingContent(content);
      setPendingPosts(posts);
      setShowSplitDialog(true);
    } else {
      createPost.mutate(content);
    }
  };

  const placeholderText = groupId
    ? "Share something with the group..."
    : targetUserId
      ? "Write something on their timeline..."
      : "What's on your mind? Use @ to mention users or groups";

  const renderPrivacyIcon = () => {
    switch (privacy) {
      case 'private':
        return <Lock className="h-4 w-4" />;
      case 'friends':
        return <Users className="h-4 w-4" />;
      default:
        return <Globe className="h-4 w-4" />;
    }
  };

  return (
    <>
      <Card>
        <CardContent className="p-4">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="flex justify-between items-center mb-2">
              {group && (
                <div className="text-sm text-muted-foreground">
                  Posting in {group.name}
                </div>
              )}
              {!groupId && (
                <div className="ml-auto">
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-muted-foreground hover:text-foreground flex gap-2"
                      >
                        {renderPrivacyIcon()}
                        <span className="text-sm">
                          {privacy.charAt(0).toUpperCase() + privacy.slice(1)}
                        </span>
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-40 p-0" align="end">
                      <div className="space-y-1 p-1">
                        <Button
                          variant={privacy === 'public' ? 'secondary' : 'ghost'}
                          size="sm"
                          className="w-full justify-start gap-2"
                          onClick={() => setPrivacy('public')}
                        >
                          <Globe className="h-4 w-4" />
                          <span>Public</span>
                        </Button>
                        <Button
                          variant={privacy === 'friends' ? 'secondary' : 'ghost'}
                          size="sm"
                          className="w-full justify-start gap-2"
                          onClick={() => setPrivacy('friends')}
                        >
                          <Users className="h-4 w-4" />
                          <span>Friends</span>
                        </Button>
                        <Button
                          variant={privacy === 'private' ? 'secondary' : 'ghost'}
                          size="sm"
                          className="w-full justify-start gap-2"
                          onClick={() => setPrivacy('private')}
                        >
                          <Lock className="h-4 w-4" />
                          <span>Private</span>
                        </Button>
                      </div>
                    </PopoverContent>
                  </Popover>
                </div>
              )}
            </div>

            <LexicalEditor
              onChange={(text, state) => {
                setContent(text);
                setEditorState(state || "");
              }}
              users={users || []}
              groups={groups || []}
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
            handleSplitDecision(false);
          }
        }}
        onConfirm={() => handleSplitDecision(true)}
        postCount={pendingPosts.length}
      />
    </>
  );
}