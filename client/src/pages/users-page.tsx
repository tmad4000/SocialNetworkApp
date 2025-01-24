import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Loader2, Users } from "lucide-react";
import type { User } from "@db/schema";
import { Button } from "@/components/ui/button";

export default function UsersPage() {
  const { data: users, isLoading } = useQuery<(Pick<User, "id" | "username" | "avatar" | "bio">)[]>({
    queryKey: ["/api/users"],
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
        {users?.map((user) => (
          <Card key={user.id} className="hover:bg-accent transition-colors">
            <Link href={`/profile/${user.id}`}>
              <CardContent className="p-6 cursor-pointer">
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
                    <h2 className="font-semibold truncate">{user.username}</h2>
                    {user.bio && (
                      <p className="text-sm text-muted-foreground line-clamp-2">
                        {user.bio}
                      </p>
                    )}
                  </div>
                </div>
              </CardContent>
            </Link>
          </Card>
        ))}
      </div>
    </div>
  );
}
