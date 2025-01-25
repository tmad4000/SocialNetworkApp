// userspage.tsx
import { useState, useEffect, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import Fuse from "fuse.js"; // or use script tag from fusejs.io
import { Loader2, Users, Search } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import FriendRequest from "@/components/friend-request";
import { useUser } from "@/hooks/use-user";
import type { User } from "@db/schema";

export default function UsersPage() {
  const { user: currentUser } = useUser();
  const [searchQuery, setSearchQuery] = useState("");

  // fetch users + friend data from your api
  const { data: users, isLoading } = useQuery<(Pick<User, "id" | "username" | "avatar" | "bio">)[]>({
    queryKey: ["/api/users"],
  });
  const { data: friends } = useQuery({
    queryKey: ["/api/friends"],
  });

  // fuse instance
  const [fuse, setFuse] = useState<Fuse<Pick<User, "id" | "username" | "avatar" | "bio">>>();

  // create fuse index once we have users
  useEffect(() => {
    if (!users) return;
    const options: Fuse.IFuseOptions<Pick<User, "id" | "username" | "avatar" | "bio">> = {
      keys: ["username", "bio"], // search these fields
      threshold: 0.3, // tweak fuzziness
      includeScore: true,
    };
    setFuse(new Fuse(users, options));
  }, [users]);

  // filter/fuzzy search the users
  const filteredUsers = useMemo(() => {
    if (!fuse || !users) return [];
    const q = searchQuery.trim();
    if (!q) return users; // no search query → return all
    const results = fuse.search(q);
    // fuse returns array of { item, score }
    return results.map(r => r.item);
  }, [fuse, users, searchQuery]);

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
        <h1 className="text-2xl font-bold">browse users</h1>
      </div>

      <div className="relative mb-6">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="fuzzy search users..."
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          className="pl-10"
        />
      </div>

      {filteredUsers.length === 0 && (
        <div className="col-span-full text-center py-8 text-muted-foreground">
          no matching users
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {filteredUsers.map(u => {
          const friendRequest = friends?.find(
            (f) =>
              (f.userId === currentUser?.id && f.friendId === u.id) ||
              (f.userId === u.id && f.friendId === currentUser?.id)
          );

          return (
            <Card key={u.id} className="hover:bg-accent transition-colors">
              <CardContent className="p-6">
                <div className="flex items-center gap-4">
                  <Avatar className="h-12 w-12">
                    <AvatarImage
                      src={
                        u.avatar ||
                        `https://api.dicebear.com/7.x/avatars/svg?seed=${u.username}`
                      }
                    />
                    <AvatarFallback>{u.username[0]}</AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <Link href={`/profile/${u.id}`}>
                      <h2 className="font-semibold truncate cursor-pointer hover:underline">
                        {u.username}
                      </h2>
                    </Link>
                    {u.bio && (
                      <p className="text-sm text-muted-foreground line-clamp-2">
                        {u.bio}
                      </p>
                    )}
                  </div>
                </div>
                <div className="mt-4">
                  <FriendRequest
                    userId={u.id}
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