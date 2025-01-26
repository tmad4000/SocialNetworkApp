import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { NewUser, User } from "@db/schema";

type RequestResult = {
  ok: true;
  userId?: number;
} | {
  ok: false;
  message: string;
};

type StoredCredentials = {
  username: string;
  password: string;
};

async function handleRequest(
  url: string,
  method: string,
  body?: NewUser
): Promise<RequestResult> {
  try {
    const response = await fetch(url, {
      method,
      headers: body ? { "Content-Type": "application/json" } : undefined,
      body: body ? JSON.stringify(body) : undefined,
      credentials: "include",
    });

    if (!response.ok) {
      if (response.status >= 500) {
        return { ok: false, message: response.statusText };
      }

      const message = await response.text();
      return { ok: false, message };
    }

    const data = await response.json();
    return { ok: true, userId: data.user?.id };
  } catch (e: any) {
    return { ok: false, message: e.toString() };
  }
}

async function fetchUser(): Promise<User | null> {
  const response = await fetch('/api/user', {
    credentials: 'include'
  });

  if (!response.ok) {
    if (response.status === 401) {
      // Try to auto-login if we have stored credentials
      const stored = localStorage.getItem('auth');
      if (stored) {
        const credentials: StoredCredentials = JSON.parse(stored);
        const loginResult = await handleRequest('/api/login', 'POST', credentials);
        if (loginResult.ok) {
          const retryResponse = await fetch('/api/user', {
            credentials: 'include'
          });
          if (retryResponse.ok) {
            return retryResponse.json();
          }
        }
        // If auto-login fails, clear stored credentials
        localStorage.removeItem('auth');
      }
      return null;
    }

    if (response.status >= 500) {
      throw new Error(`${response.status}: ${response.statusText}`);
    }

    throw new Error(`${response.status}: ${await response.text()}`);
  }

  return response.json();
}

export function useUser() {
  const queryClient = useQueryClient();

  const { data: user, error, isLoading } = useQuery<User | null, Error>({
    queryKey: ['user'],
    queryFn: fetchUser,
    staleTime: Infinity,
    retry: false
  });

  const loginMutation = useMutation<RequestResult, Error, NewUser>({
    mutationFn: (userData) => handleRequest('/api/login', 'POST', userData),
    onSuccess: (_, variables) => {
      // Store credentials on successful login
      localStorage.setItem('auth', JSON.stringify({
        username: variables.username,
        password: variables.password
      }));
      queryClient.invalidateQueries({ queryKey: ['user'] });
    },
  });

  const logoutMutation = useMutation<RequestResult, Error>({
    mutationFn: () => handleRequest('/api/logout', 'POST'),
    onSuccess: () => {
      // Clear stored credentials on logout
      localStorage.removeItem('auth');
      queryClient.invalidateQueries({ queryKey: ['user'] });
    },
  });

  const registerMutation = useMutation<RequestResult, Error, NewUser>({
    mutationFn: (userData) => handleRequest('/api/register', 'POST', userData),
    onSuccess: (_, variables) => {
      // Store credentials on successful registration
      localStorage.setItem('auth', JSON.stringify({
        username: variables.username,
        password: variables.password
      }));
      queryClient.invalidateQueries({ queryKey: ['user'] });
    },
  });

  return {
    user,
    isLoading,
    error,
    login: loginMutation.mutateAsync,
    logout: logoutMutation.mutateAsync,
    register: registerMutation.mutateAsync,
  };
}