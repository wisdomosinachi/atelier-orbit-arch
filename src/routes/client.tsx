import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { startClientProject } from "@/lib/portal.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { ArrowUp } from "lucide-react";

const STORAGE_KEY = "colizza.client.token";

export const Route = createFileRoute("/client")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Chat with Colizza — start a project" },
      {
        name: "description",
        content:
          "Message Colizza Architects directly. No sign-up — just tell us what you're thinking about and we'll open a private workspace for you.",
      },
    ],
  }),
  component: ClientLanding,
});

function ClientLanding() {
  const navigate = useNavigate();
  const start = useServerFn(startClientProject);
  const [message, setMessage] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);

  // If a client has already started a project on this device, take them
  // straight back to their workspace.
  useEffect(() => {
    const existing = typeof window !== "undefined" ? localStorage.getItem(STORAGE_KEY) : null;
    if (existing) {
      navigate({ to: "/client/$token", params: { token: existing }, replace: true });
    }
  }, [navigate]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim() || loading) return;
    setLoading(true);
    try {
      const { token } = await start({
        data: { message: message.trim(), client_name: name.trim(), client_email: email.trim() },
      });
      try {
        localStorage.setItem(STORAGE_KEY, token);
      } catch {
        /* storage may be unavailable — non-fatal */
      }
      await navigate({ to: "/client/$token", params: { token }, replace: true });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong");
      setLoading(false);
    }
  };

  const onKey = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      submit(e as unknown as React.FormEvent);
    }
  };


  return (
    <div className="min-h-screen bg-paper text-graphite font-sans flex flex-col">
      <header className="flex items-center justify-between px-6 md:px-10 py-5 border-b border-hairline">
        <Link to="/client" className="flex items-center gap-2">
          <div className="size-5 bg-graphite rounded-sm" />
          <span className="font-medium tracking-tight text-lg italic">Colizza</span>
        </Link>
        <p className="text-[10px] font-mono uppercase tracking-[0.2em] text-muted-foreground">
          Studio · Direct line
        </p>
      </header>

      <main className="flex-1 flex items-center justify-center px-6 py-16">
        <form onSubmit={submit} className="w-full max-w-2xl space-y-8">
          <div className="space-y-3">
            <p className="text-[10px] font-mono uppercase tracking-[0.2em] text-muted-foreground">
              No account · No forms
            </p>
            <h1 className="text-4xl md:text-5xl font-medium tracking-tight leading-[1.05] text-balance">
              What are you thinking about building?
            </h1>
            <p className="text-sm text-muted-foreground max-w-lg leading-relaxed">
              Start the conversation. A private workspace opens the moment you hit send —
              chat with the studio, review designs, share files.
            </p>
          </div>

          <div className="relative border border-hairline bg-white rounded-md shadow-sm focus-within:border-graphite transition-colors">
            <Textarea
              autoFocus
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              onKeyDown={onKey}
              rows={5}
              maxLength={4000}
              required
              placeholder="e.g. A small coastal villa in Puglia, four bedrooms, sensitive to the landscape…"
              className="border-0 resize-none focus-visible:ring-0 focus-visible:ring-offset-0 text-base leading-relaxed pr-14 min-h-[140px]"
            />
            <Button
              type="submit"
              size="icon"
              disabled={loading || !message.trim()}
              className="absolute bottom-3 right-3 size-9 rounded-full"
              aria-label="Send message"
            >
              <ArrowUp className="size-4" />
            </Button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={120}
              placeholder="Your name (optional)"
              className="bg-transparent"
            />
            <Input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              maxLength={255}
              placeholder="Email so we can reach you (optional)"
              className="bg-transparent"
            />
          </div>

          <p className="text-[11px] font-mono uppercase tracking-widest text-muted-foreground">
            {loading ? "Opening your workspace…" : "Press ⌘/Ctrl + Enter to send"}
          </p>
        </form>
      </main>
    </div>
  );
}
