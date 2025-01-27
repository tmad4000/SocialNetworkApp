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
import type { Post, User } from "@db/schema";
import PostCard from "./post-card";

interface RelatedPostsProps {
  postId: number;
  groupId?: number;
  userId?: number;
}

interface RelatedPost extends Post {
  user: User;
  mentions: Array<{
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

  const { data: relatedPosts, isLoading: relatedLoading } = useQuery<RelatedPost[]>({
    queryKey: [`/api/posts/${postId}/related`],
    enabled: true,
  });

  const { data: allPosts } = useQuery<Post[]>({
    queryKey: ["/api/posts"],
    enabled: true,
  });

  const addRelatedPost = useMutation({
    mutationFn: async (relatedPostId: number) => {
      try {
        console.log('Adding related post:', relatedPostId); 
        const res = await fetch(`/api/posts/${postId}/related`, {
          method: "POST",
          headers: { 
            "Content-Type": "application/json",
            "Accept": "application/json"
          },
          body: JSON.stringify({ relatedPostId }),
          credentials: "include",
        });

        console.log('Response status:', res.status); 
        const contentType = res.headers.get("content-type");
        console.log('Content-Type:', contentType); 

        if (!res.ok) {
          const errorText = await res.text();
          console.error('Error response:', errorText); 
          throw new Error(errorText);
        }

        const data = await res.json();
        console.log('Response data:', data); 
        return data;
      } catch (error: any) {
        console.error("Error adding related post:", error);
        throw new Error(error.message || "Failed to add related post");
      }
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
      console.error("Mutation error:", error);
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "Failed to add related post",
      });
    },
  });

  const createRelatedPost = useMutation({
    mutationFn: async (content: string) => {
      try {
        console.log('Creating new post with content:', content); 
        const res = await fetch("/api/posts", {
          method: "POST",
          headers: { 
            "Content-Type": "application/json",
            "Accept": "application/json"
          },
          body: JSON.stringify({ 
            content,
            groupId,
            userId,
          }),
          credentials: "include",
        });

        console.log('Response status:', res.status); 
        const contentType = res.headers.get("content-type");
        console.log('Content-Type:', contentType); 

        if (!res.ok) {
          const errorText = await res.text();
          console.error('Error response:', errorText); 
          throw new Error(errorText);
        }

        const data = await res.json();
        console.log('Response data:', data); 
        return data;
      } catch (error: any) {
        console.error("Error creating related post:", error);
        throw new Error(error.message || "Failed to create related post");
      }
    },
    onSuccess: (data) => {
      addRelatedPost.mutate(data.id);
      queryClient.invalidateQueries({ queryKey: ["/api/posts"] });
    },
    onError: (error: Error) => {
      console.error("Mutation error:", error);
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "Failed to create related post",
      });
    },
  });

  const filteredPosts = allPosts?.filter(post => 
    post.id !== postId && 
    post.content.toLowerCase().includes(searchText.toLowerCase())
  ) || [];

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
                      {searchText && filteredPosts.length > 0 && (
                        <CommandItem
                          className="bg-primary/5 text-primary font-medium border-t"
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
  );
}