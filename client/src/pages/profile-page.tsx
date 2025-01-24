import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRoute } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import PostCard from "@/components/post-card";
import CreatePost from "@/components/create-post";
import FriendRequest from "@/components/friend-request";
import { useUser } from "@/hooks/use-user";
import type { User, Post, Friend } from "@db/schema";

export default function ProfilePage() {
  const queryClient = useQueryClient();
  const [, params] = useRoute("/profile/:id");
  const { user: currentUser } = useUser();

  const { data: user, isLoading: userLoading } = useQuery<User>({
    queryKey: [`/api/user/${params?.id}`],
  });

  const { data: posts, isLoading: postsLoading } = useQuery<(Post & { user: User })[]>({
    queryKey: [`/api/posts/user/${params?.id}`],
  });

  const { data: friends, isLoading: friendsLoading } = useQuery<Friend[]>({
    queryKey: ["/api/friends"],
  });

  if (userLoading || postsLoading || friendsLoading) {
    return (
      <div className="flex justify-center p-8">
        <Loader2 className="h-8 w-8 animate-spin text-border" />
      </div>
    );
  }

  if (!user) return null;

  const isOwnProfile = currentUser?.id === user.id;
  const friendStatus = friends?.find(
    f => (f.userId === currentUser?.id && f.friendId === user.id) ||
         (f.userId === user.id && f.friendId === currentUser?.id)
  );

  return (
    <div className="max-w-4xl mx-auto">
      <Card className="mb-8">
        <CardContent className="flex items-center gap-6 p-6">
          <Avatar className="h-24 w-24">
            <AvatarImage src={user.avatar || `https://api.dicebear.com/7.x/avatars/svg?seed=${user.username}`} />
            <AvatarFallback>{user.username[0]}</AvatarFallback>
          </Avatar>

          <div className="flex-1">
            <h1 className="text-2xl font-bold">{user.username}</h1>
            <p className="text-muted-foreground">{user.bio || "No bio yet"}</p>
          </div>

          {!isOwnProfile && (
            <FriendRequest userId={user.id} status={friendStatus?.status} />
          )}
        </CardContent>
      </Card>

      {isOwnProfile && (
        <div className="mb-8">
          <CreatePost onSuccess={() => {
            queryClient.invalidateQueries({ queryKey: [`/api/posts/user/${params?.id}`] });
          }} />
        </div>
      )}

      <div className="space-y-6">
        {posts?.map((post) => (
          <PostCard key={post.id} post={post} />
        ))}
      </div>
    </div>
  );
}