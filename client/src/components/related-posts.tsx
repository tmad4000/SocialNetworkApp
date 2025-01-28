import { useState, useEffect, useRef, useCallback } from "react";
import { ChevronDown, ChevronUp, Loader2, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import type { Post, User, PostMention, Group } from "@db/schema";
import PostCard from "./post-card";

interface RelatedPostsProps {
  postId: number;
  groupId?: number;
  userId?: number;
}

type RelatedPost = Post & {
  user: User;
  mentions: (PostMention & { mentionedUser: User })[];
  group?: Group;
  similarity: number;
  likeCount: number;
  liked: boolean;
  starred: boolean;
  privacy: string;
};

export default function RelatedPosts({ postId, groupId, userId }: RelatedPostsProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchText, setSearchText] = useState("");
  const [selectedPosts, setSelectedPosts] = useState<Array<{ id: number, content: string }>>([]);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Handle click outside
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    // Handle escape key
    function handleEscapeKey(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setIsOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleEscapeKey);

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEscapeKey);
    };
  }, []);

  const { data: relatedPosts, isLoading: relatedLoading } = useQuery<RelatedPost[]>({
    queryKey: [`/api/posts/${postId}/related`],
    enabled: isOpen, // Only fetch when dropdown is open
    staleTime: 60000, // Consider data fresh for 1 minute
    cacheTime: 300000, // Keep in cache for 5 minutes
  });

  const { data: allPosts } = useQuery<Post[]>({
    queryKey: ["/api/posts"],
    enabled: isOpen && searchText.length > 0, // Only fetch when dropdown is open and searching
    staleTime: 60000,
    cacheTime: 300000,
  });

  const addRelatedPost = useMutation({
    mutationFn: async (relatedPostId: number) => {
      const res = await fetch(`/api/posts/${postId}/related`, {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ relatedPostId }),
        credentials: "include",
      });

      if (!res.ok) {
        throw new Error(await res.text());
      }

      return res.json();
    },
    onSuccess: (_, relatedPostId) => {
      queryClient.invalidateQueries({ queryKey: [`/api/posts/${postId}/related`] });
      const post = allPosts?.find(p => p.id === relatedPostId);
      if (post) {
        setSelectedPosts(prev => [...prev, { id: post.id, content: post.content }]);
      }
      toast({
        title: "Success",
        description: "Related post added successfully",
      });
      setSearchText("");
    },
    onError: (error: Error) => {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "Failed to add related post",
      });
    },
  });

  const filteredPosts = allPosts?.filter(post => 
    post.id !== postId && 
    post.content.toLowerCase().includes(searchText.toLowerCase()) &&
    !selectedPosts.some(sp => sp.id === post.id)
  ) || [];

  const handleOpenPost = useCallback((postId: number) => {
    window.open(`/post/${postId}`, '_blank');
  }, []);

  return (
    <div ref={dropdownRef}>
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

          <div className="space-y-6">
            <div>
              <h3 className="text-sm font-medium mb-2">Related Ideas</h3>

              <div className="space-y-6">
                {/* Manual Related Posts Section */}
                <div className="space-y-2">
                  <h4 className="text-xs font-medium text-muted-foreground">Related Posts</h4>
                  <Command className="rounded-lg border shadow-md">
                    <CommandInput
                      placeholder="Search for a post..."
                      value={searchText}
                      onValueChange={setSearchText}
                    />
                    <CommandList>
                      <CommandEmpty>No posts found</CommandEmpty>
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

                  <div className="flex flex-wrap gap-2">
                    {selectedPosts.map(post => (
                      <Badge
                        key={post.id}
                        variant="secondary"
                        className="cursor-pointer hover:bg-secondary/80 flex items-center gap-1"
                        onClick={() => handleOpenPost(post.id)}
                      >
                        <span className="truncate max-w-[200px]">
                          {post.content.substring(0, 25)}...
                        </span>
                        <ExternalLink className="h-3 w-3" />
                      </Badge>
                    ))}
                  </div>
                </div>

                {/* AI Suggested Posts Section */}
                <div>
                  <h4 className="text-xs font-medium text-muted-foreground mb-2">Suggested Related Posts</h4>
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
          </div>
        </div>
      )}
    </div>
  );
}