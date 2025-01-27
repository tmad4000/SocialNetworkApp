import { Button } from "@/components/ui/button";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { Check, Clock, Loader2, MinusCircle } from "lucide-react";

export type Status = 'none' | 'not acknowledged' | 'acknowledged' | 'in progress' | 'done';

const statusConfig = {
  none: {
    icon: MinusCircle,
    color: 'text-muted-foreground',
    bg: 'bg-muted/50',
    next: 'not acknowledged' as Status,
  },
  'not acknowledged': {
    icon: Clock,
    color: 'text-gray-700 dark:text-gray-300',
    bg: 'bg-gray-200 dark:bg-gray-800',
    next: 'acknowledged' as Status,
  },
  acknowledged: {
    icon: Check,
    color: 'text-yellow-600 dark:text-yellow-400',
    bg: 'bg-yellow-100 dark:bg-yellow-900/50',
    next: 'in progress' as Status,
  },
  'in progress': {
    icon: Loader2,
    color: 'text-blue-600 dark:text-blue-400',
    bg: 'bg-blue-100 dark:bg-blue-900/50',
    next: 'done' as Status,
  },
  done: {
    icon: Check,
    color: 'text-green-600 dark:text-green-400',
    bg: 'bg-green-100 dark:bg-green-900/50',
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
            queryKey.startsWith("/api/posts/user/") ||
            queryKey.startsWith("/api/groups/")
          );
        }
      });

      // Get snapshot of current data
      const previousData = new Map();
      queryClient.getQueriesData({ 
        predicate: (query) => {
          const queryKey = query.queryKey[0];
          return typeof queryKey === 'string' && (
            queryKey === "/api/posts" || 
            queryKey.startsWith("/api/posts/user/") ||
            queryKey.startsWith("/api/groups/")
          );
        }
      }).forEach(([queryKey, data]) => {
        previousData.set(JSON.stringify(queryKey), data);
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
            queryKey.startsWith("/api/posts/user/") ||
            queryKey.startsWith("/api/groups/")
          );
        }
      }).forEach(([queryKey]) => {
        queryClient.setQueryData(queryKey, (old: any) =>
          Array.isArray(old) ? old.map(updatePost) : old
        );
      });

      return { previousData };
    },
    onError: (err, newStatus, context) => {
      if (context?.previousData) {
        context.previousData.forEach((data, queryKeyStr) => {
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
  });

  return (
    <Button
      variant="outline"
      size="sm"
      className={`${config.bg} hover:${config.bg} ${config.color} gap-1.5`}
      onClick={() => !updateStatus.isPending && updateStatus.mutate(config.next)}
      disabled={updateStatus.isPending}
    >
      <Icon className={`h-4 w-4 ${status === 'in progress' ? "animate-spin" : ""}`} />
      <span className="capitalize">{status === 'none' ? 'Set Status' : status}</span>
    </Button>
  );
}

export type { Status };