import { useState } from "react";
import { Loader2, Plus } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Input } from "@/components/ui/input";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import type { Post } from "@db/schema";
import PostCard from "./post-card";

interface RelatedPostsProps {
  postId: number;
  groupId?: number;
  userId?: number;
}

interface PostWithDetails extends Post {
  user: {
    id: number;
    username: string;
    avatar: string | null;
  };
  mentions: Array<{
    id: number;
    postId: number;
    mentionedUserId: number;
    mentionedUser: {
      id: number;
      username: string;
      avatar: string | null;
    };
  }>;
  similarity: number;
  likeCount: number;
  liked: boolean;
  starred: boolean;
  privacy: string;
}

export default function RelatedPosts({ postId, groupId, userId }: RelatedPostsProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchText, setSearchText] = useState("");
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: relatedPosts, isLoading: relatedLoading } = useQuery<PostWithDetails[]>({
    queryKey: [`/api/posts/${postId}/related`],
    enabled: !!postId,
  });

  const { data: allPosts, isLoading: allPostsLoading } = useQuery<PostWithDetails[]>({
    queryKey: ["/api/posts"],
    enabled: !!postId,
  });

  const addRelatedPost = useMutation({
    mutationFn: async (relatedPostId: number) => {
      const res = await fetch(`/api/posts/${postId}/related`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ relatedPostId }),
        credentials: "include",
      });

      if (!res.ok) {
        throw new Error(await res.text());
      }

      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/posts/${postId}/related`] });
      toast({
        title: "Success",
        description: "Related post added successfully",
      });
      setSearchText("");
      setIsOpen(false);
    },
    onError: (error: Error) => {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message,
      });
    },
  });

  const createRelatedPost = useMutation({
    mutationFn: async (content: string) => {
      const res = await fetch("/api/posts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content, groupId, userId }),
        credentials: "include",
      });

      if (!res.ok) {
        throw new Error(await res.text());
      }

      return res.json();
    },
    onSuccess: (data) => {
      addRelatedPost.mutate(data.id);
      queryClient.invalidateQueries({ queryKey: ["/api/posts"] });
    },
    onError: (error: Error) => {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message,
      });
    },
  });

  const filteredPosts = allPosts?.filter(post => 
    post.id !== postId && 
    post.content.toLowerCase().includes(searchText.toLowerCase())
  ) || [];

  if (relatedLoading || allPostsLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-4 px-6">
      <div className="space-y-4">
        <div>
          <h3 className="text-sm font-medium mb-2">Related Posts</h3>
          <Popover open={isOpen} onOpenChange={setIsOpen}>
            <PopoverTrigger asChild>
              <Input
                value={searchText}
                onChange={(e) => setSearchText(e.target.value)}
                placeholder="Search or create related post..."
                className="w-full"
                onClick={() => setIsOpen(true)}
              />
            </PopoverTrigger>
            <PopoverContent className="p-0 w-[--radix-popover-trigger-width]" align="start">
              <Command>
                <CommandInput
                  placeholder="Type to search..."
                  value={searchText}
                  onValueChange={setSearchText}
                  className="border-none focus:ring-0"
                />
                <CommandList>
                  <CommandEmpty>
                    {searchText && (
                      <CommandItem
                        className="bg-primary/5 text-primary font-medium"
                        onSelect={() => {
                          if (searchText.trim()) {
                            createRelatedPost.mutate(searchText);
                          }
                        }}
                      >
                        <Plus className="mr-2 h-4 w-4" />
                        <span>+ Create new related post "{searchText}"</span>
                      </CommandItem>
                    )}
                  </CommandEmpty>
                  <CommandGroup>
                    <ScrollArea className="h-[200px]">
                      {filteredPosts.map(post => (
                        <CommandItem
                          key={post.id}
                          onSelect={() => {
                            addRelatedPost.mutate(post.id);
                          }}
                        >
                          <span className="truncate">
                            {post.content.substring(0, 50)}...
                          </span>
                        </CommandItem>
                      ))}
                    </ScrollArea>
                  </CommandGroup>
                </CommandList>
              </Command>
            </PopoverContent>
          </Popover>
        </div>

        <div>
          <h3 className="text-sm font-medium mb-2">Suggested Related Posts</h3>
          {!relatedPosts?.length ? (
            <div className="text-center text-muted-foreground py-4">
              No suggested posts found
            </div>
          ) : (
            <div className="space-y-6">
              {relatedPosts.map((post) => (
                <div key={post.id} className="opacity-80 hover:opacity-100 transition-opacity">
                  <div className="text-sm text-muted-foreground mb-2">
                    <div className="flex justify-between items-center">
                      <span>
                        Similarity score: {(post.similarity * 100).toFixed(2)}%
                        {post.similarity > 0.7 ? " (Strong match)" : 
                         post.similarity > 0.4 ? " (Moderate match)" : 
                         post.similarity > 0.2 ? " (Weak match)" : " (Very weak match)"}
                      </span>
                    </div>
                  </div>
                  <PostCard post={post} />
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}