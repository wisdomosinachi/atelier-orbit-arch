import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/app-shell";

export const Route = createFileRoute("/_authenticated/projects")({
  head: () => ({
    meta: [
      { title: "AI Project Manager — Colizza AI Studio" },
      { name: "description", content: "Phase, deliverable, and RFI tracking for every active project." },
    ],
  }),
  component: Projects,
});

const projects = [
  { name: "Pavilion X", client: "Museo d'Arte", phase: "Schematic Design", pct: 42, next: "Massing review — Fri 09:00", accent: true },
  { name: "Vertical Garden", client: "Green Urbanism", phase: "Construction Admin", pct: 78, next: "Submittal 08.42 due" },
  { name: "The Monolith", client: "Private Estate", phase: "Design Development", pct: 55, next: "Structural coord w/ Baumann" },
  { name: "Oasis Plaza", client: "City of Aveiro", phase: "Concept", pct: 18, next: "Geotech report review" },
];

function Projects() {
  return (
    <AppShell stats={[{ label: "Active", value: "14" }, { label: "On Track", value: "11" }, { label: "At Risk", value: "03" }]}>
      <div className="flex-1 overflow-y-auto px-12 py-10">
        <header className="max-w-5xl mx-auto mb-10">
          <p className="text-[10px] font-mono uppercase tracking-[0.2em] text-muted-foreground mb-2">
            Module 04 · Delivery
          </p>
          <h1 className="text-3xl font-medium tracking-tight">AI Project Manager</h1>
          <p className="mt-3 text-sm text-muted-foreground max-w-2xl leading-relaxed">
            Every project, every phase, every deliverable — surfaced with the next best action.
          </p>
        </header>

        <div className="max-w-5xl mx-auto grid gap-4">
          {projects.map((p) => (
            <article key={p.name} className="border border-hairline rounded-lg bg-card p-6 hover:border-graphite/20 transition-colors cursor-pointer">
              <div className="flex items-start justify-between gap-8 mb-4">
                <div>
                  <h3 className="text-base font-semibold">{p.name}</h3>
                  <p className="text-xs text-muted-foreground mt-0.5">{p.client}</p>
                </div>
                <span className={"text-[10px] font-mono px-1.5 py-0.5 rounded-sm " + (p.accent ? "text-drafting bg-drafting/5" : "text-muted-foreground bg-secondary")}>
                  {p.phase}
                </span>
              </div>
              <div className="space-y-2">
                <div className="flex justify-between text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
                  <span>Progress</span>
                  <span>{p.pct}%</span>
                </div>
                <div className="h-1 bg-secondary rounded-full overflow-hidden">
                  <div className="h-full bg-graphite" style={{ width: `${p.pct}%` }} />
                </div>
                <p className="text-xs text-graphite/80 pt-2">Next · {p.next}</p>
              </div>
            </article>
          ))}
        </div>
      </div>
    </AppShell>
  );
}
