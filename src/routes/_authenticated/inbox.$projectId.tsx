import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  getStaffProject,
  sendStaffMessage,
  updateProject,
  createApproval,
  deleteMessage,
  deleteApproval,
  deleteProjectFile,
  deleteProject,
} from "@/lib/portal.functions";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { ArrowLeft, Copy, Send, Trash2 } from "lucide-react";
import { useNavigate } from "@tanstack/react-router";

const PHASES = ["inquiry", "design", "documentation", "construction", "complete"] as const;

export const Route = createFileRoute("/_authenticated/inbox/$projectId")({
  head: () => ({
    meta: [
      { title: "Conversation — Colizza AI Studio" },
      { name: "description", content: "Reply to a client and manage their project." },
    ],
  }),
  component: Conversation,
});

function Conversation() {
  const { projectId } = Route.useParams();
  const load = useServerFn(getStaffProject);
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ["staff-project", projectId],
    queryFn: () => load({ data: { project_id: projectId } }),
  });

  useEffect(() => {
    const ch = supabase
      .channel(`staff-${projectId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "messages", filter: `project_id=eq.${projectId}` },
        () => qc.invalidateQueries({ queryKey: ["staff-project", projectId] }))
      .on("postgres_changes", { event: "*", schema: "public", table: "approvals", filter: `project_id=eq.${projectId}` },
        () => qc.invalidateQueries({ queryKey: ["staff-project", projectId] }))
      .on("postgres_changes", { event: "*", schema: "public", table: "project_files", filter: `project_id=eq.${projectId}` },
        () => qc.invalidateQueries({ queryKey: ["staff-project", projectId] }))
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [projectId, qc]);

  if (isLoading) return <AppShell><div className="p-10 text-sm text-muted-foreground">Loading…</div></AppShell>;
  if (!data) return <AppShell><div className="p-10 text-sm text-muted-foreground">Project not found.</div></AppShell>;

  const { project, messages, approvals, files } = data;
  const clientLink = typeof window !== "undefined" ? `${window.location.origin}/client/${project.share_token}` : "";

  return (
    <AppShell
      stats={[
        { label: "Client", value: project.client_name },
        { label: "Phase", value: project.phase },
      ]}
      headerRight={
        <div className="flex items-center gap-4">
          <button
            onClick={() => {
              navigator.clipboard.writeText(clientLink);
              toast.success("Client link copied");
            }}
            className="flex items-center gap-2 text-xs font-medium text-muted-foreground hover:text-graphite transition-colors"
          >
            <Copy className="size-3.5" strokeWidth={1.5} />
            Copy client link
          </button>
          <DeleteProjectButton projectId={projectId} projectName={project.project_name} />
        </div>
      }
    >
      <div className="flex-1 flex min-h-0">
        <section className="flex-1 flex flex-col border-r border-hairline min-w-0">
          <div className="px-8 py-4 border-b border-hairline">
            <Link to="/inbox" className="text-xs text-muted-foreground hover:text-graphite inline-flex items-center gap-1">
              <ArrowLeft className="size-3" /> All conversations
            </Link>
            <h2 className="text-lg font-medium tracking-tight mt-1">{project.project_name}</h2>
          </div>
          <MessageList messages={messages} projectId={projectId} />
          <StaffComposer projectId={projectId} />
        </section>

        <aside className="w-96 shrink-0 overflow-y-auto p-6 space-y-8 bg-paper/50">
          <PhasePanel project={project} />
          <ApprovalCreator projectId={projectId} />
          <ApprovalList approvals={approvals} projectId={projectId} />
          <FilesList files={files} projectId={projectId} />
        </aside>
      </div>
    </AppShell>
  );
}

function DeleteProjectButton({ projectId, projectName }: { projectId: string; projectName: string }) {
  const del = useServerFn(deleteProject);
  const navigate = useNavigate();
  const qc = useQueryClient();
  const onClick = async () => {
    if (!confirm(`Delete "${projectName}" and all its messages, approvals, and files? This can't be undone.`)) return;
    try {
      await del({ data: { id: projectId } });
      qc.invalidateQueries({ queryKey: ["staff-projects"] });
      toast.success("Project deleted");
      navigate({ to: "/inbox" });
    } catch (err) { toast.error(err instanceof Error ? err.message : "Failed"); }
  };
  return (
    <button onClick={onClick} className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-destructive transition-colors">
      <Trash2 className="size-3.5" strokeWidth={1.5} />
      Delete
    </button>
  );
}

function MessageList({ messages, projectId }: { messages: { id: string; sender: "client" | "studio"; body: string; created_at: string }[]; projectId: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const del = useServerFn(deleteMessage);
  const qc = useQueryClient();
  useEffect(() => { ref.current?.scrollTo({ top: ref.current.scrollHeight }); }, [messages.length]);
  const onDelete = async (id: string) => {
    if (!confirm("Delete this message?")) return;
    try {
      await del({ data: { id } });
      qc.invalidateQueries({ queryKey: ["staff-project", projectId] });
    } catch (err) { toast.error(err instanceof Error ? err.message : "Failed"); }
  };
  return (
    <div ref={ref} className="flex-1 overflow-y-auto px-8 py-6 space-y-4">
      {messages.map((m) => (
        <div key={m.id} className={"group flex " + (m.sender === "studio" ? "justify-end" : "justify-start")}>
          <div className="max-w-md">
            <p className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground mb-1 px-1 flex items-center gap-2">
              <span>{m.sender === "studio" ? "You (Studio)" : "Client"} · {new Date(m.created_at).toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}</span>
              <button
                onClick={() => onDelete(m.id)}
                className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition-opacity"
                aria-label="Delete message"
              >
                <Trash2 className="size-3" strokeWidth={1.5} />
              </button>
            </p>
            <div className={
              "rounded-lg px-4 py-2.5 text-sm whitespace-pre-wrap " +
              (m.sender === "studio" ? "bg-graphite text-paper" : "bg-secondary ring-1 ring-hairline")
            }>
              {m.body}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function StaffComposer({ projectId }: { projectId: string }) {
  const send = useServerFn(sendStaffMessage);
  const qc = useQueryClient();
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!body.trim()) return;
    setSending(true);
    try {
      await send({ data: { project_id: projectId, body: body.trim() } });
      setBody("");
      qc.invalidateQueries({ queryKey: ["staff-project", projectId] });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to send");
    } finally { setSending(false); }
  };
  return (
    <form onSubmit={submit} className="border-t border-hairline p-4 flex gap-2 items-end">
      <Textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        rows={2}
        placeholder="Reply to client…"
        className="resize-none"
        maxLength={4000}
        onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); submit(e); } }}
      />
      <Button type="submit" disabled={sending || !body.trim()} size="icon"><Send className="size-4" /></Button>
    </form>
  );
}

function PhasePanel({ project }: { project: { id: string; phase: string; next_milestone: string | null } }) {
  const update = useServerFn(updateProject);
  const qc = useQueryClient();
  const [milestone, setMilestone] = useState(project.next_milestone ?? "");

  const saveMilestone = async () => {
    try {
      await update({ data: { project_id: project.id, next_milestone: milestone || null } });
      qc.invalidateQueries({ queryKey: ["staff-project", project.id] });
      toast.success("Saved");
    } catch (err) { toast.error(err instanceof Error ? err.message : "Failed"); }
  };
  const setPhase = async (phase: (typeof PHASES)[number]) => {
    try {
      await update({ data: { project_id: project.id, phase } });
      qc.invalidateQueries({ queryKey: ["staff-project", project.id] });
    } catch (err) { toast.error(err instanceof Error ? err.message : "Failed"); }
  };

  return (
    <section>
      <p className="text-[10px] font-mono uppercase tracking-[0.2em] text-muted-foreground mb-3">Project</p>
      <div className="flex flex-wrap gap-1 mb-4">
        {PHASES.map((p) => (
          <button
            key={p}
            onClick={() => setPhase(p)}
            className={
              "text-[10px] font-mono uppercase tracking-widest px-2 py-1 rounded-full border transition-colors " +
              (p === project.phase
                ? "bg-graphite text-paper border-graphite"
                : "border-hairline text-muted-foreground hover:border-graphite/30")
            }
          >{p}</button>
        ))}
      </div>
      <Label className="text-xs">Next milestone</Label>
      <Input
        value={milestone}
        onChange={(e) => setMilestone(e.target.value)}
        onBlur={saveMilestone}
        placeholder="e.g. Concept review, Fri 10am"
        maxLength={200}
        className="mt-1.5"
      />
    </section>
  );
}

function ApprovalCreator({ projectId }: { projectId: string }) {
  const create = useServerFn(createApproval);
  const qc = useQueryClient();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [open, setOpen] = useState(false);

  const submit = async () => {
    if (!title.trim()) return;
    try {
      await create({ data: { project_id: projectId, title: title.trim(), description: description.trim() } });
      setTitle(""); setDescription(""); setOpen(false);
      qc.invalidateQueries({ queryKey: ["staff-project", projectId] });
      toast.success("Sent for review");
    } catch (err) { toast.error(err instanceof Error ? err.message : "Failed"); }
  };

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="w-full border border-dashed border-hairline rounded-md py-2 text-xs text-muted-foreground hover:text-graphite hover:border-graphite/30 transition-colors"
      >+ Send something for approval</button>
    );
  }
  return (
    <section className="border border-hairline rounded-lg p-4 space-y-3 bg-card">
      <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Title (e.g. Concept board v2)" maxLength={160} />
      <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} placeholder="Notes for the client" maxLength={2000} />
      <div className="flex gap-2">
        <Button onClick={submit} size="sm" className="flex-1">Send</Button>
        <Button onClick={() => setOpen(false)} size="sm" variant="ghost">Cancel</Button>
      </div>
    </section>
  );
}

