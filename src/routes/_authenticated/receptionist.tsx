import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/app-shell";
import { Inbox, ArrowUpRight } from "lucide-react";

export const Route = createFileRoute("/_authenticated/receptionist")({
  head: () => ({
    meta: [
      { title: "AI Receptionist — Colizza AI Studio" },
      { name: "description", content: "Qualified client inquiries, routed and summarized." },
    ],
  }),
  component: Receptionist,
});

const inquiries = [
  {
    from: "Léa Bertrand",
    subject: "Loft conversion — 4th arr., Paris",
    scope: "Residential · 180 m²",
    when: "2h ago",
    status: "New",
    summary:
      "Owner of a 180m² Haussmann-era loft in the 4th arrondissement. Wants to convert into a two-bedroom with a mezzanine studio. Budget €600–850k, timeline 12–18 months. Requesting consultation.",
  },
  {
    from: "Ari Solomon",
    subject: "Coastal winery — permit strategy",
    scope: "Commercial · 2,400 m²",
    when: "Yesterday",
    status: "Qualified",
    summary:
      "Family-owned winery expanding barrel-aging hall on a coastal protection zone. Needs permit strategy and preliminary massing. Existing GC in place.",
  },
  {
    from: "Studio Frei",
    subject: "Consultant collaboration — Zurich Pavilion",
    scope: "Cultural · TBD",
    when: "3 days ago",
    status: "Following up",
    summary:
      "Zurich-based practice inquiring about a joint bid for a cultural pavilion competition in District 5. Sharing brief and site info.",
  },
];

function Receptionist() {
  return (
    <AppShell
      stats={[
        { label: "New This Week", value: "12" },
        { label: "Qualified", value: "05" },
        { label: "Avg Response", value: "42m" },
      ]}
    >
      <div className="flex-1 overflow-y-auto px-12 py-10">
        <header className="max-w-4xl mx-auto mb-10">
          <p className="text-[10px] font-mono uppercase tracking-[0.2em] text-muted-foreground mb-2">
            Module 01 · Front desk
          </p>
          <h1 className="text-3xl font-medium tracking-tight">AI Receptionist</h1>
          <p className="mt-3 text-sm text-muted-foreground max-w-2xl leading-relaxed">
            Prospective clients are met, qualified, and summarized before they reach a
            principal. Every inquiry becomes a structured lead with scope, budget range, and
            recommended next step.
          </p>
        </header>

        <div className="max-w-4xl mx-auto space-y-3">
          {inquiries.map((i) => (
            <article
              key={i.subject}
              className="group border border-hairline rounded-lg bg-card p-6 hover:border-graphite/20 transition-colors cursor-pointer"
            >
              <div className="flex items-start justify-between gap-6">
                <div className="min-w-0">
                  <div className="flex items-center gap-3 mb-2">
                    <Inbox className="size-4 text-muted-foreground" strokeWidth={1.5} />
                    <span className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
                      {i.when} · {i.scope}
                    </span>
                    <span
                      className={
                        "text-[10px] font-mono px-1.5 py-0.5 rounded-sm " +
                        (i.status === "New"
                          ? "text-drafting bg-drafting/5"
                          : "text-muted-foreground bg-secondary")
                      }
                    >
                      {i.status}
                    </span>
                  </div>
                  <h3 className="text-base font-semibold mb-1">{i.subject}</h3>
                  <p className="text-xs text-muted-foreground mb-3">From {i.from}</p>
                  <p className="text-sm text-graphite/80 leading-relaxed text-pretty">
                    {i.summary}
                  </p>
                </div>
                <ArrowUpRight
                  className="size-4 text-muted-foreground shrink-0 group-hover:text-graphite transition-colors"
                  strokeWidth={1.5}
                />
              </div>
            </article>
          ))}
        </div>
      </div>
    </AppShell>
  );
}
