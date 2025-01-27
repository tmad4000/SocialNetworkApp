import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import NotFound from "@/pages/not-found";
import HomePage from "@/pages/home-page";
import AuthPage from "@/pages/auth-page";
import ProfilePage from "@/pages/profile-page";
import UsersPage from "@/pages/users-page";
import MatchesPage from "@/pages/matches-page";
import GroupsPage from "@/pages/groups-page";
import GroupPage from "@/pages/group-page";
import PostPage from "@/pages/post-page";
import BestIdeasPage from "@/pages/best-ideas-page";
import { useUser } from "@/hooks/use-user";
import { Loader2 } from "lucide-react";
import Navbar from "@/components/navbar";
import { useNotifications } from "@/components/notification-toast";

function Router() {
  const { user, isLoading } = useUser();

  // Initialize notifications if user is logged in
  useNotifications();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-border" />
      </div>
    );
  }

  if (!user) {
    return <AuthPage />;
  }

  return (
    <div>
      <Navbar />
      <main className="container mx-auto px-4 py-8">
        <Switch>
          <Route path="/" component={HomePage} />
          <Route path="/profile/:id" component={ProfilePage} />
          <Route path="/users" component={UsersPage} />
          <Route path="/groups" component={GroupsPage} />
          <Route path="/groups/:id" component={GroupPage} />
          <Route path="/matches" component={MatchesPage} />
          <Route path="/post/:id" component={PostPage} />
          <Route path="/best-ideas" component={BestIdeasPage} />
          <Route component={NotFound} />
        </Switch>
      </main>
    </div>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <Router />
      <Toaster />
    </QueryClientProvider>
  );
}

export default App;