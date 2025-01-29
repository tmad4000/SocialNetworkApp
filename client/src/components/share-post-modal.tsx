import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem } from "@/components/ui/command";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Share2, Users } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useMutation, useQuery } from "@tanstack/react-query";

interface SharePostModalProps {
  postId: number;
  trigger?: React.ReactNode;
}

interface Target {
  id: number;
  name: string;
  type: "user" | "group";
  avatar?: string | null;
}

export function SharePostModal({ postId, trigger }: SharePostModalProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const { toast } = useToast();

  // Fetch users and groups for sharing
  const { data: users } = useQuery({
    queryKey: ["/api/users/search", search],
    enabled: search.length > 0,
  });

  const { data: groups } = useQuery({
    queryKey: ["/api/groups"],
    enabled: open,
  });

  // Combine and format targets
  const targets: Target[] = [
    ...(users?.map(user => ({
      id: user.id,
      name: user.username,
      type: "user" as const,
      avatar: user.avatar,
    })) || []),
    ...(groups?.map(group => ({
      id: group.id,
      name: group.name,
      type: "group" as const,
    })) || []),
  ];

  // Share mutation
  const { mutate: sharePost } = useMutation({
    mutationFn: async ({ targetId, targetType }: { targetId: number; targetType: "user" | "group" }) => {
      const response = await fetch(`/api/posts/${postId}/share`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetId, targetType }),
      });

      if (!response.ok) {
        throw new Error(await response.text());
      }

      return response.json();
    },
    onSuccess: (_, variables) => {
      toast({
        title: "Post shared successfully",
        description: `Post has been shared to ${variables.targetType === "user" ? "user" : "group"}`,
      });
      setOpen(false);
    },
    onError: (error) => {
      toast({
        title: "Failed to share post",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button variant="ghost" size="sm">
            <Share2 className="h-4 w-4 mr-2" />
            Share
          </Button>
        )}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Share post</DialogTitle>
        </DialogHeader>

        <Command className="rounded-lg border shadow-md">
          <CommandInput 
            placeholder="Search users or groups..." 
            value={search}
            onValueChange={setSearch}
          />
          <CommandEmpty>No results found.</CommandEmpty>
          <CommandGroup>
            {targets.map((target) => (
              <CommandItem
                key={`${target.type}-${target.id}`}
                onSelect={() => {
                  sharePost({ targetId: target.id, targetType: target.type });
                }}
                className="flex items-center gap-2 cursor-pointer"
              >
                {target.type === "user" ? (
                  <Avatar className="h-8 w-8">
                    <AvatarImage src={target.avatar || `https://api.dicebear.com/7.x/avatars/svg?seed=${target.name}`} />
                    <AvatarFallback>{target.name[0]}</AvatarFallback>
                  </Avatar>
                ) : (
                  <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                    <Users className="h-4 w-4 text-primary" />
                  </div>
                )}
                <div className="flex flex-col">
                  <span className="font-medium">{target.name}</span>
                  <span className="text-xs text-muted-foreground">
                    {target.type === "user" ? "User" : "Group"}
                  </span>
                </div>
              </CommandItem>
            ))}
          </CommandGroup>
        </Command>
      </DialogContent>
    </Dialog>
  );
}
