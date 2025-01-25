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
import { MessageSquare, Link as LinkIcon } from "lucide-react";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";

interface PostCardProps {
  post: Post & {
    user: User;
    mentions: (PostMention & { mentionedUser: User })[];
    likeCount: number;
    liked: boolean;
  };
}

export default function PostCard({ post }: PostCardProps) {
  const [isCommentsOpen, setIsCommentsOpen] = useState(false);
  const { data: commentCount } = useQuery<{ count: number }>({
    queryKey: [`/api/posts/${post.id}/comments/count`],
    enabled: !isCommentsOpen,
  });

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

  return (
    <Card>
      <CardHeader className="flex flex-row items-center gap-4 space-y-0">
        <Link href={`/profile/${post.user.id}`}>
          <Avatar className="h-10 w-10 cursor-pointer">
            <AvatarImage src={post.user.avatar || `https://api.dicebear.com/7.x/avatars/svg?seed=${post.user.username}`} />
            <AvatarFallback>{post.user.username[0]}</AvatarFallback>
          </Avatar>
        </Link>
        <div className="flex-1">
          <Link href={`/profile/${post.user.id}`}>
            <span className="font-semibold hover:underline cursor-pointer">
              {post.user.username}
            </span>
          </Link>
          <p className="text-sm text-muted-foreground">
            {formatDistanceToNow(new Date(post.createdAt!), { addSuffix: true })}
          </p>
        </div>
        <Link href={`/post/${post.id}`}>
          <Button variant="ghost" size="icon" className="h-8 w-8">
            <LinkIcon className="h-4 w-4" />
          </Button>
        </Link>
        <StatusPill status={post.status as Status} postId={post.id} />
      </CardHeader>
      <CardContent>
        <p className="whitespace-pre-wrap">{renderContent(post.content)}</p>
      </CardContent>
      <Collapsible open={isCommentsOpen} onOpenChange={setIsCommentsOpen}>
        <CardFooter className="flex-col gap-4">
          <div className="w-full flex items-center gap-4">
            <LikeButton
              postId={post.id}
              initialLiked={post.liked}
              initialLikeCount={post.likeCount}
            />
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
    </Card>
  );
}