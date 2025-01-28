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
import {
  Dialog,
  DialogContent,
} from "@/components/ui/dialog";
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

// Helper function to highlight matching text
function HighlightedText({ text, highlight }: { text: string; highlight: string }) {
  if (!highlight.trim()) {
    return <span>{text}</span>;
  }

  const regex = new RegExp(`(${highlight})`, 'gi');
  const parts = text.split(regex);

  return (
    <span>
      {parts.map((part, i) => 
        regex.test(part) ? (
          <span key={i} className="bg-yellow-100 dark:bg-yellow-800">{part}</span>
        ) : (
          <span key={i}>{part}</span>
        )
      )}
    </span>
  );
}

export default function RelatedPosts({ postId, groupId, userId }: RelatedPostsProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isCommandOpen, setIsCommandOpen] = useState(false);
  const [searchText, setSearchText] = useState("");
  const [selectedPosts, setSelectedPosts] = useState<Array<{ id: number; content: string }>>([]);
  const [selectedPostForModal, setSelectedPostForModal] = useState<number | null>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const commandRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (commandRef.current && !commandRef.current.contains(event.target as Node)) {
        setIsCommandOpen(false);
        setSearchText("");
      }
    }

    function handleEscapeKey(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setIsCommandOpen(false);
        setSearchText("");
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
    enabled: isOpen,
    staleTime: 60000,
    gcTime: 300000,
  });

  const { data: allPosts } = useQuery<Post[]>({
    queryKey: ["/api/posts"],
    enabled: isOpen && searchText.length > 0,
    staleTime: 60000,
    gcTime: 300000,
  });

  // Fetch selected post for modal
  const { data: selectedPost } = useQuery<RelatedPost>({
    queryKey: [`/api/posts/${selectedPostForModal}`],
    enabled: !!selectedPostForModal,
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
    onSuccess: (_data: unknown, relatedPostId: number) => {
      queryClient.invalidateQueries({ queryKey: [`/api/posts/${postId}/related`] });
      const post = allPosts?.find((p: Post) => p.id === relatedPostId);
      if (post) {
        setSelectedPosts((prev) => [...prev, { id: post.id, content: post.content }]);
      }
      toast({
        title: "Success",
        description: "Related post added successfully",
      });
      setSearchText("");
      setIsCommandOpen(false);
    },
    onError: (error: Error) => {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "Failed to add related post",
      });
    },
  });

  // Filter out duplicates and already selected posts
  const searchTextLower = searchText.toLowerCase();
  const seenPosts = new Set([postId, ...selectedPosts.map((sp) => sp.id)]);
  const filteredPosts = allPosts?.reduce<Post[]>((acc, post) => {
    // Skip if already seen or selected
    if (seenPosts.has(post.id)) {
      return acc;
    }

    // Check content match
    const contentLower = post.content.toLowerCase();
    if (contentLower.includes(searchTextLower)) {
      seenPosts.add(post.id);
      acc.push(post);
    }

    return acc;
  }, []) || [];

  const handleOpenPost = useCallback((postId: number) => {
    setSelectedPostForModal(postId);
  }, []);

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

          <div className="space-y-6">
            <div>
              <h3 className="text-sm font-medium mb-2">Related Ideas</h3>

              <div className="space-y-6">
                {/* Manual Related Posts Section */}
                <div className="space-y-2">
                  <h4 className="text-xs font-medium text-muted-foreground">Related Posts</h4>
                  <div ref={commandRef}>
                    <Command
                      className="rounded-lg border shadow-md"
                      shouldFilter={false}
                    >
                      <CommandInput
                        placeholder="Search for a post..."
                        value={searchText}
                        onValueChange={(value) => {
                          setSearchText(value);
                          setIsCommandOpen(true);
                        }}
                      />
                      {isCommandOpen && (
                        <CommandList>
                          <CommandEmpty>No posts found</CommandEmpty>
                          <CommandGroup>
                            <ScrollArea className="h-[200px]">
                              {filteredPosts.map((post) => (
                                <CommandItem
                                  key={post.id}
                                  onSelect={() => {
                                    addRelatedPost.mutate(post.id);
                                  }}
                                >
                                  <HighlightedText
                                    text={post.content.substring(0, 100)}
                                    highlight={searchText}
                                  />
                                </CommandItem>
                              ))}
                            </ScrollArea>
                          </CommandGroup>
                        </CommandList>
                      )}
                    </Command>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    {selectedPosts.map((post) => (
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
                                {post.similarity > 0.7
                                  ? " (Strong match)"
                                  : post.similarity > 0.4
                                  ? " (Moderate match)"
                                  : post.similarity > 0.2
                                  ? " (Weak match)"
                                  : " (Very weak match)"}
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

      <Dialog open={!!selectedPostForModal} onOpenChange={() => setSelectedPostForModal(null)}>
        <DialogContent className="max-w-3xl">
          {selectedPost && <PostCard post={selectedPost} />}
        </DialogContent>
      </Dialog>
    </div>
  );
}