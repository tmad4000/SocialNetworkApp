import { Button } from "@/components/ui/button";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { Check, Clock, Loader2, MinusCircle } from "lucide-react";

type Status = 'none' | 'not acknowledged' | 'acknowledged' | 'in progress' | 'done';

const statusConfig = {
  none: {
    icon: MinusCircle,
    color: 'text-muted-foreground',
    bg: 'bg-muted',
    next: 'not acknowledged' as Status,
  },
  'not acknowledged': {
    icon: Clock,
    color: 'text-yellow-500',
    bg: 'bg-yellow-100',
    next: 'acknowledged' as Status,
  },
  acknowledged: {
    icon: Check,
    color: 'text-yellow-500',
    bg: 'bg-yellow-100',
    next: 'in progress' as Status,
  },
  'in progress': {
    icon: Loader2,
    color: 'text-blue-500',
    bg: 'bg-blue-100',
    next: 'done' as Status,
  },
  done: {
    icon: Check,
    color: 'text-green-500',
    bg: 'bg-green-100',
    next: 'none' as Status,
  },
};

interface StatusPillProps {
  status: Status;
  postId: number;
}

export default function StatusPill({ status, postId }: StatusPillProps) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const config = statusConfig[status];
  const Icon = config.icon;

  const updateStatus = useMutation({
    mutationFn: async (newStatus: Status) => {
      const res = await fetch(`/api/posts/${postId}/status`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
        credentials: "include",
      });

      if (!res.ok) {
        throw new Error(await res.text());
      }

      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/posts"] });
      queryClient.invalidateQueries({ queryKey: ["/api/posts/user"] });
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
    <Button
      variant="outline"
      size="sm"
      className={`${config.bg} hover:${config.bg} ${config.color} gap-1.5`}
      onClick={() => updateStatus.mutate(config.next)}
      disabled={updateStatus.isPending}
    >
      <Icon className="h-4 w-4" />
      <span className="capitalize">{status === 'none' ? 'Set Status' : status}</span>
    </Button>
  );
}

export type { Status };