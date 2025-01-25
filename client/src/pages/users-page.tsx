import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Loader2, Users } from "lucide-react";
import type { User } from "@db/schema";
import { Button } from "@/components/ui/button";
import FriendRequest from "@/components/friend-request";
import { useUser } from "@/hooks/use-user";

export default function UsersPage() {
  const { user: currentUser } = useUser();
  const { data: users, isLoading } = useQuery<(Pick<User, "id" | "username" | "avatar" | "bio">)[]>({
    queryKey: ["/api/users"],
  });

  const { data: friends } = useQuery({
    queryKey: ["/api/friends"],
  });

  if (isLoading) {
    return (
      <div className="flex justify-center p-8">
        <Loader2 className="h-8 w-8 animate-spin text-border" />
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8">
      <div className="flex items-center gap-2 mb-8">
        <Users className="h-6 w-6" />
        <h1 className="text-2xl font-bold">Browse Users</h1>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {users?.map((user) => {
          const friendRequest = friends?.find(
            (f) =>
              (f.userId === currentUser?.id && f.friendId === user.id) ||
              (f.userId === user.id && f.friendId === currentUser?.id)
          );

          return (
            <Card key={user.id} className="hover:bg-accent transition-colors">
              <CardContent className="p-6">
                <div className="flex items-center gap-4">
                  <Avatar className="h-12 w-12">
                    <AvatarImage
                      src={
                        user.avatar ||
                        `https://api.dicebear.com/7.x/avatars/svg?seed=${user.username}`
                      }
                    />
                    <AvatarFallback>{user.username[0]}</AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <Link href={`/profile/${user.id}`}>
                      <h2 className="font-semibold truncate cursor-pointer hover:underline">
                        {user.username}
                      </h2>
                    </Link>
                    {user.bio && (
                      <p className="text-sm text-muted-foreground line-clamp-2">
                        {user.bio}
                      </p>
                    )}
                  </div>
                </div>
                <div className="mt-4">
                  <FriendRequest 
                    userId={user.id} 
                    status={friendRequest?.status}
                    requestId={friendRequest?.id}
                  />
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}