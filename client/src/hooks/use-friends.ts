import { useQuery } from "@tanstack/react-query";
import type { Friend } from "@db/schema";
import { useUser } from "./use-user";

export function useFriends() {
  const { user } = useUser();

  return useQuery<Friend[]>({
    queryKey: ["/api/friends"],
    enabled: !!user,
  });
}
