import { Button } from "@/components/ui/button";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { useUser } from "@/hooks/use-user";

interface FriendRequestProps {
  userId: number;
  status?: string;
  requestId?: number;
}

export default function FriendRequest({ userId, status, requestId }: FriendRequestProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { user: currentUser } = useUser();

  const sendRequest = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/friends/request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ friendId: userId }),
        credentials: "include",
      });

      if (!res.ok) {
        throw new Error(await res.text());
      }

      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/friends"] });
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
      toast({
        title: "Success",
        description: "Friend request sent",
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

  const dismissRequest = useMutation({
    mutationFn: async (requestId: number) => {
      const res = await fetch("/api/friends/dismiss", {
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
        description: "Friend request dismissed",
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

  if (status === "accepted") {
    return (
      <Button variant="secondary" disabled>
        Friends
      </Button>
    );
  }

  if (status === "pending") {
    // If we sent the request (we are the sender)
    if (currentUser?.id === userId) {
      return (
        <Button variant="outline" disabled>
          Pending
        </Button>
      );
    }

    // If we received the request (we are the recipient)
    return (
      <div className="flex gap-2">
        <Button
          onClick={() => acceptRequest.mutate(requestId!)}
          disabled={acceptRequest.isPending}
        >
          Confirm
        </Button>
        <Button
          variant="outline"
          onClick={() => dismissRequest.mutate(requestId!)}
          disabled={dismissRequest.isPending}
        >
          Dismiss
        </Button>
      </div>
    );
  }

  return (
    <Button
      onClick={() => sendRequest.mutate()}
      disabled={sendRequest.isPending}
    >
      Add Friend
    </Button>
  );
}