function ApprovalList({ approvals, projectId }: { approvals: { id: string; title: string; status: string; decided_at: string | null; decision_note: string | null }[]; projectId: string }) {
  const del = useServerFn(deleteApproval);
  const qc = useQueryClient();
  const onDelete = async (id: string) => {
    if (!confirm("Delete this approval?")) return;
    try {
      await del({ data: { id } });
      qc.invalidateQueries({ queryKey: ["staff-project", projectId] });
    } catch (err) { toast.error(err instanceof Error ? err.message : "Failed"); }
  };
  if (approvals.length === 0) return null;
  return (
    <section>
      <p className="text-[10px] font-mono uppercase tracking-[0.2em] text-muted-foreground mb-3">Approvals</p>
      <div className="space-y-2">
        {approvals.map((a) => (
          <div key={a.id} className="group border border-hairline rounded-md px-3 py-2 bg-card">
            <div className="flex items-center justify-between gap-2">
              <p className="text-xs font-medium truncate">{a.title}</p>
              <div className="flex items-center gap-2 shrink-0">
                <span className={
                  "text-[9px] font-mono uppercase tracking-widest " +
                  (a.status === "approved" ? "text-graphite"
                    : a.status === "changes_requested" ? "text-drafting"
                    : "text-muted-foreground")
                }>{a.status === "changes_requested" ? "changes" : a.status}</span>
                <button
                  onClick={() => onDelete(a.id)}
                  className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition-opacity"
                  aria-label="Delete approval"
                >
                  <Trash2 className="size-3" strokeWidth={1.5} />
                </button>
              </div>
            </div>
            {a.decision_note && <p className="text-[10px] text-muted-foreground mt-1 italic">"{a.decision_note}"</p>}
          </div>
        ))}
      </div>
    </section>
  );
}

