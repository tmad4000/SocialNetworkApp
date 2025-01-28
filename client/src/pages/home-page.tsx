import { useQuery } from "@tanstack/react-query";
import PostCard from "@/components/post-card";
import CreatePost from "@/components/create-post";
import { Loader2 } from "lucide-react";
import type { Post } from "@db/schema";
import PostFeed from "@/components/post-feed";
import { useState } from "react";

export default function HomePage() {
  const [viewMode, setViewMode] = useState<'standard' | 'minimalist'>('standard');

  return (
    <div className="max-w-2xl mx-auto">
      <CreatePost />
      <div className="mt-6">
        <PostFeed viewMode={viewMode} onViewModeChange={setViewMode} />
      </div>
    </div>
  );
}