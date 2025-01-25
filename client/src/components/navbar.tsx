import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useUser } from "@/hooks/use-user";
import { Users, Sparkles } from "lucide-react";
import FriendRequestsMenu from "@/components/friend-requests-menu";
import { cn } from "@/lib/utils";

export default function Navbar() {
  const { user, logout } = useUser();
  const [location] = useLocation();

  return (
    <nav className="border-b">
      <div className="container mx-auto px-4 h-16 flex items-center justify-between">
        <Link href="/">
          <h1 className="text-xl font-bold cursor-pointer">Social Network</h1>
        </Link>

        <div className="flex items-center gap-4">
          <Link href="/users">
            <Button 
              variant={location === "/users" ? "secondary" : "ghost"} 
              size="sm" 
              className={cn(
                "gap-2",
                location === "/users" && "bg-accent"
              )}
            >
              <Users className="h-4 w-4" />
              Users
            </Button>
          </Link>
          <Link href="/matches">
            <Button 
              variant={location === "/matches" ? "secondary" : "ghost"} 
              size="sm" 
              className={cn(
                "gap-2",
                location === "/matches" && "bg-accent"
              )}
            >
              <Sparkles className="h-4 w-4" />
              Matches
            </Button>
          </Link>
          <FriendRequestsMenu />
          <Link href={`/profile/${user?.id}`}>
            <Avatar className={cn(
              "h-8 w-8 cursor-pointer",
              location === `/profile/${user?.id}` && "ring-2 ring-primary ring-offset-2"
            )}>
              <AvatarImage
                src={user?.avatar || `https://api.dicebear.com/7.x/avatars/svg?seed=${user?.username}`}
              />
              <AvatarFallback>{user?.username[0]}</AvatarFallback>
            </Avatar>
          </Link>
          <Button variant="ghost" onClick={() => logout()}>
            Logout
          </Button>
        </div>
      </div>
    </nav>
  );
}