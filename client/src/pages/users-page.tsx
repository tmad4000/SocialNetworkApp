import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Loader2, Users, Search } from "lucide-react";
import type { User } from "@db/schema";
import { Button } from "@/components/ui/button";
import FriendRequest from "@/components/friend-request";
import { useUser } from "@/hooks/use-user";
import { Input } from "@/components/ui/input";
import { useState, useMemo } from "react";

export default function UsersPage() {
  const { user: currentUser } = useUser();
  const [searchQuery, setSearchQuery] = useState("");

  const { data: users, isLoading } = useQuery<(Pick<User, "id" | "username" | "avatar" | "bio">)[]>({
    queryKey: ["/api/users"],
  });

  const { data: friends } = useQuery({
    queryKey: ["/api/friends"],
  });

  const filteredUsers = useMemo(() => {
    if (!users) return [];
    if (!searchQuery.trim()) return users;

    const query = searchQuery.toLowerCase();
    return users.filter(user => 
      user.username.toLowerCase().includes(query) || 
      user.bio?.toLowerCase().includes(query)
    );
  }, [users, searchQuery]);

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

      <div className="relative mb-6">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search users by name or bio..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-10"
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {filteredUsers.map((user) => {
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

        {filteredUsers.length === 0 && (
          <div className="col-span-full text-center py-8 text-muted-foreground">
            No users found matching your search.
          </div>
        )}
      </div>
    </div>
  );
}