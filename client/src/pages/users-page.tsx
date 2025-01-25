// userspage.tsx
import { useState, useEffect, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import Fuse from "fuse.js";
import { pipeline, Pipeline } from "@xenova/transformers";
import { Loader2, Users, Search } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
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

export default function UsersPage() {
  const { user: currentUser } = useUser();
  const [searchQuery, setSearchQuery] = useState("");
  const [searchMode, setSearchMode] = useState<"fuzzy" | "embed">("fuzzy");

  const { data: users, isLoading } = useQuery<(Pick<User, "id" | "username" | "avatar" | "bio">)[]>({
    queryKey: ["/api/users"],
  });
  const { data: friends } = useQuery({
    queryKey: ["/api/friends"],
  });

  // fuse instance
  const [fuse, setFuse] = useState<Fuse<Pick<User, "id" | "username" | "avatar" | "bio">>>();

  // xenova pipeline
  const [model, setModel] = useState<Pipeline | null>(null);

  // store user embeddings
  const [userEmbeddings, setUserEmbeddings] = useState<
    { id: number; embedding: number[] }[]
  >([]);

  // load model once
  useEffect(() => {
    pipeline('feature-extraction', 'distilbert-base-uncased')
      .then((p) => setModel(p as Pipeline))
      .catch(console.error);
  }, []);

  // once we have users, init fuse
  useEffect(() => {
    if (!users) return;
    const fuseOptions: Fuse.IFuseOptions<Pick<User, "id" | "username" | "avatar" | "bio">> = {
      keys: ["username", "bio"],
      threshold: 0.3,
      includeScore: true,
    };
    setFuse(new Fuse(users, fuseOptions));
  }, [users]);

  // embed each user's text once model is ready
  useEffect(() => {
    if (!model || !users) return;
    (async () => {
      const nextEmbeds: { id: number; embedding: number[] }[] = [];
      for (const u of users) {
        const text = `${u.username} ${u.bio ?? ""}`;
        const output = await model(text);
        const vectors = output[0]; // shape [tokenCount, hiddenSize]
        // average them
        const avgVec = vectors[0].map((_: number, col: number) => {
          let sum = 0;
          for (let row = 0; row < vectors.length; row++) {
            sum += vectors[row][col];
          }
          return sum / vectors.length;
        });
        nextEmbeds.push({ id: u.id, embedding: avgVec });
      }
      setUserEmbeddings(nextEmbeds);
    })();
  }, [model, users]);

  // fuzzy results
  const fuzzyResults = useMemo(() => {
    if (!fuse || !users) return [];
    const q = searchQuery.trim();
    if (!q) return users;
    const results = fuse.search(q);
    return results.map((r) => r.item);
  }, [fuse, users, searchQuery]);

  // local embedding-based results
  const [queryEmbedding, setQueryEmbedding] = useState<number[] | null>(null);

  // embed the query whenever it changes
  useEffect(() => {
    if (!model || !searchQuery.trim()) {
      setQueryEmbedding(null);
      return;
    }
    (async () => {
      const out = await model(searchQuery);
      const vectors = out[0];
      const avgVec = vectors[0].map((_: number, col: number) => {
        let sum = 0;
        for (let row = 0; row < vectors.length; row++) {
          sum += vectors[row][col];
        }
        return sum / vectors.length;
      });
      setQueryEmbedding(avgVec);
    })();
  }, [model, searchQuery]);

  const embedResults = useMemo(() => {
    if (!users || !userEmbeddings.length) return [];
    if (!queryEmbedding) {
      // no query or still embedding -> show all if query is blank
      if (!searchQuery.trim()) return users;
      return [];
    }
    const userMap = new Map(users.map((u) => [u.id, u]));
    return userEmbeddings
      .map((ue) => ({
        id: ue.id,
        score: cosineSim(ue.embedding, queryEmbedding),
      }))
      .sort((a, b) => b.score - a.score)
      .map((x) => userMap.get(x.id));
  }, [users, userEmbeddings, queryEmbedding, searchQuery]);

  const displayed = searchMode === "fuzzy" ? fuzzyResults : embedResults;

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
        <h1 className="text-2xl font-bold">browse users</h1>
      </div>

      <div className="mb-4 flex gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="search users..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
        <select
          value={searchMode}
          onChange={(e) => setSearchMode(e.target.value as "fuzzy" | "embed")}
          className="border border-gray-300 rounded px-2 py-1"
        >
          <option value="fuzzy">fuzzy (fuse)</option>
          <option value="embed">embed (xenova)</option>
        </select>
      </div>

      {displayed.length === 0 && (
        <div className="col-span-full text-center py-8 text-muted-foreground">
          no matching users
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {displayed.map((u) => {
          if (!u) return null;
          const friendRequest = friends?.find(
            (f) =>
              (f.userId === currentUser?.id && f.friendId === u.id) ||
              (f.userId === u.id && f.friendId === currentUser?.id)
          );
          return (
            <Card key={u.id} className="hover:bg-accent transition-colors">
              <CardContent className="p-6">
                <div className="flex items-center gap-4">
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
                    {u.bio && (
                      <p className="text-sm text-muted-foreground line-clamp-2">
                        {u.bio}
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
      </div>
    </div>
  );
}