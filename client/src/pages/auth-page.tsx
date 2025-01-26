import { useForm } from "react-hook-form";
import { useUser } from "@/hooks/use-user";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { Textarea } from "@/components/ui/textarea";
import type { NewUser } from "@db/schema";
import { useMutation } from "@tanstack/react-query";

type RegisterFormData = NewUser & {
  bio?: string;
  lookingFor?: string;
  ideas?: string;
};

type PostsToCreate = {
  content: string;
  targetUserId?: number;
};

export default function AuthPage() {
  const { login, register } = useUser();
  const { toast } = useToast();

  const loginForm = useForm<NewUser>({
    defaultValues: {
      username: "",
      password: "",
    },
  });

  const registerForm = useForm<RegisterFormData>({
    defaultValues: {
      username: "",
      password: "",
      bio: "",
      lookingFor: "",
      ideas: "",
    },
  });

  const createPosts = useMutation({
    mutationFn: async (posts: PostsToCreate[]) => {
      for (const post of posts) {
        const res = await fetch("/api/posts", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(post),
          credentials: "include",
        });

        if (!res.ok) {
          throw new Error(await res.text());
        }
      }
    },
  });

  const onLogin = async (data: NewUser) => {
    try {
      console.log('Attempting login with:', { username: data.username });
      const result = await login(data);
      if (!result.ok) {
        toast({
          variant: "destructive",
          title: "Login failed",
          description: result.message,
        });
      }
    } catch (error) {
      console.error('Login error:', error);
      toast({
        variant: "destructive",
        title: "Login failed",
        description: "An unexpected error occurred",
      });
    }
  };

  const onRegister = async (data: RegisterFormData) => {
    try {
      const result = await register(data);
      if (!result.ok) {
        toast({
          variant: "destructive",
          title: "Registration failed",
          description: result.message,
        });
        return;
      }

      // After successful registration, create posts from ideas if any
      if (data.ideas) {
        const posts = data.ideas
          .split(/\n\s*\n/)
          .map(content => content.trim())
          .filter(content => content.length > 0)
          .map(content => ({
            content,
            targetUserId: result.userId
          }));

        if (posts.length > 0) {
          try {
            await createPosts.mutateAsync(posts);
            toast({
              title: "Success",
              description: `Created ${posts.length} posts from your ideas`,
            });
          } catch (error: any) {
            toast({
              variant: "destructive",
              title: "Failed to create posts",
              description: error.message,
            });
          }
        }
      }
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Registration failed",
        description: "An unexpected error occurred",
      });
    }
  };

  const handleTestLogin = () => {
    loginForm.setValue("username", "testuser");
    loginForm.setValue("password", "123");
    loginForm.handleSubmit(onLogin)();
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <Card className="w-[400px]">
        <CardHeader>
          <CardTitle className="text-2xl text-center">Social Network</CardTitle>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="login">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="login">Login</TabsTrigger>
              <TabsTrigger value="register">Register</TabsTrigger>
            </TabsList>

            <TabsContent value="login">
              <form onSubmit={loginForm.handleSubmit(onLogin)} className="space-y-4">
                <Input
                  placeholder="Username"
                  {...loginForm.register("username", { required: true })}
                />
                <Input
                  type="password"
                  placeholder="Password"
                  {...loginForm.register("password", { required: true })}
                />
                <Button type="submit" className="w-full">
                  Login
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  className="w-full"
                  onClick={handleTestLogin}
                >
                  Test Login
                </Button>
              </form>
            </TabsContent>

            <TabsContent value="register">
              <form onSubmit={registerForm.handleSubmit(onRegister)} className="space-y-4">
                <Input
                  placeholder="Username"
                  {...registerForm.register("username", { required: true })}
                />
                <Input
                  type="password"
                  placeholder="Password"
                  {...registerForm.register("password", { required: true })}
                />
                <Textarea
                  placeholder="Tell us about yourself (optional)"
                  {...registerForm.register("bio")}
                />
                <Input
                  placeholder="What are you looking for? (optional)"
                  {...registerForm.register("lookingFor")}
                />
                <Textarea
                  placeholder="Add your list of ideas, separated by double line breaks (optional)"
                  {...registerForm.register("ideas")}
                  className="min-h-[100px]"
                />
                <Button type="submit" className="w-full">
                  Register
                </Button>
              </form>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}