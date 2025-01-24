import { useState, useRef, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { useToast } from "@/hooks/use-toast";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import type { User } from "@db/schema";

interface CreatePostProps {
  onSuccess?: () => void;
}

export default function CreatePost({ onSuccess }: CreatePostProps) {
  const [content, setContent] = useState("");
  const [mentionSearch, setMentionSearch] = useState("");
  const [showMentions, setShowMentions] = useState(false);
  const [mentionPosition, setMentionPosition] = useState({ top: 0, left: 0 });
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: searchResults } = useQuery<User[]>({
    queryKey: [`/api/users/search`, mentionSearch],
    enabled: showMentions && mentionSearch.length > 0,
  });

  const createPost = useMutation({
    mutationFn: async (content: string) => {
      const res = await fetch("/api/posts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content }),
        credentials: "include",
      });

      if (!res.ok) {
        throw new Error(await res.text());
      }

      return res.json();
    },
    onSuccess: () => {
      setContent("");
      queryClient.invalidateQueries({ queryKey: ["/api/posts"] });
      onSuccess?.();
      toast({
        title: "Success",
        description: "Post created successfully",
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

  const handleContentChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newContent = e.target.value;
    setContent(newContent);

    // Check for @ symbol
    const lastAtSymbol = newContent.lastIndexOf('@');
    if (lastAtSymbol !== -1 && lastAtSymbol === newContent.length - 1) {
      const textArea = textareaRef.current;
      if (textArea) {
        const { selectionEnd } = textArea;
        const coords = getCaretCoordinates(textArea, selectionEnd);
        setMentionPosition({
          top: coords.top + textArea.offsetTop + 20,
          left: coords.left + textArea.offsetLeft,
        });
      }
      setShowMentions(true);
      setMentionSearch("");
    } else if (showMentions) {
      const lastWord = newContent.slice(newContent.lastIndexOf('@') + 1).split(/\s/)[0];
      setMentionSearch(lastWord);

      if (newContent[newContent.length - 1] === ' ' || !newContent.includes('@')) {
        setShowMentions(false);
      }
    }
  };

  const handleMentionSelect = (username: string) => {
    const lastAtSymbol = content.lastIndexOf('@');
    const newContent = content.slice(0, lastAtSymbol) + '@' + username + ' ';
    setContent(newContent);
    setShowMentions(false);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!content.trim()) return;
    createPost.mutate(content);
  };

  // Helper function to get caret coordinates
  function getCaretCoordinates(element: HTMLTextAreaElement, position: number) {
    const { offsetHeight: height, offsetWidth: width } = element;
    const lines = element.value.substr(0, position).split('\n');
    const lineHeight = height / element.rows;
    const currentLine = lines.length;
    const currentLineLength = lines[lines.length - 1].length;
    const averageCharWidth = width / element.cols;

    return {
      top: (currentLine - 1) * lineHeight,
      left: currentLineLength * averageCharWidth,
    };
  }

  return (
    <Card>
      <CardContent className="p-4">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="relative">
            <Textarea
              ref={textareaRef}
              placeholder="What's on your mind?"
              value={content}
              onChange={handleContentChange}
              className="resize-none"
              rows={3}
            />
            {showMentions && (
              <div 
                className="absolute z-50 w-64 bg-background border rounded-md shadow-lg"
                style={{ top: mentionPosition.top, left: mentionPosition.left }}
              >
                {searchResults?.length === 0 ? (
                  <div className="p-2 text-sm text-muted-foreground">
                    No users found
                  </div>
                ) : (
                  <div className="p-1">
                    {searchResults?.map((user) => (
                      <div
                        key={user.id}
                        className="flex items-center gap-2 p-2 hover:bg-accent rounded-sm cursor-pointer"
                        onClick={() => handleMentionSelect(user.username)}
                      >
                        <Avatar className="h-6 w-6">
                          <AvatarImage src={user.avatar || `https://api.dicebear.com/7.x/avatars/svg?seed=${user.username}`} />
                          <AvatarFallback>{user.username[0]}</AvatarFallback>
                        </Avatar>
                        <span className="text-sm">{user.username}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
          <div className="flex justify-end">
            <Button
              type="submit"
              disabled={!content.trim() || createPost.isPending}
            >
              Post
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}