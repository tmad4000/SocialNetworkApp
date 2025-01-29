import { useState } from "react";
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useUser } from "@/hooks/use-user";
import { useToast } from "@/hooks/use-toast";
import LexicalEditor from "./lexical-editor";
import RelatedPosts from "./related-posts";
import type { Group } from "@db/schema";
import StarButton from "@/components/ui/star-button";
import { SharePostModal } from "@/components/share-post-modal";


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
  const [editedPrivacy, setEditedPrivacy] = useState(post.privacy || 'public');
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

  const { data: groups } = useQuery<Group[]>({
    queryKey: ["/api/groups"],
    staleTime: 60000,
  });

  const editPost = useMutation({
    mutationFn: async (data: { content?: string; privacy?: string }) => {
      console.log('Updating post with data:', data); // Debug log

      const requestBody = {
        content: data.content || post.content, // Always include content
        privacy: data.privacy || post.privacy, // Always include privacy
      };

      console.log('Request body:', requestBody); // Debug log

      const res = await fetch(`/api/posts/${post.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(requestBody),
        credentials: "include",
      });

      if (!res.ok) {
        const errorText = await res.text();
        console.error('Error updating post:', errorText); // Debug log
        throw new Error(errorText);
      }

      const responseData = await res.json();
      console.log('Server response:', responseData); // Debug log
      return responseData;
    },
    onMutate: async (newData) => {
      await queryClient.cancelQueries({ queryKey: ["/api/posts"] });
      if (post.groupId) {
        await queryClient.cancelQueries({ queryKey: [`/api/groups/${post.groupId}/posts`] });
      }
      if (post.user.id) {
        await queryClient.cancelQueries({ queryKey: [`/api/posts/user/${post.user.id}`] });
      }

      const previousData = {
        posts: queryClient.getQueryData<any[]>(["/api/posts"]),
        userPosts: queryClient.getQueryData<any[]>([`/api/posts/user/${post.user.id}`]),
        groupPosts: post.groupId ? queryClient.getQueryData<any[]>([`/api/groups/${post.groupId}/posts`]) : undefined
      };

      const updatePostInCache = (oldPosts: any[] = []) => {
        return oldPosts.map(p => {
          if (p.id === post.id) {
            return {
              ...p,
              ...(newData.content !== undefined && { content: newData.content }),
              ...(newData.privacy !== undefined && { privacy: newData.privacy }),
            };
          }
          return p;
        });
      };

      if (previousData.posts) {
        queryClient.setQueryData(["/api/posts"], updatePostInCache(previousData.posts));
      }
      if (previousData.userPosts) {
        queryClient.setQueryData([`/api/posts/user/${post.user.id}`], updatePostInCache(previousData.userPosts));
      }
      if (previousData.groupPosts) {
        queryClient.setQueryData([`/api/groups/${post.groupId}/posts`], updatePostInCache(previousData.groupPosts));
      }

      return previousData;
    },
    onSuccess: (data) => {
      console.log('Mutation succeeded with data:', data); // Debug log

      const updateQueries = [
        { queryKey: ["/api/posts"] },
        post.user.id ? { queryKey: [`/api/posts/user/${post.user.id}`] } : null,
        post.groupId ? { queryKey: [`/api/groups/${post.groupId}/posts`] } : null
      ].filter(Boolean);

      updateQueries.forEach(({ queryKey }) => {
        queryClient.setQueryData(queryKey, (oldData: any[] = []) => {
          if (!oldData) return oldData;
          return oldData.map(p => p.id === post.id ? { ...p, ...data } : p);
        });
      });

      toast({
        title: "Success",
        description: "Post updated successfully",
      });
    },
    onError: (error, _, context) => {
      console.error('Mutation error:', error); // Debug log

      if (context?.posts) {
        queryClient.setQueryData(["/api/posts"], context.posts);
      }
      if (context?.userPosts) {
        queryClient.setQueryData([`/api/posts/user/${post.user.id}`], context.userPosts);
      }
      if (context?.groupPosts && post.groupId) {
        queryClient.setQueryData([`/api/groups/${post.groupId}/posts`], context.groupPosts);
      }

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
      if (post.groupId) {
        queryClient.invalidateQueries({ queryKey: [`/api/groups/${post.groupId}/posts`] });
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

  const handlePrivacyChange = (newPrivacy: string) => {
    console.log('Changing privacy to:', newPrivacy); // Debug log
    setEditedPrivacy(newPrivacy);
    editPost.mutate({
      privacy: newPrivacy,
      content: post.content // Always include current content
    });
  };

  const renderContent = (content: string) => {
    const parts = content.split(/(@[\w-]+)/g);
    return parts.map((part, index) => {
      if (part.startsWith('@')) {
        const name = part.slice(1);
        const userMention = post.mentions?.find(m => m.mentionedUser?.username === name);
        if (userMention) {
          return (
            <Link key={index} href={`/profile/${userMention.mentionedUser.id}`}>
              <span className="text-primary hover:underline cursor-pointer">
                {part}
              </span>
            </Link>
          );
        }

        // Improve group mention check and styling
        const groupMention = groups?.find(g => g.name.toLowerCase() === name.toLowerCase());
        if (groupMention) {
          return (
            <Link key={index} href={`/groups/${groupMention.id}`}>
              <span className="text-primary font-semibold hover:underline cursor-pointer">
                @{groupMention.name}
              </span>
            </Link>
          );
        }
      }
      return <span key={index}>{part}</span>;
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
              const mention = post.mentions?.find(m => m.mentionedUser?.username === username);
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
    const isOwner = currentUser?.id === post.user.id;
    const icon = (() => {
      switch (post.privacy) {
        case 'private':
          return <Lock className="h-4 w-4" aria-label="Private post" />;
        case 'friends':
          return <Users className="h-4 w-4" aria-label="Friends only post" />;
        default:
          return <Globe className="h-4 w-4" aria-label="Public post" />;
      }
    })();

    if (isOwner && !post.groupId) {
      return (
        <Popover>
          <PopoverTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className={`p-0 h-4 hover:bg-transparent ${editPost.isPending ? 'opacity-50' : ''}`}
              disabled={editPost.isPending}
            >
              {icon}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-40 p-0">
            <div className="space-y-1 p-1">
              <Button
                variant={post.privacy === 'public' ? 'secondary' : 'ghost'}
                size="sm"
                className="w-full justify-start gap-2"
                onClick={() => handlePrivacyChange('public')}
              >
                <Globe className="h-4 w-4" />
                <span>Public</span>
              </Button>
              <Button
                variant={post.privacy === 'friends' ? 'secondary' : 'ghost'}
                size="sm"
                className="w-full justify-start gap-2"
                onClick={() => handlePrivacyChange('friends')}
              >
                <Users className="h-4 w-4" />
                <span>Friends</span>
              </Button>
              <Button
                variant={post.privacy === 'private' ? 'secondary' : 'ghost'}
                size="sm"
                className="w-full justify-start gap-2"
                onClick={() => handlePrivacyChange('private')}
              >
                <Lock className="h-4 w-4" />
                <span>Private</span>
              </Button>
            </div>
          </PopoverContent>
        </Popover>
      );
    }

    return (
      <span className="text-muted-foreground">
        {icon}
      </span>
    );
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
              <div className="flex justify-between items-center">
                <div className="flex-1">
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
                </div>
              </div>
              <LexicalEditor
                onChange={setEditedContent}
                users={users || []}
                initialState={createInitialState()}
                onSubmit={handleSaveEdit}
                autoFocus
              />
              <div className="flex justify-end gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsEditing(false)}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={!editedContent.trim() || editPost.isPending}
                >
                  Save
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
              <SharePostModal postId={post.id} />
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
          <RelatedPosts
            postId={post.id}
            groupId={post.groupId || undefined}
            userId={post.user.id}
          />
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