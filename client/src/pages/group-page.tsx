import { useState } from "react";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { useRoute } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { Loader2, Users, Pencil, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import PostCard from "@/components/post-card";
import CreatePost from "@/components/create-post";
import { useToast } from "@/hooks/use-toast";
import type { Group, User, Post } from "@db/schema";
import { Link } from "wouter";
import PostFilter from "@/components/ui/post-filter";

type Status = 'none' | 'not acknowledged' | 'acknowledged' | 'in progress' | 'done';
const STATUSES: Status[] = ['none', 'not acknowledged', 'acknowledged', 'in progress', 'done'];

export default function GroupPage() {
  const [isEditingDescription, setIsEditingDescription] = useState(false);
  const [newDescription, setNewDescription] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [showStatusOnly, setShowStatusOnly] = useState(false);
  const [selectedStatuses, setSelectedStatuses] = useState<Status[]>(
    STATUSES.filter(status => status !== 'none')
  );
  
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [, params] = useRoute("/groups/:id");

  const { data: group, isLoading: groupLoading } = useQuery<Group & { 
    isMember: boolean;
    memberCount: number;
  }>({
    queryKey: [`/api/groups/${params?.id}`],
    enabled: !!params?.id,
  });

  const { data: posts, isLoading: postsLoading } = useQuery<(Post & {
    user: User;
  })[]>({
    queryKey: [`/api/groups/${params?.id}/posts`],
    enabled: !!params?.id,
  });

  const { data: members, isLoading: membersLoading } = useQuery<User[]>({
    queryKey: [`/api/groups/${params?.id}/members`],
    enabled: !!params?.id,
  });

  const updateDescription = useMutation({
    mutationFn: async (description: string) => {
      const res = await fetch(`/api/groups/${params?.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ description }),
        credentials: "include",
      });

      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
    onSuccess: () => {
      setIsEditingDescription(false);
      queryClient.invalidateQueries({ queryKey: [`/api/groups/${params?.id}`] });
      toast({
        title: "Success",
        description: "Group description updated successfully",
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

  const toggleMembership = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/groups/${params?.id}/membership`, {
        method: group?.isMember ? "DELETE" : "POST",
        credentials: "include",
      });

      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/groups/${params?.id}`] });
      toast({
        title: "Success",
        description: group?.isMember ? "Left group successfully" : "Joined group successfully",
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

  const filteredPosts = posts?.filter(post => {
    if (showStatusOnly && !selectedStatuses.includes(post.status as Status)) {
      return false;
    }
    if (searchQuery.trim()) {
      return post.content.toLowerCase().includes(searchQuery.toLowerCase());
    }
    return true;
  });

  if (groupLoading || postsLoading || membersLoading) {
    return (
      <div className="flex justify-center p-8">
        <Loader2 className="h-8 w-8 animate-spin text-border" />
      </div>
    );
  }

  if (!group) return null;

  const handleStartEdit = () => {
    setNewDescription(group.description || "");
    setIsEditingDescription(true);
  };

  const handleSaveDescription = (e: React.FormEvent) => {
    e.preventDefault();
    updateDescription.mutate(newDescription);
  };

  return (
    <div className="max-w-4xl mx-auto">
      <Card className="mb-8">
        <CardContent className="flex items-start gap-6 p-6">
          <Avatar className="h-24 w-24 flex-shrink-0">
            <AvatarImage src={`https://api.dicebear.com/7.x/shapes/svg?seed=${group.name}`} />
            <AvatarFallback>{group.name[0]}</AvatarFallback>
          </Avatar>

          <div className="flex-1 space-y-4">
            <div className="flex items-center justify-between">
              <h1 className="text-2xl font-bold">{group.name}</h1>
              <Button
                onClick={() => toggleMembership.mutate()}
                variant={group.isMember ? "outline" : "default"}
              >
                {group.isMember ? "Leave Group" : "Join Group"}
              </Button>
            </div>

            {isEditingDescription ? (
              <form onSubmit={handleSaveDescription} className="space-y-2">
                <Textarea
                  value={newDescription}
                  onChange={(e) => setNewDescription(e.target.value)}
                  placeholder="Write something about the group..."
                  className="min-h-[100px]"
                />
                <div className="flex gap-2">
                  <Button type="submit" disabled={updateDescription.isPending}>
                    Save
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setIsEditingDescription(false)}
                  >
                    Cancel
                  </Button>
                </div>
              </form>
            ) : (
              <div className="flex items-start gap-2">
                <p className="text-muted-foreground flex-1">
                  {group.description || "No description yet"}
                </p>
                {group.isMember && (
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={handleStartEdit}
                    className="flex-shrink-0"
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                )}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <Card className="mb-8">
        <CardContent className="p-6">
          <div className="flex items-center gap-2 mb-4">
            <Users className="h-5 w-5" />
            <h2 className="text-xl font-semibold">Members ({group.memberCount})</h2>
          </div>

          {!members?.length ? (
            <p className="text-muted-foreground">No members yet</p>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {members?.map((member) => (
                <Link key={member.id} href={`/profile/${member.id}`}>
                  <div className="flex items-center gap-3 p-2 rounded-lg hover:bg-accent cursor-pointer">
                    <Avatar className="h-10 w-10">
                      <AvatarImage src={member.avatar || `https://api.dicebear.com/7.x/avatars/svg?seed=${member.username}`} />
                      <AvatarFallback>{member.username[0]}</AvatarFallback>
                    </Avatar>
                    <span className="font-medium truncate">{member.username}</span>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <div className="space-y-6">
        <Separator className="my-8" />
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-semibold">Posts</h2>
          <div className="flex items-center gap-4">
            <div className="relative w-64">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search posts..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
            <PostFilter
              showStatusOnly={showStatusOnly}
              onFilterChange={setShowStatusOnly}
              selectedStatuses={selectedStatuses}
              onStatusesChange={setSelectedStatuses}
            />
          </div>
        </div>

        <CreatePost
          groupId={group.id}
          onSuccess={() => {
            queryClient.invalidateQueries({ queryKey: [`/api/groups/${params?.id}/posts`] });
          }}
        />

        <div className="space-y-6">
          {filteredPosts?.map((post) => (
            <PostCard key={post.id} post={post} />
          ))}
          {!filteredPosts?.length && (
            <p className="text-muted-foreground text-center py-8">
              {searchQuery ? "No posts found matching your search." : "No posts yet"}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
