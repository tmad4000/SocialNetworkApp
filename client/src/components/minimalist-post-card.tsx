import { useState, useRef, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { Post, User, PostMention, Group } from "@db/schema";
import { useToast } from "@/hooks/use-toast";
import { useUser } from "@/hooks/use-user";

interface MinimalistPostCardProps {
  post: Post & {
    user: User;
    mentions: (PostMention & { mentionedUser: User })[];
    group?: Group;
    likeCount: number;
    liked: boolean;
    starred: boolean;
    privacy: string;
    manualOrder?: number;
  };
  onOrderChange: (newOrder: number) => void;
  onCreatePost: (content: string) => void;
}

export default function MinimalistPostCard({ 
  post, 
  onOrderChange,
  onCreatePost 
}: MinimalistPostCardProps) {
  const [content, setContent] = useState(post.content);
  const [isEditing, setIsEditing] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { user: currentUser } = useUser();
  const saveTimeoutRef = useRef<NodeJS.Timeout>();

  const updatePost = useMutation({
    mutationFn: async (newContent: string) => {
      const res = await fetch(`/api/posts/${post.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: newContent }),
        credentials: "include",
      });

      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/posts"] });
      if (post.groupId) {
        queryClient.invalidateQueries({ queryKey: [`/api/groups/${post.groupId}/posts`] });
      }
      if (post.user.id) {
        queryClient.invalidateQueries({ queryKey: [`/api/posts/user/${post.user.id}`] });
      }
    },
    onError: (error) => {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message,
      });
    },
  });

  useEffect(() => {
    if (isEditing && textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = textareaRef.current.scrollHeight + 'px';
    }
  }, [content, isEditing]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter') {
      if (e.shiftKey) {
        // Shift+Enter: Add new line
        return;
      } else {
        // Enter: Create new post
        e.preventDefault();
        onCreatePost("");
      }
    } else if (e.key === 'ArrowUp') {
      const textarea = e.currentTarget;
      if (textarea.selectionStart === 0) {
        // Move focus to previous post
        const prevTextarea = textarea.parentElement?.parentElement?.previousElementSibling?.querySelector('textarea');
        if (prevTextarea) {
          e.preventDefault();
          (prevTextarea as HTMLTextAreaElement).focus();
          (prevTextarea as HTMLTextAreaElement).selectionStart = (prevTextarea as HTMLTextAreaElement).value.length;
        }
      }
    } else if (e.key === 'ArrowDown') {
      const textarea = e.currentTarget;
      if (textarea.selectionStart === textarea.value.length) {
        // Move focus to next post
        const nextTextarea = textarea.parentElement?.parentElement?.nextElementSibling?.querySelector('textarea');
        if (nextTextarea) {
          e.preventDefault();
          (nextTextarea as HTMLTextAreaElement).focus();
          (nextTextarea as HTMLTextAreaElement).selectionStart = 0;
        }
      }
    } else if (e.key === 'Escape') {
      setContent(post.content);
      setIsEditing(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setContent(e.target.value);

    // Clear existing timeout
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    // Set new timeout for auto-save
    saveTimeoutRef.current = setTimeout(() => {
      if (e.target.value !== post.content) {
        updatePost.mutate(e.target.value);
      }
    }, 1000);
  };

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, []);

  const isOwner = currentUser?.id === post.user.id;

  return (
    <Card className={`transition-colors ${isEditing ? 'border-primary' : ''}`}>
      <CardContent className="p-1.5">
        <textarea
          ref={textareaRef}
          className="w-full resize-none bg-transparent outline-none"
          value={content}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          onFocus={() => setIsEditing(true)}
          onBlur={() => {
            setIsEditing(false);
            if (content !== post.content) {
              updatePost.mutate(content);
            }
          }}
          onClick={() => {
            if (isOwner) {
              setIsEditing(true);
              textareaRef.current?.focus();
            }
          }}
          readOnly={!isOwner}
          rows={1}
          style={{
            overflow: 'hidden',
          }}
        />
      </CardContent>
    </Card>
  );
}