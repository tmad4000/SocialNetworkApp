import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useUser } from "@/hooks/use-user";

export default function Navbar() {
  const { user, logout } = useUser();

  return (
    <nav className="border-b">
      <div className="container mx-auto px-4 h-16 flex items-center justify-between">
        <Link href="/">
          <h1 className="text-xl font-bold cursor-pointer">Social Network</h1>
        </Link>

        <div className="flex items-center gap-4">
          <Link href={`/profile/${user?.id}`}>
            <Avatar className="h-8 w-8 cursor-pointer">
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
