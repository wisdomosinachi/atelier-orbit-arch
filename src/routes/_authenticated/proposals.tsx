import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/app-shell";

export const Route = createFileRoute("/_authenticated/proposals")({
  head: () => ({
    meta: [
      { title: "AI Proposal Builder — Colizza AI Studio" },
      { name: "description", content: "Phase-based architectural proposals, drafted in minutes." },
    ],
  }),
  component: Proposals,
});

const proposals = [
  { client: "Museo d'Arte", project: "Pavilion X", phase: "SD + DD", fee: "€ 148,000", status: "Draft" },
  { client: "Green Urbanism", project: "Vertical Garden — Ph. 2", phase: "CD", fee: "€ 92,500", status: "Sent" },
  { client: "H. Vollmer", project: "The Monolith", phase: "SD → CA", fee: "€ 410,000", status: "Signed" },
  { client: "Studio Frei", project: "Zurich Pavilion (JV)", phase: "Competition", fee: "€ 24,000", status: "Draft" },
];

function Proposals() {
  return (
    <AppShell stats={[{ label: "In Draft", value: "04" }, { label: "Awaiting Signature", value: "02" }, { label: "Signed YTD", value: "€ 2.1M" }]}>
      <div className="flex-1 overflow-y-auto px-12 py-10">
        <header className="max-w-5xl mx-auto mb-10">
          <p className="text-[10px] font-mono uppercase tracking-[0.2em] text-muted-foreground mb-2">
            Module 03 · Fee proposals
          </p>
          <h1 className="text-3xl font-medium tracking-tight">AI Proposal Builder</h1>
          <p className="mt-3 text-sm text-muted-foreground max-w-2xl leading-relaxed">
            Draft phase-based proposals in the studio's voice — scope, deliverables, fee basis,
            exclusions. Every proposal starts from a qualified inquiry.
          </p>
        </header>

        <div className="max-w-5xl mx-auto border border-hairline rounded-lg bg-card overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-hairline text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
                <th className="text-left py-3 px-6 font-medium">Client</th>
                <th className="text-left py-3 px-6 font-medium">Project</th>
                <th className="text-left py-3 px-6 font-medium">Phases</th>
                <th className="text-right py-3 px-6 font-medium">Fee</th>
                <th className="text-right py-3 px-6 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {proposals.map((p) => (
                <tr key={p.project} className="border-b border-hairline last:border-none hover:bg-secondary/50 transition-colors cursor-pointer">
                  <td className="py-4 px-6 font-medium">{p.client}</td>
                  <td className="py-4 px-6 text-graphite/80">{p.project}</td>
                  <td className="py-4 px-6 font-mono text-xs text-muted-foreground">{p.phase}</td>
                  <td className="py-4 px-6 text-right font-mono">{p.fee}</td>
                  <td className="py-4 px-6 text-right">
                    <span className={
                      "text-[10px] font-mono px-2 py-1 rounded-sm " +
                      (p.status === "Signed" ? "text-drafting bg-drafting/5" :
                        p.status === "Sent" ? "text-graphite bg-secondary" :
                        "text-muted-foreground bg-secondary/60")
                    }>
                      {p.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </AppShell>
  );
}
