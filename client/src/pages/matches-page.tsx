import { useState, useEffect, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { pipeline, Pipeline } from "@xenova/transformers";
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

function cosineSim(a: number[], b: number[]) {
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

export default function MatchesPage() {
  const { user: currentUser } = useUser();

  const { data: friends } = useQuery({
    queryKey: ["/api/friends"],
  });

  // Query for user embeddings
  const { data: userEmbeddings } = useQuery<{
    id: number;
    bioEmbedding: number[];
    lookingForEmbedding: number[];
  }[]>({
    queryKey: ["/api/user-embeddings"],
  });

  const { data: users, isLoading } = useQuery<
    (Pick<User, "id" | "username" | "avatar" | "bio" | "lookingFor">)[]
  >({
    queryKey: ["/api/users"],
  });

  // Calculate matches using embeddings
  const matches = useMemo(() => {
    if (!users || !currentUser || !userEmbeddings) return [];
    console.log("Processing matches for users:", users.length);

    const matchResults: UserWithScore[] = [];

    // Get current user's embeddings
    const currentUserEmbeddings = userEmbeddings.find(
      (ue) => ue.id === currentUser.id
    );

    if (!currentUserEmbeddings) return [];

    // Process all users except current user
    for (const user of users) {
      if (user.id === currentUser.id) continue;

      const userEmbed = userEmbeddings.find((ue) => ue.id === user.id);
      if (!userEmbed) continue;

      // Calculate bidirectional match scores
      const bioSimilarity = userEmbed.bioEmbedding && currentUserEmbeddings.lookingForEmbedding ?
        cosineSim(userEmbed.bioEmbedding, currentUserEmbeddings.lookingForEmbedding) : 0;

      const reverseSimilarity = currentUserEmbeddings.bioEmbedding && userEmbed.lookingForEmbedding ?
        cosineSim(currentUserEmbeddings.bioEmbedding, userEmbed.lookingForEmbedding) : 0;

      // Weight the scores (70% what you're looking for, 30% what they're looking for)
      const score = (bioSimilarity * 0.7) + (reverseSimilarity * 0.3);

      // Generate detailed match reasons
      const reasons = [];
      if (score > 0.7) {
        if (bioSimilarity > 0.7) {
          reasons.push("Their profile strongly matches what you're looking for");
        }
        if (reverseSimilarity > 0.7) {
          reasons.push("Your profile strongly matches what they're looking for");
        }
      } else if (score > 0.5) {
        if (bioSimilarity > 0.5) {
          reasons.push("Their profile matches several aspects of what you're looking for");
        }
        if (reverseSimilarity > 0.5) {
          reasons.push("Your profile aligns well with their preferences");
        }
      } else if (score > 0.3) {
        if (bioSimilarity > 0.3) {
          reasons.push("There are some overlapping interests with what you're looking for");
        }
        if (reverseSimilarity > 0.3) {
          reasons.push("You partially match their preferences");
        }
      } else {
        reasons.push("Limited match based on current profile information");
      }

      matchResults.push({
        user,
        score,
        matchReason: reasons.join(". "),
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