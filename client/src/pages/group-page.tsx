import { useState, useEffect, useMemo } from "react";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { useRoute, useLocation } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { Loader2, Users, Pencil, QrCode, Search, AlertCircle } from "lucide-react";
import { Link } from "wouter";
import PostCard from "@/components/post-card";
import CreatePost from "@/components/create-post";
import PostFeed from "@/components/post-feed";
import PostFilter from "@/components/ui/post-filter";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { Group, User, Post } from "@db/schema";
import QRCode from "qrcode";
import { Input } from "@/components/ui/input";
import { cosineSim, calculateBasicMatchScore } from "@/utils/match-utils";
import { Progress } from "@/components/ui/progress";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

type Status = 'none' | 'not acknowledged' | 'acknowledged' | 'in progress' | 'done';
const STATUSES: Status[] = ['none', 'not acknowledged', 'acknowledged', 'in progress', 'done'];

type GroupMatch = {
  user1: User;
  user2: User;
  score: number;
  matchReason: string;
  hasEmbeddings: boolean;
};

export default function GroupPage() {
  const [isEditingDescription, setIsEditingDescription] = useState(false);
  const [newDescription, setNewDescription] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [showStatusOnly, setShowStatusOnly] = useState(false);
  const [showStarredOnly, setShowStarredOnly] = useState(false);
  const [selectedStatuses, setSelectedStatuses] = useState<Status[]>(
    STATUSES.filter(status => status !== 'none')
  );
  const [qrCodeDialogOpen, setQrCodeDialogOpen] = useState(false);
  const [qrCodeUrl, setQrCodeUrl] = useState("");
  const [showMatches, setShowMatches] = useState(false);

  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [, params] = useRoute("/groups/:id");
  const [location] = useLocation();

  useEffect(() => {
    return () => {
      setSearchQuery("");
      setShowStatusOnly(false);
      setShowStarredOnly(false);
      setSelectedStatuses(STATUSES.filter(status => status !== 'none'));
      setShowMatches(false);
    };
  }, [location]);

  const { data: group, isLoading: groupLoading } = useQuery<Group & {
    creator: User;
    isMember: boolean;
    memberCount: number;
  }>({
    queryKey: [`/api/groups/${params?.id}`],
    enabled: !!params?.id,
  });

  const { data: members, isLoading: membersLoading } = useQuery<User[]>({
    queryKey: [`/api/groups/${params?.id}/members`],
    enabled: !!params?.id,
  });

  const { data: currentUser } = useQuery<User>({
    queryKey: ["/api/user"],
  });

  const { data: userEmbeddings } = useQuery<{
    id: number;
    userId: number;
    bioEmbedding: number[] | null;
    lookingForEmbedding: number[] | null;
  }[]>({
    queryKey: ["/api/user-embeddings"],
    enabled: showMatches,
  });

  const groupMatches = useMemo(() => {
    if (!members || members.length < 2 || !showMatches) return [];
    console.log("Calculating group matches");

    const matches: GroupMatch[] = [];

    for (let i = 0; i < members.length; i++) {
      for (let j = i + 1; j < members.length; j++) {
        const user1 = members[i];
        const user2 = members[j];

        let score = 0;
        let matchReason = "";
        let hasEmbeddings = false;

        const user1Embed = userEmbeddings?.find((ue) => ue.userId === user1.id);
        const user2Embed = userEmbeddings?.find((ue) => ue.userId === user2.id);

        hasEmbeddings = !!(user1Embed?.bioEmbedding || user1Embed?.lookingForEmbedding) &&
                       !!(user2Embed?.bioEmbedding || user2Embed?.lookingForEmbedding);

        if (user1Embed && user2Embed) {
          const directSimilarity = user1Embed.bioEmbedding && user2Embed.lookingForEmbedding ?
            cosineSim(user1Embed.bioEmbedding, user2Embed.lookingForEmbedding) : 0;

          const reverseSimilarity = user2Embed.bioEmbedding && user1Embed.lookingForEmbedding ?
            cosineSim(user2Embed.bioEmbedding, user1Embed.lookingForEmbedding) : 0;

          score = (directSimilarity * 0.7) + (reverseSimilarity * 0.3);

          if (score > 0.7) {
            matchReason = "Exceptional semantic compatibility";
          } else if (score > 0.5) {
            matchReason = "Strong mutual interest alignment";
          } else if (score > 0.3) {
            matchReason = "Good potential for connection";
          } else if (score > 0.1) {
            matchReason = "Some mutual interests";
          } else {
            matchReason = "Low semantic match";
          }

          if (Math.abs(directSimilarity - reverseSimilarity) > 0.2) {
            matchReason += directSimilarity > reverseSimilarity 
              ? `. ${user1.username} strongly matches ${user2.username}'s preferences`
              : `. ${user2.username} strongly matches ${user1.username}'s preferences`;
          }
        }

        // Always calculate basic match score
        const basicMatch = calculateBasicMatchScore(user1, user2);
        if (!matchReason || basicMatch.score > score) {
          score = basicMatch.score;
          matchReason = basicMatch.reasons.join(". ");
        }

        // Add match regardless of score
        matches.push({ user1, user2, score, matchReason, hasEmbeddings });
      }
    }

    return matches.sort((a, b) => b.score - a.score);
  }, [members, userEmbeddings, showMatches]);

  const personalMatches = useMemo(() => {
    if (!members || !currentUser || !showMatches) return [];
    console.log("Calculating personal matches within group");

    const matches: GroupMatch[] = [];

    // Compare current user with each member except themselves
    for (const member of members) {
      if (member.id === currentUser.id) continue;

      let score = 0;
      let matchReason = "";
      let hasEmbeddings = false;

      const user1Embed = userEmbeddings?.find((ue) => ue.userId === currentUser.id);
      const user2Embed = userEmbeddings?.find((ue) => ue.userId === member.id);

      hasEmbeddings = !!(user1Embed?.bioEmbedding || user1Embed?.lookingForEmbedding) &&
                     !!(user2Embed?.bioEmbedding || user2Embed?.lookingForEmbedding);

      if (user1Embed && user2Embed) {
        const directSimilarity = user1Embed.bioEmbedding && user2Embed.lookingForEmbedding ?
          cosineSim(user1Embed.bioEmbedding, user2Embed.lookingForEmbedding) : 0;

        const reverseSimilarity = user2Embed.bioEmbedding && user1Embed.lookingForEmbedding ?
          cosineSim(user2Embed.bioEmbedding, user1Embed.lookingForEmbedding) : 0;

        score = (directSimilarity * 0.7) + (reverseSimilarity * 0.3);

        if (score > 0.7) {
          matchReason = "Exceptional semantic compatibility";
        } else if (score > 0.5) {
          matchReason = "Strong mutual interest alignment";
        } else if (score > 0.3) {
          matchReason = "Good potential for connection";
        } else if (score > 0.1) {
          matchReason = "Some mutual interests";
        } else {
          matchReason = "Low semantic match";
        }

        if (Math.abs(directSimilarity - reverseSimilarity) > 0.2) {
          matchReason += directSimilarity > reverseSimilarity 
            ? `. Your profile strongly matches ${member.username}'s preferences`
            : `. ${member.username} strongly matches your preferences`;
        }
      }

      // Always calculate basic match score
      const basicMatch = calculateBasicMatchScore(currentUser, member);
      if (!matchReason || basicMatch.score > score) {
        score = basicMatch.score;
        matchReason = basicMatch.reasons.join(". ");
      }

      matches.push({ 
        user1: currentUser, 
        user2: member, 
        score, 
        matchReason, 
        hasEmbeddings 
      });
    }

    return matches.sort((a, b) => b.score - a.score);
  }, [members, currentUser, userEmbeddings, showMatches]);

  const toggleMembership = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/groups/${params?.id}/${group?.isMember ? 'leave' : 'join'}`, {
        method: "POST",
        credentials: "include",
      });

      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/groups/${params?.id}`] });
      queryClient.invalidateQueries({ queryKey: ["/api/groups"] });
      queryClient.invalidateQueries({ queryKey: [`/api/groups/${params?.id}/members`] });
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

  const generateQRCode = async () => {
    try {
      const groupUrl = `${window.location.origin}/groups/${params?.id}`;
      const qrCode = await QRCode.toDataURL(groupUrl);
      setQrCodeUrl(qrCode);
    } catch (error) {
      console.error("Failed to generate QR code:", error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to generate QR code",
      });
    }
  };

  if (groupLoading || membersLoading) {
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
    <div className="max-w-4xl mx-auto px-4 py-6">
      <Card className="mb-8">
        <CardContent className="flex flex-col md:flex-row items-start gap-6 p-6">
          <Avatar className="h-24 w-24 flex-shrink-0 mx-auto md:mx-0">
            <AvatarImage src={`https://api.dicebear.com/7.x/shapes/svg?seed=${group?.name}`} />
            <AvatarFallback>{group?.name?.[0]}</AvatarFallback>
          </Avatar>

          <div className="flex-1 space-y-4 w-full">
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
              <div>
                <h1 className="text-2xl font-bold">{group?.name}</h1>
                <div className="text-sm text-muted-foreground">
                  Created by{" "}
                  <Link href={`/profile/${group?.creator.id}`} className="hover:underline">
                    {group?.creator.username}
                  </Link>
                </div>
              </div>
              <div className="flex flex-wrap gap-2 w-full md:w-auto">
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => {
                    setQrCodeDialogOpen(true);
                    generateQRCode();
                  }}
                >
                  <QrCode className="h-4 w-4" />
                </Button>
                <Button
                  onClick={() => toggleMembership.mutate()}
                  variant={group?.isMember ? "outline" : "default"}
                  className="flex-1 md:flex-none"
                >
                  {toggleMembership.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : group?.isMember ? (
                    "Leave Group"
                  ) : (
                    "Join Group"
                  )}
                </Button>
              </div>
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
                  {group?.description || "No description yet"}
                </p>
                {currentUser?.id === group?.creator.id && (
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
            <div className="flex-1">
              <h2 className="text-xl font-semibold">Members ({group?.memberCount})</h2>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowMatches(!showMatches)}
              className="ml-auto"
            >
              {showMatches ? "Hide Matches" : "Show Matches"}
            </Button>
          </div>

          {!members?.length ? (
            <p className="text-muted-foreground">No members yet</p>
          ) : (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 mb-6">
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

              {showMatches && (
                <>
                  <div className="mt-6 space-y-4">
                    <h3 className="text-lg font-semibold">Your Matches in This Group</h3>
                    {personalMatches.length > 0 ? (
                      <div className="grid gap-4">
                        {personalMatches.map(({ user2: member, score, matchReason, hasEmbeddings }) => (
                          <Card key={member.id} className="hover:bg-accent transition-colors">
                            <CardContent className="p-4">
                              <div className="flex items-center gap-4">
                                <Link href={`/profile/${member.id}`}>
                                  <div className="flex items-center gap-2 hover:underline">
                                    <Avatar className="h-8 w-8">
                                      <AvatarImage
                                        src={member.avatar || `https://api.dicebear.com/7.x/avatars/svg?seed=${member.username}`}
                                      />
                                      <AvatarFallback>{member.username[0]}</AvatarFallback>
                                    </Avatar>
                                    <span className="font-medium">{member.username}</span>
                                  </div>
                                </Link>
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2">
                                    <span className="text-sm font-medium">Match Score:</span>
                                    <Progress value={score * 100} className="w-32" />
                                    <span className="text-sm text-muted-foreground">
                                      {Math.round(score * 100)}%
                                    </span>
                                    {!hasEmbeddings && (
                                      <TooltipProvider>
                                        <Tooltip>
                                          <TooltipTrigger>
                                            <AlertCircle className="h-4 w-4 text-muted-foreground" />
                                          </TooltipTrigger>
                                          <TooltipContent>
                                            <p>Basic matching only - semantic embeddings not yet available</p>
                                          </TooltipContent>
                                        </Tooltip>
                                      </TooltipProvider>
                                    )}
                                  </div>
                                  <p className="text-sm text-muted-foreground mt-1">
                                    {matchReason}
                                  </p>
                                </div>
                              </div>
                            </CardContent>
                          </Card>
                        ))}
                      </div>
                    ) : (
                      <p className="text-muted-foreground">
                        No matches found between you and other group members yet. This could be because profiles haven't been completed or no matching criteria were met.
                      </p>
                    )}
                  </div>
                  <Separator className="my-6" />
                  <div className="mt-6 space-y-4">
                    <h3 className="text-lg font-semibold">All Group Match Strengths</h3>
                    {groupMatches.length > 0 ? (
                      <div className="grid gap-4">
                        {groupMatches.map(({ user1, user2, score, matchReason, hasEmbeddings }, index) => (
                          <Card key={`${user1.id}-${user2.id}`} className="hover:bg-accent transition-colors">
                            <CardContent className="p-4">
                              <div className="flex items-center gap-4">
                                <div className="flex items-center gap-2">
                                  <Link href={`/profile/${user1.id}`}>
                                    <div className="flex items-center gap-2 hover:underline">
                                      <Avatar className="h-8 w-8">
                                        <AvatarImage 
                                          src={user1.avatar || `https://api.dicebear.com/7.x/avatars/svg?seed=${user1.username}`}
                                        />
                                        <AvatarFallback>{user1.username[0]}</AvatarFallback>
                                      </Avatar>
                                      <span className="font-medium">{user1.username}</span>
                                    </div>
                                  </Link>
                                  <span className="text-muted-foreground">&</span>
                                  <Link href={`/profile/${user2.id}`}>
                                    <div className="flex items-center gap-2 hover:underline">
                                      <Avatar className="h-8 w-8">
                                        <AvatarImage
                                          src={user2.avatar || `https://api.dicebear.com/7.x/avatars/svg?seed=${user2.username}`}
                                        />
                                        <AvatarFallback>{user2.username[0]}</AvatarFallback>
                                      </Avatar>
                                      <span className="font-medium">{user2.username}</span>
                                    </div>
                                  </Link>
                                </div>
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2">
                                    <span className="text-sm font-medium">Match Score:</span>
                                    <Progress value={score * 100} className="w-32" />
                                    <span className="text-sm text-muted-foreground">
                                      {Math.round(score * 100)}%
                                    </span>
                                    {!hasEmbeddings && (
                                      <TooltipProvider>
                                        <Tooltip>
                                          <TooltipTrigger>
                                            <AlertCircle className="h-4 w-4 text-muted-foreground" />
                                          </TooltipTrigger>
                                          <TooltipContent>
                                            <p>Basic matching only - semantic embeddings not yet available</p>
                                          </TooltipContent>
                                        </Tooltip>
                                      </TooltipProvider>
                                    )}
                                  </div>
                                  <p className="text-sm text-muted-foreground mt-1">
                                    {matchReason}
                                  </p>
                                </div>
                              </div>
                            </CardContent>
                          </Card>
                        ))}
                      </div>
                    ) : (
                      <p className="text-muted-foreground">
                        No strong matches found between group members yet. This could be because members haven't completed their profiles or the matching threshold wasn't met.
                      </p>
                    )}
                  </div>
                </>
              )}
            </>
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
              showStarredOnly={showStarredOnly}
              onStarredFilterChange={setShowStarredOnly}
            />
          </div>
        </div>
        {group?.isMember && (
          <CreatePost
            groupId={group.id}
            onSuccess={() => {
              queryClient.invalidateQueries({ queryKey: [`/api/groups/${params?.id}/posts`] });
              queryClient.invalidateQueries({ queryKey: [`/api/groups/${params?.id}`] });
            }}
          />
        )}

        <PostFeed 
          groupId={group?.id} 
          searchQuery={searchQuery}
          showStatusOnly={showStatusOnly}
          selectedStatuses={selectedStatuses}
          showStarredOnly={showStarredOnly}
        />
      </div>

      <Dialog open={qrCodeDialogOpen} onOpenChange={setQrCodeDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Share Group via QR Code</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col items-center gap-4 p-4">
            {qrCodeUrl ? (
              <img src={qrCodeUrl} alt="Group QR Code" className="w-64 h-64" />
            ) : (
              <div className="w-64 h-64 flex items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin" />
              </div>
            )}
            <p className="text-sm text-muted-foreground text-center">
              Scan this QR code to join the group
            </p>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}