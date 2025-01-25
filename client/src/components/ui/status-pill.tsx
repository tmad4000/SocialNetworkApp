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
    color: 'text-gray-700',
    bg: 'bg-gray-200',
    next: 'acknowledged' as Status,
  },
  acknowledged: {
    icon: Check,
    color: 'text-yellow-600',
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
    onMutate: async (newStatus) => {
      // Cancel any outgoing refetches
      await queryClient.cancelQueries({ 
        predicate: (query) => {
          const queryKey = query.queryKey[0];
          return typeof queryKey === 'string' && (
            queryKey === "/api/posts" || 
            queryKey.startsWith("/api/posts/user/")
          );
        }
      });

      // Snapshot the previous values
      const previousData: { [key: string]: any } = {};
      queryClient.getQueriesData({ 
        predicate: (query) => {
          const queryKey = query.queryKey[0];
          return typeof queryKey === 'string' && (
            queryKey === "/api/posts" || 
            queryKey.startsWith("/api/posts/user/")
          );
        }
      }).forEach(([queryKey, data]) => {
        if (Array.isArray(queryKey)) {
          const key = JSON.stringify(queryKey);
          previousData[key] = data;
        }
      });

      // Optimistically update all matching queries
      const updatePost = (post: any) => {
        if (post.id === postId) {
          return { ...post, status: newStatus };
        }
        return post;
      };

      queryClient.getQueriesData({ 
        predicate: (query) => {
          const queryKey = query.queryKey[0];
          return typeof queryKey === 'string' && (
            queryKey === "/api/posts" || 
            queryKey.startsWith("/api/posts/user/")
          );
        }
      }).forEach(([queryKey]) => {
        if (Array.isArray(queryKey)) {
          queryClient.setQueryData(queryKey, (old: any) =>
            Array.isArray(old) ? old.map(updatePost) : old
          );
        }
      });

      return { previousData };
    },
    onError: (err, newStatus, context) => {
      // Revert the optimistic update
      if (context) {
        Object.entries(context.previousData).forEach(([queryKeyStr, data]) => {
          const queryKey = JSON.parse(queryKeyStr);
          queryClient.setQueryData(queryKey, data);
        });
      }
      toast({
        variant: "destructive",
        title: "Error",
        description: err.message,
      });
    },
    onSettled: () => {
      // Refetch to ensure our optimistic update matches server state
      queryClient.invalidateQueries({ 
        predicate: (query) => {
          const queryKey = query.queryKey[0];
          return typeof queryKey === 'string' && (
            queryKey === "/api/posts" || 
            queryKey.startsWith("/api/posts/user/")
          );
        }
      });
    },
  });

  return (
    <Button
      variant="outline"
      size="sm"
      className={`${config.bg} hover:${config.bg} ${config.color} gap-1.5`}
      onClick={() => updateStatus.mutate(config.next)}
    >
      <Icon className={`h-4 w-4 ${updateStatus.isPending ? "animate-spin" : ""}`} />
      <span className="capitalize">{status === 'none' ? 'Set Status' : status}</span>
    </Button>
  );
}

export type { Status };