function FilesList({ files, projectId }: { files: { id: string; filename: string; uploaded_by: string; url: string | null; created_at: string }[]; projectId: string }) {
  const del = useServerFn(deleteProjectFile);
  const qc = useQueryClient();
  const onDelete = async (id: string) => {
    if (!confirm("Delete this file?")) return;
    try {
      await del({ data: { id } });
      qc.invalidateQueries({ queryKey: ["staff-project", projectId] });
    } catch (err) { toast.error(err instanceof Error ? err.message : "Failed"); }
  };
  if (files.length === 0) return null;
  return (
    <section>
      <p className="text-[10px] font-mono uppercase tracking-[0.2em] text-muted-foreground mb-3">Files</p>
      <div className="space-y-1">
        {files.map((f) => (
          <div key={f.id} className="group flex items-center gap-2">
            <a href={f.url ?? "#"} target="_blank" rel="noreferrer"
              className="flex-1 min-w-0 block border border-hairline rounded-md px-3 py-2 bg-card hover:border-graphite/20 transition-colors">
              <p className="text-xs font-medium truncate">{f.filename}</p>
              <p className="text-[10px] text-muted-foreground">
                {f.uploaded_by === "client" ? "Client" : "You"} · {new Date(f.created_at).toLocaleDateString()}
              </p>
            </a>
            <button
              onClick={() => onDelete(f.id)}
              className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition-opacity shrink-0 p-1"
              aria-label="Delete file"
            >
              <Trash2 className="size-3.5" strokeWidth={1.5} />
            </button>
          </div>
        ))}
      </div>
    </section>
  );
}
