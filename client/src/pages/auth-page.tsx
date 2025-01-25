import { useForm } from "react-hook-form";
import { useUser } from "@/hooks/use-user";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import type { NewUser } from "@db/schema";

export default function AuthPage() {
  const { login, register } = useUser();
  const { toast } = useToast();

  const loginForm = useForm<NewUser>({
    defaultValues: {
      username: "",
      password: "",
    },
  });

  const registerForm = useForm<NewUser>({
    defaultValues: {
      username: "",
      password: "",
    },
  });

  const onLogin = async (data: NewUser) => {
    try {
      const result = await login(data);
      if (!result.ok) {
        toast({
          variant: "destructive",
          title: "Login failed",
          description: result.message,
        });
      }
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Login failed",
        description: "An unexpected error occurred",
      });
    }
  };

  const onRegister = async (data: NewUser) => {
    try {
      const result = await register(data);
      if (!result.ok) {
        toast({
          variant: "destructive",
          title: "Registration failed",
          description: result.message,
        });
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
    loginForm.setValue("password", "testpass");
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