import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/app-shell";
import { FileText } from "lucide-react";

export const Route = createFileRoute("/_authenticated/documents")({
  head: () => ({
    meta: [
      { title: "AI Document Intelligence — Colizza AI Studio" },
      { name: "description", content: "Extract, summarize and cross-reference architectural documents." },
    ],
  }),
  component: Documents,
});

const docs = [
  { name: "Oasis Plaza — Geotech Report v2.pdf", type: "Geotech", pages: 84, indexed: "2h ago" },
  { name: "Pavilion X — Structural Narrative.pdf", type: "Structural", pages: 22, indexed: "Yesterday" },
  { name: "The Monolith — Owner-Architect Agmt.pdf", type: "Contract", pages: 16, indexed: "3d ago" },
  { name: "Vertical Garden — Spec Sec. 03 30 00.pdf", type: "Specification", pages: 41, indexed: "1w ago" },
];

function Documents() {
  return (
    <AppShell stats={[{ label: "Indexed", value: "1,242" }, { label: "This Week", value: "38" }, { label: "Queries", value: "612" }]}>
      <div className="flex-1 overflow-y-auto px-12 py-10">
        <header className="max-w-4xl mx-auto mb-10">
          <p className="text-[10px] font-mono uppercase tracking-[0.2em] text-muted-foreground mb-2">
            Module 05 · Knowledge
          </p>
          <h1 className="text-3xl font-medium tracking-tight">Document Intelligence</h1>
          <p className="mt-3 text-sm text-muted-foreground max-w-2xl leading-relaxed">
            Specs, drawings, contracts, geotech reports — indexed and cross-referenced. Ask
            precise questions, get cited answers.
          </p>
        </header>

        <div className="max-w-4xl mx-auto space-y-2">
          {docs.map((d) => (
            <article key={d.name} className="group flex items-center gap-4 border border-hairline rounded-lg bg-card px-5 py-4 hover:border-graphite/20 transition-colors cursor-pointer">
              <div className="size-10 rounded bg-secondary flex items-center justify-center shrink-0">
                <FileText className="size-4 text-muted-foreground" strokeWidth={1.5} />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-sm font-semibold truncate">{d.name}</h3>
                <p className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground mt-1">
                  {d.type} · {d.pages} pp · Indexed {d.indexed}
                </p>
              </div>
            </article>
          ))}
        </div>
      </div>
    </AppShell>
  );
}
