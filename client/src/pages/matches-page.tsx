import { useState, useEffect, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { pipeline, Pipeline } from "@xenova/transformers";
import { Loader2, Users } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import FriendRequest from "@/components/friend-request";
import { useUser } from "@/hooks/use-user";
import type { User } from "@db/schema";

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

type UserWithScore = {
  user: Pick<User, "id" | "username" | "avatar" | "bio" | "lookingFor">;
  score: number;
  matchReason: string;
};

export default function MatchesPage() {
  const { user: currentUser } = useUser();
  const [model, setModel] = useState<Pipeline | null>(null);
  const [userEmbeddings, setUserEmbeddings] = useState<
    { id: number; embedding: number[]; lookingForEmbedding: number[] }[]
  >([]);

  const { data: friends } = useQuery({
    queryKey: ["/api/friends"],
  });

  const { data: users, isLoading } = useQuery<(Pick<User, "id" | "username" | "avatar" | "bio" | "lookingFor">)[]>({
    queryKey: ["/api/users"],
  });

  // load model once
  useEffect(() => {
    pipeline('feature-extraction', 'distilbert-base-uncased')
      .then((p) => setModel(p as Pipeline))
      .catch(console.error);
  }, []);

  // embed each user's text once model is ready
  useEffect(() => {
    if (!model || !users || !currentUser) return;
    (async () => {
      const nextEmbeds: { id: number; embedding: number[]; lookingForEmbedding: number[] }[] = [];
      for (const u of users) {
        if (u.id === currentUser.id) continue; // Skip current user
        
        // Combine bio and what they're looking for
        const userText = `${u.bio ?? ""} ${u.lookingFor ?? ""}`;
        const userOutput = await model(userText);
        const userVectors = userOutput[0];
        
        // Average the vectors for user text
        const avgUserVec = userVectors[0].map((_: number, col: number) => {
          let sum = 0;
          for (let row = 0; row < userVectors.length; row++) {
            sum += userVectors[row][col];
          }
          return sum / userVectors.length;
        });

        // Get embedding for what they're looking for
        const lookingForOutput = await model(u.lookingFor ?? "");
        const lookingForVectors = lookingForOutput[0];
        
        // Average the vectors for looking for text
        const avgLookingForVec = lookingForVectors[0].map((_: number, col: number) => {
          let sum = 0;
          for (let row = 0; row < lookingForVectors.length; row++) {
            sum += lookingForVectors[row][col];
          }
          return sum / lookingForVectors.length;
        });

        nextEmbeds.push({ 
          id: u.id, 
          embedding: avgUserVec,
          lookingForEmbedding: avgLookingForVec
        });
      }
      setUserEmbeddings(nextEmbeds);
    })();
  }, [model, users, currentUser]);

  // Calculate matches
  const matches = useMemo(() => {
    if (!users || !currentUser || !userEmbeddings.length || !currentUser.lookingFor) return [];

    const matchResults: UserWithScore[] = [];
    
    // Get embeddings for current user's looking for text
    const currentUserEmbeddings = userEmbeddings.find(ue => ue.id === currentUser.id);
    if (!currentUserEmbeddings) return [];

    for (const user of users) {
      if (user.id === currentUser.id) continue;
      
      const userEmbed = userEmbeddings.find(ue => ue.id === user.id);
      if (!userEmbed) continue;

      // Calculate bidirectional match scores
      const score1 = cosineSim(currentUserEmbeddings.lookingForEmbedding, userEmbed.embedding);
      const score2 = cosineSim(userEmbed.lookingForEmbedding, currentUserEmbeddings.embedding);
      
      // Use average of bidirectional scores
      const score = (score1 + score2) / 2;

      // Only include significant matches
      if (score > 0.5) {
        matchResults.push({
          user,
          score,
          matchReason: `${Math.round(score * 100)}% match based on mutual interests and goals`,
        });
      }
    }

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
      <div className="flex items-center gap-2 mb-8">
        <Users className="h-6 w-6" />
        <h1 className="text-2xl font-bold">Your Matches</h1>
      </div>

      {!currentUser?.lookingFor && (
        <Card className="mb-8">
          <CardContent className="p-6">
            <p className="text-muted-foreground">
              Add what you're looking for in your profile to see matches!
            </p>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {matches.map(({ user: u, score, matchReason }) => {
          const friendRequest = friends?.find(
            (f) =>
              (f.userId === currentUser?.id && f.friendId === u.id) ||
              (f.userId === u.id && f.friendId === currentUser?.id)
          );

          return (
            <Card key={u.id} className="hover:bg-accent transition-colors">
              <CardContent className="p-6">
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
                    <p className="text-sm text-muted-foreground mb-2">
                      {matchReason}
                    </p>
                    {u.bio && (
                      <p className="text-sm text-muted-foreground line-clamp-2">
                        {u.bio}
                      </p>
                    )}
                    {u.lookingFor && (
                      <p className="text-sm text-muted-foreground mt-2">
                        <strong>Looking for:</strong> {u.lookingFor}
                      </p>
                    )}
                  </div>
                </div>
                <div className="mt-4">
                  <FriendRequest
                    userId={u.id}
                    status={friendRequest?.status}
                    requestId={friendRequest?.id}
                  />
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
