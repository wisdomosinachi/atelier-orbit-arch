import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Sign in — Colizza AI Studio" },
      { name: "description", content: "Sign in to Colizza AI Studio." },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: "/design-assistant", replace: true });
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      if (session) navigate({ to: "/design-assistant", replace: true });
    });
    return () => sub.subscription.unsubscribe();
  }, [navigate]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: window.location.origin },
        });
        if (error) throw error;
        toast.success("Check your inbox to confirm your account.");
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  const google = async () => {
    const result = await lovable.auth.signInWithOAuth("google", {
      redirect_uri: window.location.origin,
    });
    if (result.error) toast.error(result.error.message);
  };

  return (
    <div className="min-h-screen bg-paper text-graphite font-sans flex">
      <div className="hidden md:flex md:w-1/2 border-r border-hairline p-16 flex-col justify-between">
        <div className="flex items-center gap-2">
          <div className="size-5 bg-graphite rounded-sm" />
          <span className="font-medium tracking-tight text-lg italic">Colizza</span>
        </div>
        <div className="max-w-md">
          <p className="text-[10px] font-mono uppercase tracking-[0.2em] text-muted-foreground mb-4">
            Studio OS · vol. 01
          </p>
          <h1 className="text-4xl font-medium tracking-tight text-balance leading-tight">
            The operating system for the modern architecture practice.
          </h1>
          <p className="mt-6 text-sm text-muted-foreground leading-relaxed max-w-sm">
            From first inquiry to project completion — clients, designs, documents,
            and projects, unified in one calm interface.
          </p>
        </div>
        <p className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
          Internal Access · Authorized Personnel
        </p>
      </div>

      <div className="flex-1 flex items-center justify-center p-8">
        <div className="w-full max-w-sm">
          <p className="text-[10px] font-mono uppercase tracking-[0.2em] text-muted-foreground mb-2">
            {mode === "signin" ? "Access studio" : "New team member"}
          </p>
          <h2 className="text-2xl font-medium tracking-tight mb-8">
            {mode === "signin" ? "Sign in" : "Create account"}
          </h2>

          <button
            onClick={google}
            className="w-full flex items-center justify-center gap-3 border border-hairline rounded-md py-2.5 text-sm font-medium hover:bg-secondary transition-colors"
          >
            <GoogleMark />
            Continue with Google
          </button>

          <div className="flex items-center gap-3 my-6">
            <div className="flex-1 h-px bg-hairline" />
            <span className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
              or
            </span>
            <div className="flex-1 h-px bg-hairline" />
          </div>

          <form onSubmit={submit} className="space-y-4">
            <div>
              <Label htmlFor="email" className="text-xs font-medium">
                Email
              </Label>
              <Input
                id="email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="mt-1.5"
              />
            </div>
            <div>
              <Label htmlFor="password" className="text-xs font-medium">
                Password
              </Label>
              <Input
                id="password"
                type="password"
                required
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="mt-1.5"
              />
            </div>
            <Button type="submit" disabled={loading} className="w-full">
              {loading ? "…" : mode === "signin" ? "Sign in" : "Create account"}
            </Button>
          </form>

          <p className="mt-6 text-xs text-center text-muted-foreground">
            {mode === "signin" ? "New here?" : "Already have an account?"}{" "}
            <button
              type="button"
              onClick={() => setMode(mode === "signin" ? "signup" : "signin")}
              className="underline underline-offset-4 text-graphite hover:text-drafting transition-colors"
            >
              {mode === "signin" ? "Create an account" : "Sign in"}
            </button>
          </p>
        </div>
      </div>
    </div>
  );
}

function GoogleMark() {
  return (
    <svg className="size-4" viewBox="0 0 48 48" aria-hidden>
      <path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9 3.6l6.7-6.7C35.6 2.6 30.2.5 24 .5 14.8.5 6.9 5.8 3 13.4l7.8 6C12.6 13.4 17.9 9.5 24 9.5z" />
      <path fill="#4285F4" d="M46.5 24.6c0-1.5-.2-3-.4-4.4H24v8.4h12.7c-.5 3-2.2 5.5-4.6 7.2l7.4 5.7c4.3-4 6.9-9.9 6.9-16.9z" />
      <path fill="#FBBC05" d="M10.8 28.6c-.5-1.4-.8-2.9-.8-4.6s.3-3.2.8-4.6l-7.8-6C1 16.8 0 20.3 0 24s1 7.2 3 10.6l7.8-6z" />
      <path fill="#34A853" d="M24 47.5c6.2 0 11.5-2 15.3-5.5l-7.4-5.7c-2 1.4-4.6 2.2-7.9 2.2-6.1 0-11.3-3.9-13.2-9.9l-7.8 6C6.9 42.2 14.8 47.5 24 47.5z" />
    </svg>
  );
}
