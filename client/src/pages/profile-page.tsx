import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { useRoute } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { Loader2, Users, Pencil } from "lucide-react";
import PostCard from "@/components/post-card";
import CreatePost from "@/components/create-post";
import FriendRequest from "@/components/friend-request";
import { useUser } from "@/hooks/use-user";
import { useToast } from "@/hooks/use-toast";
import type { User, Post, Friend, PostMention } from "@db/schema";
import { Link } from "wouter";
import { useState } from "react";

export default function ProfilePage() {
  const [isEditingBio, setIsEditingBio] = useState(false);
  const [newBio, setNewBio] = useState("");
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [, params] = useRoute("/profile/:id");
  const { user: currentUser } = useUser();

  const { data: user, isLoading: userLoading } = useQuery<User>({
    queryKey: [`/api/user/${params?.id}`],
  });

  const updateBio = useMutation({
    mutationFn: async (bio: string) => {
      const res = await fetch("/api/user/bio", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bio }),
        credentials: "include",
      });

      if (!res.ok) {
        throw new Error(await res.text());
      }

      return res.json();
    },
    onSuccess: () => {
      setIsEditingBio(false);
      queryClient.invalidateQueries({ queryKey: [`/api/user/${params?.id}`] });
      toast({
        title: "Success",
        description: "Bio updated successfully",
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

  const { data: posts, isLoading: postsLoading } = useQuery<(Post & { 
    user: User;
    mentions: (PostMention & { mentionedUser: User })[];
  })[]>({
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
  const friendRequest = friends?.find(
    f => (f.userId === currentUser?.id && f.friendId === user.id) ||
         (f.userId === user.id && f.friendId === currentUser?.id)
  );

  const handleStartEdit = () => {
    setNewBio(user.bio || "");
    setIsEditingBio(true);
  };

  const handleSaveBio = (e: React.FormEvent) => {
    e.preventDefault();
    updateBio.mutate(newBio);
  };

  const acceptedFriends = friends?.reduce<{ id: number; username: string; avatar: string | null }[]>((acc, f) => {
    if (f.status === 'accepted') {
      if (f.friendId === user.id) {
        acc.push({ id: f.user.id, username: f.user.username, avatar: f.user.avatar });
      }
      if (f.userId === user.id) {
        acc.push({ id: f.friend.id, username: f.friend.username, avatar: f.friend.avatar });
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

            {isEditingBio ? (
              <form onSubmit={handleSaveBio} className="mt-2 space-y-2">
                <Textarea 
                  value={newBio}
                  onChange={(e) => setNewBio(e.target.value)}
                  placeholder="Write something about yourself..."
                  className="min-h-[100px]"
                />
                <div className="flex gap-2">
                  <Button type="submit" disabled={updateBio.isPending}>
                    Save
                  </Button>
                  <Button 
                    type="button" 
                    variant="outline" 
                    onClick={() => setIsEditingBio(false)}
                  >
                    Cancel
                  </Button>
                </div>
              </form>
            ) : (
              <div className="flex items-start gap-2">
                <p className="text-muted-foreground flex-1">
                  {user.bio || "No bio yet"}
                </p>
                {isOwnProfile && (
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={handleStartEdit}
                    className="flex-shrink-0"
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                )}
              </div>
            )}
          </div>

          {!isOwnProfile && (
            <FriendRequest userId={user.id} status={friendRequest?.status} />
          )}
        </CardContent>
      </Card>

      <Card className="mb-8">
        <CardContent className="p-6">
          <div className="flex items-center gap-2 mb-4">
            <Users className="h-5 w-5" />
            <h2 className="text-xl font-semibold">Friends</h2>
          </div>

          {!acceptedFriends?.length ? (
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

      <div className="space-y-6">
        <Separator className="my-8" />
        <h2 className="text-2xl font-semibold">Posts</h2>

        <CreatePost 
          targetUserId={!isOwnProfile ? user.id : undefined}
          onSuccess={() => {
            queryClient.invalidateQueries({ queryKey: [`/api/posts/user/${params?.id}`] });
          }} 
        />

        <div className="space-y-6">
          {posts?.map((post) => (
            <PostCard key={post.id} post={post} />
          ))}
          {!posts?.length && (
            <p className="text-muted-foreground text-center py-8">No posts yet</p>
          )}
        </div>
      </div>
    </div>
  );
}