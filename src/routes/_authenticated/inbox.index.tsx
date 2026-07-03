import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { listProjects } from "@/lib/portal.functions";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/app-shell";

export const Route = createFileRoute("/_authenticated/inbox")({
  head: () => ({
    meta: [
      { title: "Inbox — Colizza AI Studio" },
      { name: "description", content: "Every client conversation, in one place." },
    ],
  }),
  component: Inbox,
});

function Inbox() {
  const load = useServerFn(listProjects);
  const qc = useQueryClient();
  const { data: projects, isLoading } = useQuery({
    queryKey: ["staff-projects"],
    queryFn: () => load(),
  });

  useEffect(() => {
    const ch = supabase
      .channel("staff-inbox")
      .on("postgres_changes", { event: "*", schema: "public", table: "messages" },
        () => qc.invalidateQueries({ queryKey: ["staff-projects"] }))
      .on("postgres_changes", { event: "*", schema: "public", table: "projects" },
        () => qc.invalidateQueries({ queryKey: ["staff-projects"] }))
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [qc]);

  return (
    <AppShell stats={[
      { label: "Conversations", value: String(projects?.length ?? 0).padStart(2, "0") },
      { label: "Awaiting reply", value: String(projects?.filter((p) => p.last_message?.sender === "client").length ?? 0).padStart(2, "0") },
    ]}>
      <div className="flex-1 overflow-y-auto px-12 py-10">
        <header className="max-w-4xl mx-auto mb-10">
          <p className="text-[10px] font-mono uppercase tracking-[0.2em] text-muted-foreground mb-2">
            Client Portal · Inbox
          </p>
          <h1 className="text-3xl font-medium tracking-tight">Client conversations</h1>
          <p className="mt-3 text-sm text-muted-foreground max-w-2xl leading-relaxed">
            Every inquiry that came in through the public portal at{" "}
            <Link to="/client" className="underline underline-offset-4">colizza.app/client</Link>.
          </p>
        </header>

        <div className="max-w-4xl mx-auto space-y-2">
          {isLoading && <p className="text-sm text-muted-foreground">Loading…</p>}
          {!isLoading && projects?.length === 0 && (
            <div className="border border-dashed border-hairline rounded-lg p-12 text-center">
              <p className="text-sm text-muted-foreground">
                No inquiries yet. Share your intake link:
              </p>
              <p className="mt-2 font-mono text-xs">
                {typeof window !== "undefined" ? `${window.location.origin}/client` : "/client"}
              </p>
            </div>
          )}
          {projects?.map((p) => {
            const awaiting = p.last_message?.sender === "client";
            return (
              <Link
                key={p.id}
                to="/inbox/$projectId"
                params={{ projectId: p.id }}
                className="block border border-hairline rounded-lg bg-card px-6 py-4 hover:border-graphite/20 transition-colors"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      {awaiting && <span className="size-1.5 rounded-full bg-drafting shrink-0" />}
                      <h3 className="text-sm font-semibold truncate">{p.project_name}</h3>
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {p.client_name} · {p.client_email}
                    </p>
                    {p.last_message && (
                      <p className="text-xs text-muted-foreground mt-2 truncate">
                        <span className="font-medium">{p.last_message.sender === "client" ? "Client" : "You"}:</span>{" "}
                        {p.last_message.body}
                      </p>
                    )}
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
                      {p.phase}
                    </p>
                    <p className="text-[10px] text-muted-foreground mt-1">
                      {new Date(p.updated_at).toLocaleDateString()}
                    </p>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      </div>
    </AppShell>
  );
}
