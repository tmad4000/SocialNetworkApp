import { Card, CardHeader, CardContent, CardFooter } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { formatDistanceToNow } from "date-fns";
import { Link } from "wouter";
import type { Post, User, PostMention } from "@db/schema";

interface PostCardProps {
  post: Post & {
    user: User;
    mentions: (PostMention & { mentionedUser: User })[];
  };
}

export default function PostCard({ post }: PostCardProps) {
  const renderContent = (content: string) => {
    // Split content to preserve @ symbols and surrounding text
    const parts = content.split(/(\S*@\S*)/g);
    return parts.map((part, index) => {
      if (part.includes('@')) {
        // Check if this is a mention
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
        // Check if it's an email address
        if (part.includes('@') && part.includes('.')) {
          return (
            <a 
              key={index} 
              href={`mailto:${part}`} 
              className="text-primary hover:underline cursor-pointer"
            >
              {part}
            </a>
          );
        }
        // Any other @ content just gets styled blue
        return (
          <span key={index} className="text-primary">
            {part}
          </span>
        );
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
      </CardHeader>
      <CardContent>
        <p className="whitespace-pre-wrap">{renderContent(post.content)}</p>
      </CardContent>
    </Card>
  );
}