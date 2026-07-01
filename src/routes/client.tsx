import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { startClientProject } from "@/lib/portal.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";

export const Route = createFileRoute("/client")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Start a project — Colizza AI Studio" },
      {
        name: "description",
        content:
          "Send Colizza a project inquiry and get a private link to chat, share files, and track progress.",
      },
    ],
  }),
  component: ClientLanding,
});

function ClientLanding() {
  const navigate = useNavigate();
  const start = useServerFn(startClientProject);
  const [form, setForm] = useState({
    client_name: "",
    client_email: "",
    project_name: "",
    brief: "",
  });
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { token } = await start({ data: form });
      toast.success("Your workspace is ready.");
      navigate({ to: "/client/$token", params: { token } });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-paper text-graphite font-sans flex">
      <div className="hidden md:flex md:w-1/2 border-r border-hairline p-16 flex-col justify-between">
        <Link to="/client" className="flex items-center gap-2">
          <div className="size-5 bg-graphite rounded-sm" />
          <span className="font-medium tracking-tight text-lg italic">Colizza</span>
        </Link>
        <div className="max-w-md">
          <p className="text-[10px] font-mono uppercase tracking-[0.2em] text-muted-foreground mb-4">
            Client Intake · No account needed
          </p>
          <h1 className="text-4xl font-medium tracking-tight leading-tight text-balance">
            Tell us about your project. We'll open a private workspace.
          </h1>
          <p className="mt-6 text-sm text-muted-foreground leading-relaxed max-w-sm">
            After you send this, you'll get a link where you can message the studio, review
            designs, and share files — all in one place.
          </p>
        </div>
        <p className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
          Colizza Architects · Studio inquiries
        </p>
      </div>

      <div className="flex-1 flex items-center justify-center p-8">
        <form onSubmit={submit} className="w-full max-w-sm space-y-5">
          <div>
            <p className="text-[10px] font-mono uppercase tracking-[0.2em] text-muted-foreground mb-2">
              New inquiry
            </p>
            <h2 className="text-2xl font-medium tracking-tight">Start a conversation</h2>
          </div>
          <div>
            <Label htmlFor="cn" className="text-xs font-medium">Your name</Label>
            <Input id="cn" required maxLength={120} value={form.client_name}
              onChange={(e) => setForm({ ...form, client_name: e.target.value })}
              className="mt-1.5" />
          </div>
          <div>
            <Label htmlFor="ce" className="text-xs font-medium">Email</Label>
            <Input id="ce" type="email" required maxLength={255} value={form.client_email}
              onChange={(e) => setForm({ ...form, client_email: e.target.value })}
              className="mt-1.5" />
          </div>
          <div>
            <Label htmlFor="pn" className="text-xs font-medium">Project name</Label>
            <Input id="pn" required maxLength={160} value={form.project_name}
              placeholder="e.g. Coastal retreat, Milan"
              onChange={(e) => setForm({ ...form, project_name: e.target.value })}
              className="mt-1.5" />
          </div>
          <div>
            <Label htmlFor="br" className="text-xs font-medium">A little about it</Label>
            <Textarea id="br" rows={5} maxLength={4000} value={form.brief}
              placeholder="Site, program, budget range, timing — whatever's on your mind."
              onChange={(e) => setForm({ ...form, brief: e.target.value })}
              className="mt-1.5" />
          </div>
          <Button type="submit" disabled={loading} className="w-full">
            {loading ? "Opening your workspace…" : "Open my workspace"}
          </Button>
          <p className="text-[11px] text-muted-foreground text-center">
            No password needed. Keep the link we send you private.
          </p>
        </form>
      </div>
    </div>
  );
}
