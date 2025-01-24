import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRoute } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Loader2, Users } from "lucide-react";
import PostCard from "@/components/post-card";
import CreatePost from "@/components/create-post";
import FriendRequest from "@/components/friend-request";
import { useUser } from "@/hooks/use-user";
import type { User, Post, Friend } from "@db/schema";
import { Link } from "wouter";

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
    select: (friends) => friends.filter(f => f.status === 'accepted'),
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

  // Process friends list to get unique friend entries
  const acceptedFriends = friends?.reduce<{ id: number; username: string; avatar: string | null }[]>((acc, f) => {
    if (f.status === 'accepted') {
      // If current user is the friend
      if (f.friendId === user.id) {
        acc.push(f.user);
      }
      // If current user is the requester
      if (f.userId === user.id) {
        acc.push(f.friend);
      }
    }
    return acc;
  }, []);

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

      {/* Friends Section */}
      <Card className="mb-8">
        <CardContent className="p-6">
          <div className="flex items-center gap-2 mb-4">
            <Users className="h-5 w-5" />
            <h2 className="text-xl font-semibold">Friends</h2>
          </div>

          {acceptedFriends?.length === 0 ? (
            <p className="text-muted-foreground">No friends yet</p>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {acceptedFriends?.map((friend) => (
                <Link key={friend.id} href={`/profile/${friend.id}`}>
                  <div className="flex items-center gap-3 p-2 rounded-lg hover:bg-accent cursor-pointer">
                    <Avatar className="h-10 w-10">
                      <AvatarImage src={friend.avatar || `https://api.dicebear.com/7.x/avatars/svg?seed=${friend.username}`} />
                      <AvatarFallback>{friend.username[0]}</AvatarFallback>
                    </Avatar>
                    <span className="font-medium truncate">{friend.username}</span>
                  </div>
                </Link>
              ))}
            </div>
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