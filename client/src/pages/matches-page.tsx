import { useState, useEffect, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { Loader2, Users, AlertCircle, Network } from "lucide-react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Progress } from "@/components/ui/progress";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Separator } from "@/components/ui/separator";
import FriendRequest from "@/components/friend-request";
import { useUser } from "@/hooks/use-user";
import { cosineSim, calculateBasicMatchScore } from "@/utils/match-utils";
import type { User, Friend } from "@db/schema";

type UserWithScore = {
  user: Pick<User, "id" | "username" | "avatar" | "bio" | "lookingFor">;
  score: number;
  matchReason: string;
  hasEmbeddings: boolean;
};

type NetworkMatch = {
  user1: Pick<User, "id" | "username" | "avatar">;
  user2: Pick<User, "id" | "username" | "avatar">;
  score: number;
  matchReason: string;
  hasEmbeddings: boolean;
};


export default function MatchesPage() {
  const { user: currentUser } = useUser();

  const { data: friends = [] } = useQuery<Friend[]>({
    queryKey: ["/api/friends"],
    enabled: !!currentUser,
  });

  const { data: userEmbeddings } = useQuery<{
    id: number;
    userId: number;
    bioEmbedding: number[] | null;
    lookingForEmbedding: number[] | null;
  }[]>({
    queryKey: ["/api/user-embeddings"],
  });

  const { data: users, isLoading } = useQuery<
    (Pick<User, "id" | "username" | "avatar" | "bio" | "lookingFor">)[]
  >({
    queryKey: ["/api/users"],
  });

  // Calculate matches for current user
  const matches = useMemo(() => {
    if (!users || !currentUser) return [];
    console.log("Processing matches for users:", users.length);

    const matchResults: UserWithScore[] = [];
    const currentUserEmbeddings = userEmbeddings?.find(
      (ue) => ue.userId === currentUser.id
    );

    for (const user of users) {
      if (user.id === currentUser.id) continue;

      let score = 0;
      let matchReason = "";
      let hasEmbeddings = false;

      if (currentUserEmbeddings) {
        const userEmbed = userEmbeddings?.find((ue) => ue.userId === user.id);
        hasEmbeddings = !!userEmbed?.bioEmbedding || !!userEmbed?.lookingForEmbedding;

        if (userEmbed) {
          const bioSimilarity = userEmbed.bioEmbedding && currentUserEmbeddings.lookingForEmbedding ?
            cosineSim(userEmbed.bioEmbedding, currentUserEmbeddings.lookingForEmbedding) : 0;

          const reverseSimilarity = currentUserEmbeddings.bioEmbedding && userEmbed.lookingForEmbedding ?
            cosineSim(currentUserEmbeddings.bioEmbedding, userEmbed.lookingForEmbedding) : 0;

          score = (bioSimilarity * 0.7) + (reverseSimilarity * 0.3);

          if (score > 0.7) {
            matchReason = "Strong semantic alignment between profiles";
          } else if (score > 0.5) {
            matchReason = "Good semantic match based on profiles";
          } else if (score > 0.3) {
            matchReason = "Moderate semantic compatibility";
          } else if (score > 0.1) {
            matchReason = "Some semantic overlap in interests";
          }

          if (bioSimilarity > reverseSimilarity) {
            matchReason += ". Their profile strongly matches your preferences";
          } else if (reverseSimilarity > bioSimilarity) {
            matchReason += ". You strongly match what they're looking for";
          }
        }
      }

      if (!matchReason || score < 0.1) {
        const basicMatch = calculateBasicMatchScore(currentUser, user);
        if (basicMatch.score > score) {
          score = basicMatch.score;
          matchReason = basicMatch.reasons.join(". ");
        }
      }

      // Only add matches with non-zero scores
      if (score > 0.1) {
        matchResults.push({
          user,
          score,
          matchReason,
          hasEmbeddings
        });
      }
    }

    return matchResults.sort((a, b) => b.score - a.score);
  }, [users, currentUser, userEmbeddings]);

  // Calculate network-wide matches between all users
  const networkMatches = useMemo(() => {
    if (!users) return [];
    console.log("Processing network-wide matches");

    const allMatches: NetworkMatch[] = [];

    // Compare each pair of users
    for (let i = 0; i < users.length; i++) {
      for (let j = i + 1; j < users.length; j++) {
        const user1 = users[i];
        const user2 = users[j];

        let score = 0;
        let matchReason = "";
        let hasEmbeddings = false;

        // Get embeddings for both users
        const user1Embed = userEmbeddings?.find((ue) => ue.userId === user1.id);
        const user2Embed = userEmbeddings?.find((ue) => ue.userId === user2.id);

        hasEmbeddings = !!(user1Embed?.bioEmbedding || user1Embed?.lookingForEmbedding) &&
                       !!(user2Embed?.bioEmbedding || user2Embed?.lookingForEmbedding);

        if (user1Embed && user2Embed) {
          const directSimilarity = user1Embed.bioEmbedding && user2Embed.lookingForEmbedding ?
            cosineSim(user1Embed.bioEmbedding, user2Embed.lookingForEmbedding) : 0;

          const reverseSimilarity = user2Embed.bioEmbedding && user1Embed.lookingForEmbedding ?
            cosineSim(user2Embed.bioEmbedding, user1Embed.lookingForEmbedding) : 0;

          score = (directSimilarity + reverseSimilarity) / 2; // Average both directions

          if (score > 0.7) {
            matchReason = "Exceptional semantic compatibility";
          } else if (score > 0.5) {
            matchReason = "Strong mutual interest alignment";
          } else if (score > 0.3) {
            matchReason = "Good potential for connection";
          } else if (score > 0.1) {
            matchReason = "Some mutual interests";
          }

          // Add direction info if there's a significant difference
          if (Math.abs(directSimilarity - reverseSimilarity) > 0.2) {
            matchReason += directSimilarity > reverseSimilarity 
              ? `. ${user1.username} strongly matches ${user2.username}'s preferences`
              : `. ${user2.username} strongly matches ${user1.username}'s preferences`;
          }
        }

        if (!matchReason || score < 0.1) {
          const basicMatch = calculateBasicMatchScore(user1, user2);
          if (basicMatch.score > score) {
            score = basicMatch.score;
            matchReason = basicMatch.reasons.join(". ");
          }
        }

        // Only include meaningful matches (>10% match score)
        if (score > 0.1) {
          allMatches.push({
            user1: {
              id: user1.id,
              username: user1.username,
              avatar: user1.avatar,
            },
            user2: {
              id: user2.id,
              username: user2.username,
              avatar: user2.avatar,
            },
            score,
            matchReason,
            hasEmbeddings
          });
        }
      }
    }

    // Return top 5 matches
    return allMatches.sort((a, b) => b.score - a.score).slice(0, 5);
  }, [users, userEmbeddings]);

  if (isLoading) {
    return (
      <div className="flex justify-center p-8">
        <Loader2 className="h-8 w-8 animate-spin text-border" />
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8">
      <CardHeader className="px-0">
        <div className="flex items-center gap-2">
          <Users className="h-6 w-6" />
          <CardTitle className="text-2xl">Your Matches</CardTitle>
        </div>
      </CardHeader>

      {!currentUser?.lookingFor && (
        <Card className="mb-8">
          <CardContent className="p-6">
            <p className="text-muted-foreground">
              Add what you're looking for in your profile to see better match scores!
            </p>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 gap-4">
        {matches.map(({ user: u, score, matchReason, hasEmbeddings }) => {
          const friendRequest = friends.find(
            (f) =>
              (f.userId === currentUser?.id && f.friendId === u.id) ||
              (f.userId === u.id && f.friendId === currentUser?.id)
          );

          return (
            <Card key={u.id} className="hover:bg-accent transition-colors">
              <CardContent className="p-6">
                <div className="flex flex-col md:flex-row md:items-start gap-6">
                  <div className="flex items-start gap-4">
                    <Avatar className="h-12 w-12">
                      <AvatarImage
                        src={
                          u.avatar ||
                          `https://api.dicebear.com/7.x/avatars/svg?seed=${u.username}`
                        }
                      />
                      <AvatarFallback>{u.username[0]}</AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <Link href={`/profile/${u.id}`}>
                        <h2 className="font-semibold truncate cursor-pointer hover:underline">
                          {u.username}
                        </h2>
                      </Link>
                      <div className="mt-2 space-y-2">
                        <div>
                          <div className="flex items-center gap-2 mb-1">
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
                          <p className="text-sm text-muted-foreground">
                            {matchReason}
                          </p>
                        </div>
                        {u.bio && (
                          <div>
                            <p className="text-sm font-medium">Bio:</p>
                            <p className="text-sm text-muted-foreground line-clamp-2">
                              {u.bio}
                            </p>
                          </div>
                        )}
                        {u.lookingFor && (
                          <div>
                            <p className="text-sm font-medium">Looking for:</p>
                            <p className="text-sm text-muted-foreground">
                              {u.lookingFor}
                            </p>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex justify-center md:justify-end mt-4 md:mt-0">
                    <FriendRequest
                      userId={u.id}
                      status={friendRequest?.status}
                      requestId={friendRequest?.id}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}

        {matches.length === 0 && currentUser?.lookingFor && (
          <div className="col-span-full text-center py-8 text-muted-foreground">
            No matches found yet. Keep checking back as more users join!
          </div>
        )}
      </div>

      {/* Network-wide Matches Section */}
      <div className="mt-12">
        <CardHeader className="px-0">
          <div className="flex items-center gap-2">
            <Network className="h-6 w-6" />
            <div>
              <CardTitle className="text-2xl">Strongest Network Matches</CardTitle>
              <CardDescription>Top matches between all users in the network</CardDescription>
            </div>
          </div>
        </CardHeader>

        <div className="grid grid-cols-1 gap-4 mt-4">
          {networkMatches.map(({ user1, user2, score, matchReason, hasEmbeddings }) => (
            <Card key={`${user1.id}-${user2.id}`} className="hover:bg-accent transition-colors">
              <CardContent className="p-6">
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-2">
                    <Link href={`/profile/${user1.id}`}>
                      <div className="flex items-center gap-2 hover:underline">
                        <Avatar className="h-8 w-8">
                          <AvatarImage
                            src={
                              user1.avatar ||
                              `https://api.dicebear.com/7.x/avatars/svg?seed=${user1.username}`
                            }
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
                            src={
                              user2.avatar ||
                              `https://api.dicebear.com/7.x/avatars/svg?seed=${user2.username}`
                            }
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

          {networkMatches.length === 0 && (
            <div className="text-center py-8 text-muted-foreground">
              No strong network matches found yet. This section will show the top matches between any users as more people join and complete their profiles.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}