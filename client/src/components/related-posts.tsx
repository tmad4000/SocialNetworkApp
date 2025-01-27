import { useState } from "react";
import { ChevronDown, ChevronUp, Loader2, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
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
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import type { Post, User } from "@db/schema";
import PostCard from "./post-card";

interface RelatedPostsProps {
  postId: number;
  groupId?: number;
  userId?: number;
}

interface RelatedPost extends Post {
  user: {
    id: number;
    username: string;
    avatar: string | null;
    bio: string | null;
    linkedinUrl: string | null;
    lookingFor: string | null;
    phone: string | null;
    email: string | null;
    createdAt: Date | null;
    password: string;
  };
  similarity: number;
  likeCount: number;
  liked: boolean;
  starCount: number;
  starred: boolean;
  mentions: Array<{
    mentionedUser: {
      id: number;
      username: string;
      avatar: string | null;
    };
  }>;
}

export default function RelatedPosts({ postId, groupId, userId }: RelatedPostsProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchText, setSearchText] = useState("");
  const [isPopoverOpen, setIsPopoverOpen] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: relatedPosts, isLoading: relatedLoading } = useQuery<RelatedPost[]>({
    queryKey: [`/api/posts/${postId}/related`],
    enabled: isOpen,
  });

  const { data: allPosts, isLoading: postsLoading } = useQuery<Post[]>({
    queryKey: ["/api/posts"],
    enabled: isPopoverOpen,
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
    },
    onError: (error) => {
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
        body: JSON.stringify({ 
          content,
          groupId,
          userId,
        }),
        credentials: "include",
      });

      if (!res.ok) {
        throw new Error(await res.text());
      }

      return res.json();
    },
    onSuccess: (data) => {
      addRelatedPost.mutate(data.id);
      setSearchText("");
      setIsPopoverOpen(false);
      queryClient.invalidateQueries({ queryKey: ["/api/posts"] });
    },
    onError: (error) => {
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

  return (
    <div>
      {!isOpen ? (
        <Button
          variant="ghost"
          className="w-full flex justify-between items-center py-2 px-6"
          onClick={() => setIsOpen(true)}
        >
          <span className="text-sm text-muted-foreground">Show related ideas</span>
          <ChevronDown className="h-4 w-4" />
        </Button>
      ) : (
        <div className="space-y-4 px-6">
          <Button
            variant="ghost"
            className="w-full flex justify-between items-center py-2"
            onClick={() => setIsOpen(false)}
          >
            <span className="text-sm text-muted-foreground">Hide ideas</span>
            <ChevronUp className="h-4 w-4" />
          </Button>

          <div className="space-y-4">
            <div>
              <h3 className="text-sm font-medium mb-2">Related Posts</h3>
              <Popover open={isPopoverOpen} onOpenChange={setIsPopoverOpen}>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="w-full justify-start">
                    {searchText || "Search or create related post..."}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="p-0" align="start">
                  <Command>
                    <CommandInput
                      placeholder="Type to search..."
                      value={searchText}
                      onValueChange={setSearchText}
                    />
                    <CommandList>
                      <CommandEmpty>No posts found.</CommandEmpty>
                      <CommandGroup>
                        <ScrollArea className="h-[200px]">
                          {filteredPosts.map(post => (
                            <CommandItem
                              key={post.id}
                              onSelect={() => {
                                addRelatedPost.mutate(post.id);
                                setSearchText("");
                                setIsPopoverOpen(false);
                              }}
                            >
                              <span className="truncate">
                                {post.content.substring(0, 50)}...
                              </span>
                            </CommandItem>
                          ))}
                          <CommandItem
                            className="bg-primary/5"
                            onSelect={() => {
                              if (searchText.trim()) {
                                createRelatedPost.mutate(searchText);
                              }
                            }}
                          >
                            <Plus className="mr-2 h-4 w-4" />
                            <span>Create new related post</span>
                          </CommandItem>
                        </ScrollArea>
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            </div>

            <div>
              <h3 className="text-sm font-medium mb-2">Suggested Related Posts</h3>
              {relatedLoading ? (
                <div className="flex flex-col items-center justify-center gap-2 py-8 text-muted-foreground">
                  <Loader2 className="h-6 w-6 animate-spin" />
                  <p>Processing related posts...</p>
                  <p className="text-sm">This might take a moment while we analyze content similarities</p>
                </div>
              ) : !relatedPosts?.length ? (
                <div className="text-center text-muted-foreground py-4">
                  No suggested posts found
                </div>
              ) : (
                <div className="space-y-6">
                  {relatedPosts?.map((post) => (
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
      )}
    </div>
  );
}