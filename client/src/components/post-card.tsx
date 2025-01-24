import { Card, CardHeader, CardContent, CardFooter } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { formatDistanceToNow } from "date-fns";
import { Link } from "wouter";
import type { Post, User } from "@db/schema";

interface PostCardProps {
  post: Post & {
    user: User;
  };
}

export default function PostCard({ post }: PostCardProps) {
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
            {formatDistanceToNow(new Date(post.createdAt), { addSuffix: true })}
          </p>
        </div>
      </CardHeader>
      <CardContent>
        <p className="whitespace-pre-wrap">{post.content}</p>
      </CardContent>
    </Card>
  );
}
