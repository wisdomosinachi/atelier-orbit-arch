import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  getPortalState,
  sendClientMessage,
  decideApproval,
  createClientUpload,
  finalizeClientUpload,
} from "@/lib/portal.functions";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { MessageSquare, ClipboardCheck, FolderUp, Compass, Send, Paperclip } from "lucide-react";

export const Route = createFileRoute("/client/$token")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Your project workspace — Colizza" },
      { name: "description", content: "Private workspace to chat with the studio, review designs, and share files." },
    ],
  }),
  component: ClientPortal,
});

type Tab = "messages" | "project" | "approvals" | "files";

const PHASES = ["inquiry", "design", "documentation", "construction", "complete"] as const;

function ClientPortal() {
  const { token } = Route.useParams();
  const qc = useQueryClient();
  const load = useServerFn(getPortalState);
  const { data, isLoading, error } = useQuery({
    queryKey: ["portal", token],
    queryFn: () => load({ data: { token } }),
  });

  useEffect(() => {
    if (!data?.project.id) return;
    const projectId = data.project.id;
    const ch = supabase
      .channel(`client-${projectId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "messages", filter: `project_id=eq.${projectId}` },
        () => qc.invalidateQueries({ queryKey: ["portal", token] }))
      .on("postgres_changes", { event: "*", schema: "public", table: "approvals", filter: `project_id=eq.${projectId}` },
        () => qc.invalidateQueries({ queryKey: ["portal", token] }))
      .on("postgres_changes", { event: "*", schema: "public", table: "projects", filter: `id=eq.${projectId}` },
        () => qc.invalidateQueries({ queryKey: ["portal", token] }))
      .on("postgres_changes", { event: "*", schema: "public", table: "project_files", filter: `project_id=eq.${projectId}` },
        () => qc.invalidateQueries({ queryKey: ["portal", token] }))
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [data?.project.id, qc, token]);

  const [tab, setTab] = useState<Tab>("messages");

  if (isLoading) return <CenterMsg>Loading your workspace…</CenterMsg>;
  if (error || !data) return <CenterMsg>This link isn't valid. Ask the studio for a new one.</CenterMsg>;

  const { project, messages, approvals, files } = data;

  return (
    <div className="min-h-screen bg-paper text-graphite font-sans flex flex-col">
      <header className="border-b border-hairline px-8 py-5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="size-5 bg-graphite rounded-sm" />
          <div>
            <p className="text-[10px] font-mono uppercase tracking-[0.2em] text-muted-foreground">
              Colizza · Client workspace
            </p>
            <h1 className="text-base font-medium tracking-tight leading-tight">{project.project_name}</h1>
          </div>
        </div>
        <div className="text-right">
          <p className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">Phase</p>
          <p className="text-sm font-medium capitalize">{project.phase}</p>
        </div>
      </header>

      <nav className="border-b border-hairline px-8 flex gap-1">
        <TabBtn active={tab === "messages"} onClick={() => setTab("messages")} icon={MessageSquare}>Messages</TabBtn>
        <TabBtn active={tab === "project"} onClick={() => setTab("project")} icon={Compass}>Project</TabBtn>
        <TabBtn active={tab === "approvals"} onClick={() => setTab("approvals")} icon={ClipboardCheck}>
          Approvals{approvals.filter((a) => a.status === "pending").length > 0 && (
            <span className="ml-1.5 inline-flex items-center justify-center rounded-full bg-graphite text-paper text-[10px] size-4 font-mono">
              {approvals.filter((a) => a.status === "pending").length}
            </span>
          )}
        </TabBtn>
        <TabBtn active={tab === "files"} onClick={() => setTab("files")} icon={FolderUp}>Files</TabBtn>
      </nav>

      <main className="flex-1 min-h-0">
        {tab === "messages" && <MessagesTab token={token} messages={messages} />}
        {tab === "project" && <ProjectTab project={project} />}
        {tab === "approvals" && <ApprovalsTab token={token} approvals={approvals} />}
        {tab === "files" && <FilesTab token={token} files={files} />}
      </main>
    </div>
  );
}

function CenterMsg({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-paper flex items-center justify-center px-6">
      <p className="text-sm text-muted-foreground">{children}</p>
    </div>
  );
}

function TabBtn({
  active, onClick, icon: Icon, children,
}: { active: boolean; onClick: () => void; icon: typeof MessageSquare; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={
        "flex items-center gap-2 px-4 py-3 text-sm border-b-2 -mb-px transition-colors " +
        (active ? "border-graphite text-graphite font-medium" : "border-transparent text-muted-foreground hover:text-graphite")
      }
    >
      <Icon className="size-4" strokeWidth={1.5} />
      {children}
    </button>
  );
}

function MessagesTab({
  token, messages,
}: { token: string; messages: { id: string; sender: "client" | "studio"; body: string; created_at: string }[] }) {
  const send = useServerFn(sendClientMessage);
  const qc = useQueryClient();
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight });
  }, [messages.length]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!body.trim()) return;
    setSending(true);
    try {
      await send({ data: { token, body: body.trim() } });
      setBody("");
      qc.invalidateQueries({ queryKey: ["portal", token] });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to send");
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="h-[calc(100vh-8.5rem)] flex flex-col max-w-3xl mx-auto w-full">
      <div ref={listRef} className="flex-1 overflow-y-auto px-8 py-6 space-y-4">
        {messages.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-12">No messages yet.</p>
        )}
        {messages.map((m) => (
          <div key={m.id} className={"flex " + (m.sender === "client" ? "justify-end" : "justify-start")}>
            <div className="max-w-md">
              <p className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground mb-1 px-1">
                {m.sender === "client" ? "You" : "Studio"} · {new Date(m.created_at).toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
              </p>
              <div className={
                "rounded-lg px-4 py-2.5 text-sm whitespace-pre-wrap " +
                (m.sender === "client"
                  ? "bg-graphite text-paper"
                  : "bg-secondary ring-1 ring-hairline")
              }>
                {m.body}
              </div>
            </div>
          </div>
        ))}
      </div>
      <form onSubmit={submit} className="border-t border-hairline p-4 flex gap-2 items-end">
        <Textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="Write a message to the studio…"
          rows={2}
          maxLength={4000}
          className="resize-none"
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); submit(e); }
          }}
        />
        <Button type="submit" disabled={sending || !body.trim()} size="icon">
          <Send className="size-4" />
        </Button>
      </form>
    </div>
  );
}

function ProjectTab({ project }: { project: { phase: string; next_milestone: string | null; brief: string | null; client_name: string; created_at: string } }) {
  return (
    <div className="max-w-3xl mx-auto px-8 py-10 space-y-8">
      <section>
        <p className="text-[10px] font-mono uppercase tracking-[0.2em] text-muted-foreground mb-3">Timeline</p>
        <div className="flex items-center gap-1">
          {PHASES.map((p, i) => {
            const currentIdx = PHASES.indexOf(project.phase as (typeof PHASES)[number]);
            const state = i < currentIdx ? "done" : i === currentIdx ? "current" : "todo";
            return (
              <div key={p} className="flex-1">
                <div className={
                  "h-1 rounded-full " +
                  (state === "done" ? "bg-graphite" : state === "current" ? "bg-drafting" : "bg-hairline")
                } />
                <p className={
                  "mt-2 text-[10px] font-mono uppercase tracking-widest " +
                  (state === "current" ? "text-graphite font-medium" : "text-muted-foreground")
                }>{p}</p>
              </div>
            );
          })}
        </div>
      </section>

      <section className="border border-hairline rounded-lg p-6 bg-card">
        <p className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground mb-2">Next milestone</p>
        <p className="text-lg font-medium tracking-tight">
          {project.next_milestone || "The studio will update this shortly."}
        </p>
      </section>

      {project.brief && (
        <section>
          <p className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground mb-2">Original brief</p>
          <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-wrap">{project.brief}</p>
        </section>
      )}
    </div>
  );
}

function ApprovalsTab({
  token, approvals,
}: { token: string; approvals: { id: string; title: string; description: string | null; status: "pending" | "approved" | "changes_requested"; decided_at: string | null; decision_note: string | null }[] }) {
  const decide = useServerFn(decideApproval);
  const qc = useQueryClient();
  const [noteFor, setNoteFor] = useState<Record<string, string>>({});

  const act = async (id: string, decision: "approved" | "changes_requested") => {
    try {
      await decide({ data: { token, approval_id: id, decision, note: noteFor[id] || "" } });
      qc.invalidateQueries({ queryKey: ["portal", token] });
      toast.success(decision === "approved" ? "Approved" : "Sent back for changes");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed");
    }
  };

  return (
    <div className="max-w-3xl mx-auto px-8 py-10 space-y-4">
      {approvals.length === 0 && (
        <p className="text-sm text-muted-foreground text-center py-12">
          Nothing awaiting your review right now.
        </p>
      )}
      {approvals.map((a) => (
        <article key={a.id} className="border border-hairline rounded-lg p-6 bg-card">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h3 className="font-medium tracking-tight">{a.title}</h3>
              {a.description && (
                <p className="mt-2 text-sm text-muted-foreground whitespace-pre-wrap">{a.description}</p>
              )}
            </div>
            <span className={
              "text-[10px] font-mono uppercase tracking-widest px-2 py-1 rounded-full ring-1 shrink-0 " +
              (a.status === "approved" ? "text-graphite ring-graphite/30 bg-graphite/5"
                : a.status === "changes_requested" ? "text-drafting ring-drafting/30 bg-drafting/5"
                : "text-muted-foreground ring-hairline")
            }>
              {a.status === "changes_requested" ? "changes" : a.status}
            </span>
          </div>
          {a.status === "pending" ? (
            <div className="mt-4 space-y-3">
              <Textarea
                rows={2}
                placeholder="Optional note…"
                value={noteFor[a.id] || ""}
                onChange={(e) => setNoteFor({ ...noteFor, [a.id]: e.target.value })}
              />
              <div className="flex gap-2">
                <Button onClick={() => act(a.id, "approved")} className="flex-1">Approve</Button>
                <Button onClick={() => act(a.id, "changes_requested")} variant="outline" className="flex-1">
                  Request changes
                </Button>
              </div>
            </div>
          ) : (
            <p className="mt-3 text-xs text-muted-foreground">
              {a.decided_at && new Date(a.decided_at).toLocaleString()}
              {a.decision_note && ` · "${a.decision_note}"`}
            </p>
          )}
        </article>
      ))}
    </div>
  );
}

function FilesTab({
  token, files,
}: { token: string; files: { id: string; filename: string; uploaded_by: "client" | "studio"; created_at: string; size_bytes: number | null; url: string | null }[] }) {
  const createUp = useServerFn(createClientUpload);
  const finalize = useServerFn(finalizeClientUpload);
  const qc = useQueryClient();
  const [uploading, setUploading] = useState(false);

  const onFile = async (file: File) => {
    if (file.size > 50 * 1024 * 1024) {
      toast.error("File too large (max 50MB)");
      return;
    }
    setUploading(true);
    try {
      const up = await createUp({ data: { token, filename: file.name, size_bytes: file.size } });
      const put = await fetch(up.signedUrl, {
        method: "PUT",
        headers: { "Content-Type": file.type || "application/octet-stream" },
        body: file,
      });
      if (!put.ok) throw new Error("Upload failed");
      await finalize({ data: { token, storage_path: up.path, filename: up.original, size_bytes: up.size_bytes } });
      qc.invalidateQueries({ queryKey: ["portal", token] });
      toast.success("Uploaded");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto px-8 py-10 space-y-6">
      <label className="border-2 border-dashed border-hairline rounded-lg p-10 flex flex-col items-center justify-center text-center cursor-pointer hover:border-graphite/30 transition-colors block">
        <Paperclip className="size-6 text-muted-foreground mb-3" strokeWidth={1.5} />
        <p className="text-sm font-medium">
          {uploading ? "Uploading…" : "Drop a file or click to upload"}
        </p>
        <p className="text-xs text-muted-foreground mt-1">Max 50MB per file</p>
        <input
          type="file"
          className="hidden"
          disabled={uploading}
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) onFile(f);
            e.target.value = "";
          }}
        />
      </label>

      <div className="space-y-2">
        {files.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-6">No files shared yet.</p>
        )}
        {files.map((f) => (
          <a
            key={f.id}
            href={f.url ?? "#"}
            target="_blank"
            rel="noreferrer"
            className="flex items-center justify-between border border-hairline rounded-md px-4 py-3 bg-card hover:border-graphite/20 transition-colors"
          >
            <div>
              <p className="text-sm font-medium">{f.filename}</p>
              <p className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground mt-0.5">
                {f.uploaded_by === "client" ? "You" : "Studio"} · {new Date(f.created_at).toLocaleDateString()}
                {f.size_bytes ? ` · ${(f.size_bytes / 1024).toFixed(0)} KB` : ""}
              </p>
            </div>
            <span className="text-xs text-muted-foreground">Download</span>
          </a>
        ))}
      </div>
    </div>
  );
}
