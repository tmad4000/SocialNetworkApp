import { Card, CardHeader, CardContent, CardFooter } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { formatDistanceToNow } from "date-fns";
import { Link } from "wouter";
import type { Post, User, PostMention } from "@db/schema";
import StatusPill from "@/components/ui/status-pill";
import type { Status } from "@/components/ui/status-pill";
import LikeButton from "@/components/ui/like-button";
import CommentSection from "@/components/comment-section";
import { Button } from "@/components/ui/button";
import { MessageSquare, Link as LinkIcon, MoreVertical, ChevronRight, QrCode, Lock, Users, Globe } from "lucide-react";
import FollowButton from "@/components/ui/follow-button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useUser } from "@/hooks/use-user";
import { useToast } from "@/hooks/use-toast";
import LexicalEditor from "./lexical-editor";
import RelatedPosts from "./related-posts";
import type { Group } from "@db/schema";
import StarButton from "@/components/ui/star-button";

interface PostCardProps {
  post: Post & {
    user: User;
    mentions: (PostMention & { mentionedUser: User })[];
    likeCount: number;
    liked: boolean;
    starred: boolean;
    group?: Group;
    privacy: string;
  };
}

export default function PostCard({ post }: PostCardProps) {
  const [isCommentsOpen, setIsCommentsOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [isQrDialogOpen, setIsQrDialogOpen] = useState(false);
  const [editedContent, setEditedContent] = useState(post.content);
  const [editedPrivacy, setEditedPrivacy] = useState(post.privacy);
  const { user: currentUser } = useUser();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: commentCount } = useQuery<{ count: number }>({
    queryKey: [`/api/posts/${post.id}/comments/count`],
    enabled: !isCommentsOpen,
  });

  const { data: qrCode } = useQuery<{ qrCode: string }>({
    queryKey: [`/api/posts/${post.id}/qr`],
    enabled: isQrDialogOpen,
  });

  const { data: users } = useQuery<User[]>({
    queryKey: ["/api/users"],
    staleTime: 60000,
  });

  const editPost = useMutation({
    mutationFn: async (data: { content: string; privacy: string }) => {
      const res = await fetch(`/api/posts/${post.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
        credentials: "include",
      });

      if (!res.ok) {
        throw new Error(await res.text());
      }

      return res.json();
    },
    onSuccess: () => {
      setIsEditing(false);
      queryClient.invalidateQueries({ queryKey: ["/api/posts"] });
      if (post.user.id) {
        queryClient.invalidateQueries({ queryKey: [`/api/posts/user/${post.user.id}`] });
      }
      toast({
        title: "Success",
        description: "Post updated successfully",
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

  const deletePost = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/posts/${post.id}`, {
        method: "DELETE",
        credentials: "include",
      });

      if (!res.ok) {
        throw new Error(await res.text());
      }

      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/posts"] });
      if (post.user.id) {
        queryClient.invalidateQueries({ queryKey: [`/api/posts/user/${post.user.id}`] });
      }
      toast({
        title: "Success",
        description: "Post deleted successfully",
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

  const handleSaveEdit = (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!editedContent.trim()) return;
    editPost.mutate({ content: editedContent, privacy: editedPrivacy });
  };

  const renderContent = (content: string) => {
    const parts = content.split(/(@\w+)/g);
    return parts.map((part, index) => {
      if (part.startsWith('@')) {
        const username = part.slice(1);
        const mention = post.mentions.find(m => m.mentionedUser.username === username);

        if (mention) {
          return (
            <Link key={index} href={`/profile/${mention.mentionedUser.id}`}>
              <span className="text-primary hover:underline cursor-pointer">
                {part}
              </span>
            </Link>
          );
        }
      }
      return part;
    });
  };

  const isOwner = currentUser?.id === post.user.id;

  const createInitialState = () => {
    const mentionEditorState = {
      root: {
        children: [{
          children: post.content.split(/(@\w+)/g).map(part => {
            if (part.startsWith('@')) {
              const username = part.slice(1);
              const mention = post.mentions.find(m => m.mentionedUser.username === username);
              if (mention) {
                return {
                  type: "mention",
                  mentionName: username,
                  text: part,
                  detail: 0,
                  format: 0,
                  mode: "normal",
                  style: "",
                  version: 1
                };
              }
            }
            return {
              type: "text",
              text: part,
              detail: 0,
              format: 0,
              mode: "normal",
              style: ""
            };
          }),
          direction: null,
          format: "",
          indent: 0,
          type: "paragraph",
          version: 1
        }],
        direction: null,
        format: "",
        indent: 0,
        type: "root",
        version: 1
      }
    };
    return JSON.stringify(mentionEditorState);
  };

  const renderPrivacyIcon = () => {
    switch (post.privacy) {
      case 'private':
        return <Lock className="h-4 w-4 text-muted-foreground" aria-label="Private post" />;
      case 'friends':
        return <Users className="h-4 w-4 text-muted-foreground" aria-label="Friends only post" />;
      default:
        return <Globe className="h-4 w-4 text-muted-foreground" aria-label="Public post" />;
    }
  };

  return (
    <>
      <Card>
        <CardHeader className="flex flex-row items-center gap-4 space-y-0">
          <Link href={`/profile/${post.user.id}`}>
            <Avatar className="h-10 w-10 cursor-pointer">
              <AvatarImage src={post.user.avatar || `https://api.dicebear.com/7.x/avatars/svg?seed=${post.user.username}`} />
              <AvatarFallback>{post.user.username[0]}</AvatarFallback>
            </Avatar>
          </Link>
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <Link href={`/profile/${post.user.id}`}>
                <span className="text-muted-foreground hover:underline cursor-pointer">
                  {post.user.username}
                </span>
              </Link>
              {post.group && (
                <>
                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  <Link href={`/groups/${post.group.id}`}>
                    <span className="font-semibold text-primary hover:underline cursor-pointer">
                      {post.group.name}
                    </span>
                  </Link>
                </>
              )}
              {renderPrivacyIcon()}
            </div>
            <p className="text-sm text-muted-foreground">
              {formatDistanceToNow(new Date(post.createdAt!), { addSuffix: true })}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Link href={`/post/${post.id}`}>
              <Button variant="ghost" size="icon" className="h-8 w-8">
                <LinkIcon className="h-4 w-4" />
              </Button>
            </Link>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8">
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => setIsQrDialogOpen(true)}>
                  <QrCode className="h-4 w-4 mr-2" />
                  Show QR Code
                </DropdownMenuItem>
                {isOwner && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={() => setIsEditing(true)}>
                      Edit
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      className="text-destructive"
                      onClick={() => deletePost.mutate()}
                    >
                      Delete
                    </DropdownMenuItem>
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
            <StatusPill status={post.status as Status} postId={post.id} />
          </div>
        </CardHeader>
        <CardContent>
          {isEditing ? (
            <form onSubmit={handleSaveEdit} className="space-y-4">
              <Select
                value={editedPrivacy}
                onValueChange={setEditedPrivacy}
                disabled={!!post.groupId}
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
              <LexicalEditor
                onChange={setEditedContent}
                users={users || []}
                initialState={createInitialState()}
                onSubmit={handleSaveEdit}
                autoFocus
              />
              <div className="flex justify-end gap-2">
                <Button
                  type="submit"
                  disabled={!editedContent.trim() || editPost.isPending}
                >
                  Save
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsEditing(false)}
                >
                  Cancel
                </Button>
              </div>
            </form>
          ) : (
            <p className="whitespace-pre-wrap">{renderContent(post.content)}</p>
          )}
        </CardContent>
        <Collapsible open={isCommentsOpen} onOpenChange={setIsCommentsOpen}>
          <CardFooter className="flex-col gap-4">
            <div className="w-full flex items-center gap-4">
              <LikeButton
                postId={post.id}
                initialLiked={post.liked}
                initialLikeCount={post.likeCount}
              />
              <StarButton
                postId={post.id}
                initialStarred={post.starred}
              />
              <FollowButton postId={post.id} />
              <CollapsibleTrigger asChild>
                <Button variant="ghost" size="sm" className="gap-1.5">
                  <MessageSquare className="h-4 w-4" />
                  <span className="text-muted-foreground">
                    {commentCount?.count || 0}
                  </span>
                </Button>
              </CollapsibleTrigger>
            </div>
            <CollapsibleContent className="w-full -mx-6">
              <CommentSection postId={post.id} />
            </CollapsibleContent>
          </CardFooter>
        </Collapsible>
        <div className="border-t">
          <RelatedPosts postId={post.id} />
        </div>
      </Card>

      <Dialog open={isQrDialogOpen} onOpenChange={setIsQrDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Post QR Code</DialogTitle>
          </DialogHeader>
          <div className="flex justify-center p-4">
            {qrCode?.qrCode && (
              <img src={qrCode.qrCode} alt="Post QR Code" className="max-w-full h-auto" />
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}