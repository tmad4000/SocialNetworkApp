import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Loader2 } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";

interface CommentLikesModalProps {
  commentId: number;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface Like {
  id: number;
  user: {
    id: number;
    username: string;
    avatar: string | null;
  };
}

export default function CommentLikesModal({ commentId, open, onOpenChange }: CommentLikesModalProps) {
  const { data: likes, isLoading } = useQuery<Like[]>({
    queryKey: [`/api/comments/${commentId}/likes`],
    enabled: open,
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Liked by</DialogTitle>
        </DialogHeader>
        {isLoading ? (
          <div className="flex justify-center p-8">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : !likes?.length ? (
          <p className="text-center text-muted-foreground py-8">No likes yet</p>
        ) : (
          <div className="space-y-4 max-h-[300px] overflow-y-auto p-1">
            {likes.map((like) => (
              <Link 
                key={like.id} 
                href={`/profile/${like.user.id}`}
                className="flex items-center gap-3 p-2 rounded-lg hover:bg-accent"
              >
                <Avatar className="h-10 w-10">
                  <AvatarImage 
                    src={like.user.avatar || `https://api.dicebear.com/7.x/avatars/svg?seed=${like.user.username}`}
                  />
                  <AvatarFallback>{like.user.username[0]}</AvatarFallback>
                </Avatar>
                <span className="font-medium">{like.user.username}</span>
              </Link>
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
