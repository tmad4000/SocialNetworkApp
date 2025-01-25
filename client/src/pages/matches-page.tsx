import { useState, useEffect, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { Loader2, Users, AlertCircle } from "lucide-react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Progress } from "@/components/ui/progress";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import FriendRequest from "@/components/friend-request";
import { useUser } from "@/hooks/use-user";
import type { User, Friend } from "@db/schema";

type UserWithScore = {
  user: Pick<User, "id" | "username" | "avatar" | "bio" | "lookingFor">;
  score: number;
  matchReason: string;
  hasEmbeddings: boolean;
};

function cosineSim(a: number[], b: number[]) {
  if (!a || !b || a.length !== b.length) return 0;

  let dot = 0,
    magA = 0,
    magB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    magA += a[i] * a[i];
    magB += b[i] * b[i];
  }
  return dot / (Math.sqrt(magA) * Math.sqrt(magB) || 1);
}

function calculateBasicMatchScore(
  currentUser: Pick<User, "bio" | "lookingFor">,
  otherUser: Pick<User, "bio" | "lookingFor">
): { score: number; reasons: string[] } {
  const reasons: string[] = [];
  let totalScore = 0;

  // Check if both users have content
  if (!currentUser.bio && !currentUser.lookingFor && !otherUser.bio && !otherUser.lookingFor) {
    return {
      score: 0.1,
      reasons: ["Complete your profile to get better matches"]
    };
  }

  // Simple keyword-based scoring as fallback
  if (currentUser.lookingFor && otherUser.bio) {
    totalScore += 0.5;
    reasons.push("Their profile contains keywords matching your interests");
  }

  if (otherUser.lookingFor && currentUser.bio) {
    totalScore += 0.3;
    reasons.push("Your profile contains keywords matching their interests");
  }

  return {
    score: Math.min(1, totalScore),
    reasons: reasons.length > 0 ? reasons : ["Basic profile compatibility"]
  };
}

export default function MatchesPage() {
  const { user: currentUser } = useUser();

  const { data: friends = [] } = useQuery<Friend[]>({
    queryKey: ["/api/friends"],
    enabled: !!currentUser,
  });

  // Query for user embeddings
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

  // Calculate matches using embeddings when available, fallback to basic matching
  const matches = useMemo(() => {
    if (!users || !currentUser) return [];
    console.log("Processing matches for users:", users.length);

    const matchResults: UserWithScore[] = [];

    // Get current user's embeddings if available
    const currentUserEmbeddings = userEmbeddings?.find(
      (ue) => ue.userId === currentUser.id
    );

    // Process all users except current user
    for (const user of users) {
      if (user.id === currentUser.id) continue;

      let score = 0;
      let matchReason = "";
      let hasEmbeddings = false;

      // Try embeddings-based matching first
      if (currentUserEmbeddings) {
        const userEmbed = userEmbeddings?.find((ue) => ue.userId === user.id);
        hasEmbeddings = !!userEmbed?.bioEmbedding || !!userEmbed?.lookingForEmbedding;

        if (userEmbed) {
          // Calculate bidirectional match scores
          const bioSimilarity = userEmbed.bioEmbedding && currentUserEmbeddings.lookingForEmbedding ?
            cosineSim(userEmbed.bioEmbedding, currentUserEmbeddings.lookingForEmbedding) : 0;

          const reverseSimilarity = currentUserEmbeddings.bioEmbedding && userEmbed.lookingForEmbedding ?
            cosineSim(currentUserEmbeddings.bioEmbedding, userEmbed.lookingForEmbedding) : 0;

          // Weight the scores (70% what you're looking for, 30% what they're looking for)
          score = (bioSimilarity * 0.7) + (reverseSimilarity * 0.3);

          // Generate semantic match reasons
          if (score > 0.7) {
            matchReason = "Strong semantic alignment between profiles";
          } else if (score > 0.5) {
            matchReason = "Good semantic match based on profiles";
          } else if (score > 0.3) {
            matchReason = "Moderate semantic compatibility";
          } else {
            matchReason = "Some semantic overlap in interests";
          }

          // Add specific details about match direction
          if (bioSimilarity > reverseSimilarity) {
            matchReason += ". Their profile strongly matches your preferences";
          } else if (reverseSimilarity > bioSimilarity) {
            matchReason += ". You strongly match what they're looking for";
          }
        }
      }

      // Fall back to basic matching if no embeddings or low embedding score
      if (!matchReason || score < 0.2) {
        const basicMatch = calculateBasicMatchScore(currentUser, user);
        if (basicMatch.score > score) {
          score = basicMatch.score;
          matchReason = basicMatch.reasons.join(". ");
        }
      }

      // If no meaningful match found, provide a default reason
      if (!matchReason) {
        matchReason = "New user - update your profiles to see better matches";
        score = 0.1; // Give a small base score
      }

      matchResults.push({
        user,
        score,
        matchReason,
        hasEmbeddings
      });
    }

    console.log("Generated match results:", matchResults.length);
    return matchResults.sort((a, b) => b.score - a.score);
  }, [users, currentUser, userEmbeddings]);

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
          <CardTitle className="text-2xl">All Users and Match Scores</CardTitle>
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
    </div>
  );
}