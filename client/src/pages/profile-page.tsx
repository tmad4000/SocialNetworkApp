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
import FriendRequest from "@/components/friend-request";
import { useUser } from "@/hooks/use-user";
import { useToast } from "@/hooks/use-toast";
import type { User, Post, Friend, PostMention } from "@db/schema";
import { Link } from "wouter";
import { useState, useEffect, useMemo } from "react";
import { SiLinkedin } from "react-icons/si";
import PostFilter from "@/components/ui/post-filter";

type FriendWithRelations = Friend & {
  user: {
    id: number;
    username: string;
    avatar: string | null;
  };
  friend: {
    id: number;
    username: string;
    avatar: string | null;
  };
};

export default function ProfilePage() {
  const [isEditingBio, setIsEditingBio] = useState(false);
  const [isEditingLinkedIn, setIsEditingLinkedIn] = useState(false);
  const [newBio, setNewBio] = useState("");
  const [newLinkedInUrl, setNewLinkedInUrl] = useState("");
  const [isEditingLookingFor, setIsEditingLookingFor] = useState(false);
  const [newLookingFor, setNewLookingFor] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [showStatusOnly, setShowStatusOnly] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [match] = useRoute("/profile/:id");
  const { user: currentUser } = useUser();
  const userId = match?.params?.id;

  const { data: user, isLoading: userLoading } = useQuery<User>({
    queryKey: [`/api/user/${userId}`],
    enabled: !!userId,
  });

  useEffect(() => {
    if (user?.lookingFor) {
      setNewLookingFor(user.lookingFor);
    }
  }, [user?.lookingFor]);

  const updateBio = useMutation({
    mutationFn: async (bio: string) => {
      const res = await fetch("/api/user/bio", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bio }),
        credentials: "include",
      });

      if (!res.ok) {
        throw new Error(await res.text());
      }

      return res.json();
    },
    onSuccess: () => {
      setIsEditingBio(false);
      queryClient.invalidateQueries({ queryKey: [`/api/user/${userId}`] });
      toast({
        title: "Success",
        description: "Bio updated successfully",
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

  const updateLinkedInUrl = useMutation({
    mutationFn: async (linkedinUrl: string) => {
      const res = await fetch("/api/user/linkedin", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ linkedinUrl }),
        credentials: "include",
      });

      if (!res.ok) {
        throw new Error(await res.text());
      }

      return res.json();
    },
    onSuccess: () => {
      setIsEditingLinkedIn(false);
      queryClient.invalidateQueries({ queryKey: [`/api/user/${userId}`] });
      toast({
        title: "Success",
        description: "LinkedIn URL updated successfully",
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

  const updateLookingFor = useMutation({
    mutationFn: async (lookingFor: string) => {
      const res = await fetch("/api/user/looking-for", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lookingFor }),
        credentials: "include",
      });

      if (!res.ok) {
        throw new Error(await res.text());
      }

      return res.json();
    },
    onSuccess: (data) => {
      setIsEditingLookingFor(false);
      queryClient.setQueryData([`/api/user/${userId}`], (oldData: any) => ({
        ...oldData,
        ...data,
      }));
      toast({
        title: "Success",
        description: "Looking for updated successfully",
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

  const handleStartEditLookingFor = () => {
    setNewLookingFor(user?.lookingFor || "");
    setIsEditingLookingFor(true);
  };

  const handleSaveLookingFor = (e: React.FormEvent) => {
    e.preventDefault();
    updateLookingFor.mutate(newLookingFor);
  };

  const { data: posts, isLoading: postsLoading } = useQuery<(Post & {
    user: User;
    mentions: (PostMention & { mentionedUser: User })[];
    likeCount: number;
    liked: boolean;
  })[]>({
    queryKey: [`/api/posts/user/${userId}`],
    queryFn: async ({ queryKey }) => {
      const baseUrl = queryKey[0] as string;
      const url = new URL(baseUrl, window.location.origin);
      url.searchParams.set('status', showStatusOnly.toString());
      const res = await fetch(url, { credentials: 'include' });
      if (!res.ok) throw new Error('Failed to fetch posts');
      return res.json();
    }
  });

  const filteredPosts = useMemo(() => {
    if (!posts) return [];

    // If there's no search query, just return the posts (already filtered by status via API)
    if (!searchQuery.trim()) return posts;

    // If there is a search query, filter the already status-filtered posts
    const query = searchQuery.toLowerCase();
    return posts.filter(post => 
      post.content.toLowerCase().includes(query) ||
      post.mentions.some(mention => 
        mention.mentionedUser.username.toLowerCase().includes(query)
      )
    );
  }, [posts, searchQuery]);

  const { data: friends, isLoading: friendsLoading } = useQuery<FriendWithRelations[]>({
    queryKey: ["/api/friends"],
  });

  if (userLoading || postsLoading || friendsLoading) {
    return (
      <div className="flex justify-center p-8">
        <Loader2 className="h-8 w-8 animate-spin text-border" />
      </div>
    );
  }

  if (!user) return null;

  const isOwnProfile = currentUser?.id === user.id;
  const friendRequest = friends?.find(
    (f) =>
      (f.userId === currentUser?.id && f.friendId === user.id) ||
      (f.userId === user.id && f.friendId === currentUser?.id)
  );

  const handleStartEdit = () => {
    setNewBio(user.bio || "");
    setIsEditingBio(true);
  };

  const handleSaveBio = (e: React.FormEvent) => {
    e.preventDefault();
    updateBio.mutate(newBio);
  };

  const handleStartEditLinkedIn = () => {
    setNewLinkedInUrl(user?.linkedinUrl || "");
    setIsEditingLinkedIn(true);
  };

  const handleSaveLinkedIn = (e: React.FormEvent) => {
    e.preventDefault();
    updateLinkedInUrl.mutate(newLinkedInUrl);
  };

  const acceptedFriends = friends?.reduce<{
    id: number;
    username: string;
    avatar: string | null;
  }[]>((acc, f) => {
    if (f.status === "accepted") {
      const otherUser = f.userId === user?.id ? f.friend : f.user;
      if (otherUser) {
        acc.push({
          id: otherUser.id,
          username: otherUser.username,
          avatar: otherUser.avatar,
        });
      }
    }
    return acc;
  }, []);

  return (
    <div className="max-w-4xl mx-auto">
      <Card className="mb-8">
        <CardContent className="flex items-start gap-6 p-6">
          <Avatar className="h-24 w-24 flex-shrink-0">
            <AvatarImage src={user?.avatar || `https://api.dicebear.com/7.x/avatars/svg?seed=${user?.username}`} />
            <AvatarFallback>{user?.username[0]}</AvatarFallback>
          </Avatar>

          <div className="flex-1 space-y-4">
            <h1 className="text-2xl font-bold">{user?.username}</h1>

            {isEditingBio ? (
              <form onSubmit={handleSaveBio} className="space-y-2">
                <Textarea
                  value={newBio}
                  onChange={(e) => setNewBio(e.target.value)}
                  placeholder="Write something about yourself..."
                  className="min-h-[100px]"
                />
                <div className="flex gap-2">
                  <Button type="submit" disabled={updateBio.isPending}>
                    Save
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setIsEditingBio(false)}
                  >
                    Cancel
                  </Button>
                </div>
              </form>
            ) : (
              <div className="flex items-start gap-2">
                <p className="text-muted-foreground flex-1">
                  {user?.bio || "No bio yet"}
                </p>
                {isOwnProfile && (
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

            {isEditingLinkedIn ? (
              <form onSubmit={handleSaveLinkedIn} className="space-y-2">
                <Input
                  value={newLinkedInUrl}
                  onChange={(e) => setNewLinkedInUrl(e.target.value)}
                  placeholder="https://www.linkedin.com/in/username"
                  className="flex-1"
                />
                <div className="flex gap-2">
                  <Button type="submit" disabled={updateLinkedInUrl.isPending}>
                    Save
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setIsEditingLinkedIn(false)}
                  >
                    Cancel
                  </Button>
                </div>
              </form>
            ) : (
              <div className="flex items-center gap-2">
                <SiLinkedin className="h-5 w-5 text-[#0A66C2]" />
                {user?.linkedinUrl ? (
                  <a
                    href={user.linkedinUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary hover:underline flex-1"
                  >
                    {user.linkedinUrl.replace("https://www.linkedin.com/", "")}
                  </a>
                ) : (
                  <span className="text-muted-foreground flex-1">No LinkedIn profile added</span>
                )}
                {isOwnProfile && (
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={handleStartEditLinkedIn}
                    className="flex-shrink-0"
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                )}
              </div>
            )}

            {isEditingLookingFor ? (
              <form onSubmit={handleSaveLookingFor} className="space-y-2">
                <Input
                  value={newLookingFor}
                  onChange={(e) => setNewLookingFor(e.target.value)}
                  placeholder="What are you looking for? (e.g. Mentorship, Collaboration, Job Opportunities)"
                  className="flex-1"
                />
                <div className="flex gap-2">
                  <Button type="submit" disabled={updateLookingFor.isPending}>
                    Save
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setIsEditingLookingFor(false)}
                  >
                    Cancel
                  </Button>
                </div>
              </form>
            ) : (
              <div className="flex items-center gap-2">
                <span className="text-muted-foreground flex-1">
                  {user?.lookingFor ? (
                    <div>
                      <strong>I'm looking for:</strong> {user.lookingFor}
                    </div>
                  ) : (
                    <span>No looking for information added</span>
                  )}
                </span>
                {isOwnProfile && (
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={handleStartEditLookingFor}
                    className="flex-shrink-0"
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                )}
              </div>
            )}
          </div>

          {!isOwnProfile && (
            <FriendRequest
              userId={user?.id}
              status={friendRequest?.status}
              requestId={friendRequest?.id}
            />
          )}
        </CardContent>
      </Card>

      <div className="space-y-6">
        <Separator className="my-8" />
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <h2 className="text-2xl font-semibold">Posts</h2>
          <div className="flex items-center gap-4 flex-wrap">
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
            />
          </div>
        </div>

        <CreatePost
          targetUserId={!isOwnProfile ? user.id : undefined}
          onSuccess={() => {
            queryClient.invalidateQueries({ queryKey: [`/api/posts/user/${userId}`] });
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