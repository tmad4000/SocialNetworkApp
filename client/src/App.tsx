import { Switch, Route, Redirect } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import NotFound from "@/pages/not-found";
import HomePage from "@/pages/home-page";
import AuthPage from "@/pages/auth-page";
import ProfilePage from "@/pages/profile-page";
import UsersPage from "@/pages/users-page";
import { useUser } from "@/hooks/use-user";
import { Loader2 } from "lucide-react";
import Navbar from "@/components/navbar";

function Router() {
  const { user, isLoading } = useUser();

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
          <Route path="/">
            {() => <Redirect to={`/profile/${user.id}`} />}
          </Route>
          <Route path="/profile/:id" component={ProfilePage} />
          <Route path="/users" component={UsersPage} />
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