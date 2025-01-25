import { useQuery } from "@tanstack/react-query";
import PostCard from "@/components/post-card";
import CreatePost from "@/components/create-post";
import { Loader2 } from "lucide-react";
import type { Post } from "@db/schema";
import PostFeed from "@/components/post-feed";

export default function HomePage() {
  return (
    <div className="max-w-2xl mx-auto">
      <CreatePost />
      <div className="mt-6">
        <PostFeed />
      </div>
    </div>
  );
}