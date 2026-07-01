import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/app-shell";

export const Route = createFileRoute("/_authenticated/portal")({
  head: () => ({
    meta: [
      { title: "Client Portal — Colizza AI Studio" },
      { name: "description", content: "The client-facing view of every project." },
    ],
  }),
  component: Portal,
});

const clients = [
  { name: "Museo d'Arte", project: "Pavilion X", last: "Materials board shared · 2h" },
  { name: "Green Urbanism", project: "Vertical Garden", last: "Invoice #24-088 sent · Yesterday" },
  { name: "H. Vollmer", project: "The Monolith", last: "DD package v2 uploaded · 3d" },
  { name: "City of Aveiro", project: "Oasis Plaza", last: "Kickoff scheduled · Fri 09:00" },
];

function Portal() {
  return (
    <AppShell stats={[{ label: "Active Clients", value: "12" }, { label: "Portal Views", value: "184" }, { label: "Unread Msgs", value: "03" }]}>
      <div className="flex-1 overflow-y-auto px-12 py-10">
        <header className="max-w-4xl mx-auto mb-10">
          <p className="text-[10px] font-mono uppercase tracking-[0.2em] text-muted-foreground mb-2">
            Module 06 · The other side
          </p>
          <h1 className="text-3xl font-medium tracking-tight">Client Portal</h1>
          <p className="mt-3 text-sm text-muted-foreground max-w-2xl leading-relaxed">
            The window your clients see — project status, deliverables, invoices, messages.
            Everything they need, nothing they don't.
          </p>
        </header>

        <div className="max-w-4xl mx-auto space-y-3">
          {clients.map((c) => (
            <article key={c.name} className="flex items-center justify-between border border-hairline rounded-lg bg-card px-6 py-5 hover:border-graphite/20 transition-colors cursor-pointer">
              <div>
                <h3 className="text-sm font-semibold">{c.name}</h3>
                <p className="text-xs text-muted-foreground mt-0.5">{c.project}</p>
              </div>
              <p className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
                {c.last}
              </p>
            </article>
          ))}
        </div>
      </div>
    </AppShell>
  );
}
