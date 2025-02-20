import { Button } from "@/components/ui/button";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { Bell } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";
import type { Friend, User } from "@db/schema";

export default function FriendRequestsMenu() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: friendRequests } = useQuery<(Friend & { user: User })[]>({
    queryKey: ["/api/friends"],
    select: (friends) => friends.filter(f => f.friendId === (queryClient.getQueryData(['user']) as User)?.id && f.status === 'pending'),
  });

  const acceptRequest = useMutation({
    mutationFn: async (requestId: number) => {
      const res = await fetch("/api/friends/accept", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ requestId }),
        credentials: "include",
      });

      if (!res.ok) {
        throw new Error(await res.text());
      }

      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/friends"] });
      toast({
        title: "Success",
        description: "Friend request accepted",
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

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="h-5 w-5" />
          {friendRequests && friendRequests.length > 0 && (
            <span className="absolute -top-1 -right-1 h-5 w-5 rounded-full bg-primary text-primary-foreground text-xs flex items-center justify-center">
              {friendRequests.length}
            </span>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-72">
        {!friendRequests?.length ? (
          <DropdownMenuItem disabled>
            No pending friend requests
          </DropdownMenuItem>
        ) : (
          friendRequests.map((request) => (
            <DropdownMenuItem key={request.id} className="flex items-center justify-between">
              <span>{request.user.username} wants to be friends</span>
              <Button
                size="sm"
                onClick={() => acceptRequest.mutate(request.id)}
                disabled={acceptRequest.isPending}
              >
                Accept
              </Button>
            </DropdownMenuItem>
          ))
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
