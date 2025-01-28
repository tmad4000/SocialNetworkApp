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
  onDelete: () => void;
}

export default function MinimalistPostCard({
  post,
  onOrderChange,
  onCreatePost,
  onDelete,
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
      textareaRef.current.focus();
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
      if (e.metaKey && e.shiftKey) { // Cmd+Shift+Up
        e.preventDefault();
        onOrderChange(post.manualOrder! - 1000);
        return;
      }

      const textarea = e.currentTarget;
      if (textarea.selectionStart === 0) {
        // Move focus to previous post
        const prevTextarea = textarea.parentElement?.parentElement?.previousElementSibling?.querySelector('textarea');
        if (prevTextarea) {
          e.preventDefault();
          (prevTextarea as HTMLTextAreaElement).focus();
          const prevCard = prevTextarea.closest('.cursor-pointer');
          if (prevCard) {
            prevCard.dispatchEvent(new Event('click', { bubbles: true }));
          }
          (prevTextarea as HTMLTextAreaElement).selectionStart = (prevTextarea as HTMLTextAreaElement).value.length;
        }
      }
    } else if (e.key === 'ArrowDown') {
      if (e.metaKey && e.shiftKey) { // Cmd+Shift+Down
        e.preventDefault();
        onOrderChange(post.manualOrder! + 1000);
        return;
      }

      const textarea = e.currentTarget;
      if (textarea.selectionStart === textarea.value.length) {
        // Move focus to next post
        const nextTextarea = textarea.parentElement?.parentElement?.nextElementSibling?.querySelector('textarea');
        if (nextTextarea) {
          e.preventDefault();
          (nextTextarea as HTMLTextAreaElement).focus();
          const nextCard = nextTextarea.closest('.cursor-pointer');
          if (nextCard) {
            nextCard.dispatchEvent(new Event('click', { bubbles: true }));
          }
          (nextTextarea as HTMLTextAreaElement).selectionStart = 0;
        }
      }
    } else if (e.key === 'Escape') {
      setContent(post.content);
      setIsEditing(false);
    } else if (e.key === 'Backspace') {
      const textarea = e.currentTarget;
      if (textarea.selectionStart === 0 && textarea.selectionEnd === 0) {
        e.preventDefault();
        onDelete();
      }
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setContent(e.target.value);
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = textareaRef.current.scrollHeight + 'px';
    }

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
    <Card
      className={`transition-colors cursor-pointer border-t-0 first:border-t rounded-none ${isEditing ? 'border-primary' : ''}`}
      onClick={() => {
        if (isOwner) {
          setIsEditing(true);
        }
      }}
    >
      <CardContent className="p-0.5">
        {post.group && (
          <div className="text-xs text-muted-foreground px-2 pt-1">
            Posted in {post.group.name}
          </div>
        )}
        <textarea
          ref={textareaRef}
          className="w-full resize-none bg-transparent outline-none px-2 py-1 whitespace-pre-wrap break-words"
          value={content}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          onFocus={() => isOwner && setIsEditing(true)}
          onBlur={() => {
            setIsEditing(false);
            if (content !== post.content) {
              updatePost.mutate(content);
            }
          }}
          readOnly={!isOwner}
          rows={1}
          style={{
            overflow: 'hidden',
            wordWrap: 'break-word',
          }}
        />
      </CardContent>
    </Card>
  );
}