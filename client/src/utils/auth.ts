import { useQuery } from "@tanstack/react-query";
import type { User, Friend } from "@db/schema";

export const useCurrentUser = () => {
  return useQuery<User | null>({
    queryKey: ["/api/auth/me"],
  });
};

export const useFriends = () => {
  return useQuery<Friend[]>({
    queryKey: ["/api/friends"],
  });
};

// Exported for direct access in components
export const { data: currentUser } = useCurrentUser();
export const { data: friends } = useFriends();
