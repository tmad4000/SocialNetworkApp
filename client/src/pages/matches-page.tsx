import { useState, useEffect, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { Loader2, Users } from "lucide-react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Progress } from "@/components/ui/progress";
import FriendRequest from "@/components/friend-request";
import { useUser } from "@/hooks/use-user";
import type { User } from "@db/schema";

type UserWithScore = {
  user: Pick<User, "id" | "username" | "avatar" | "bio" | "lookingFor">;
  score: number;
  matchReason: string;
};

function calculateMatchScore(
  currentUser: Pick<User, "bio" | "lookingFor">,
  otherUser: Pick<User, "bio" | "lookingFor">
): { score: number; reasons: string[] } {
  const reasons: string[] = [];
  let totalScore = 0;

  // Helper function to clean and tokenize text
  const tokenize = (text: string | null | undefined) => {
    return (text || "").toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter(word => word.length > 3); // Only consider words longer than 3 chars
  };

  // Compare what current user is looking for with other user's bio
  if (currentUser.lookingFor && otherUser.bio) {
    const lookingForTokens = tokenize(currentUser.lookingFor);
    const bioTokens = tokenize(otherUser.bio);

    const matches = lookingForTokens.filter(token => 
      bioTokens.some(bioToken => bioToken.includes(token) || token.includes(bioToken))
    );

    if (matches.length > 0) {
      totalScore += 0.4 * (matches.length / lookingForTokens.length);
      reasons.push(
        `Their bio matches ${matches.length} keywords from what you're looking for`
      );
    }
  }

  // Compare what other user is looking for with current user's bio
  if (otherUser.lookingFor && currentUser.bio) {
    const lookingForTokens = tokenize(otherUser.lookingFor);
    const bioTokens = tokenize(currentUser.bio);

    const matches = lookingForTokens.filter(token => 
      bioTokens.some(bioToken => bioToken.includes(token) || token.includes(bioToken))
    );

    if (matches.length > 0) {
      totalScore += 0.4 * (matches.length / lookingForTokens.length);
      reasons.push(
        `Your bio matches ${matches.length} keywords from what they're looking for`
      );
    }
  }

  // Compare both users' "looking for" fields for common interests
  if (currentUser.lookingFor && otherUser.lookingFor) {
    const currentTokens = tokenize(currentUser.lookingFor);
    const otherTokens = tokenize(otherUser.lookingFor);

    const matches = currentTokens.filter(token => 
      otherTokens.some(otherToken => otherToken.includes(token) || token.includes(otherToken))
    );

    if (matches.length > 0) {
      totalScore += 0.2 * (matches.length / Math.max(currentTokens.length, otherTokens.length));
      reasons.push(
        `You both mention ${matches.join(", ")} in what you're looking for`
      );
    }
  }

  // If both users have bios, check for common interests
  if (currentUser.bio && otherUser.bio) {
    const currentTokens = tokenize(currentUser.bio);
    const otherTokens = tokenize(otherUser.bio);

    const matches = currentTokens.filter(token => 
      otherTokens.some(otherToken => otherToken.includes(token) || token.includes(otherToken))
    );

    if (matches.length > 0) {
      totalScore += 0.2 * (matches.length / Math.max(currentTokens.length, otherTokens.length));
      reasons.push(
        `You share common interests/skills: ${matches.join(", ")}`
      );
    }
  }

  // Ensure score is between 0 and 1
  totalScore = Math.min(1, Math.max(0, totalScore));

  return {
    score: totalScore,
    reasons: reasons.length > 0 ? reasons : ["No specific matches found based on current information"]
  };
}

export default function MatchesPage() {
  const { user: currentUser } = useUser();

  const { data: friends } = useQuery({
    queryKey: ["/api/friends"],
  });

  const { data: users, isLoading } = useQuery<
    (Pick<User, "id" | "username" | "avatar" | "bio" | "lookingFor">)[]
  >({
    queryKey: ["/api/users"],
  });

  // Calculate matches for all users
  const matches = useMemo(() => {
    if (!users || !currentUser) return [];
    console.log("Processing matches for users:", users.length);

    const matchResults: UserWithScore[] = [];

    // Process all users except current user
    for (const user of users) {
      if (user.id === currentUser.id) continue;

      const { score, reasons } = calculateMatchScore(currentUser, user);

      matchResults.push({
        user,
        score,
        matchReason: reasons.join(". ")
      });
    }

    console.log("Generated match results:", matchResults.length);
    return matchResults.sort((a, b) => b.score - a.score);
  }, [users, currentUser]);

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
        {matches.map(({ user: u, score, matchReason }) => {
          const friendRequest = friends?.find(
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