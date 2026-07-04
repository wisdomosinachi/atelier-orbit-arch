import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Database } from "@/integrations/supabase/types";
import { z } from "zod";

const BUCKET = "project-files";

// Server-side publishable-key client — respects RLS as `anon`.
// Used for guest/client portal calls that go through SECURITY DEFINER RPCs.
function serverAnonClient() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) {
    throw new Error(
      "Missing Supabase environment variable(s): SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY.",
    );
  }
  return createClient<Database>(url, key, {
    auth: { storage: undefined, persistSession: false, autoRefreshToken: false },
  });
}

// ————— Client / guest server functions (no auth; token-gated via RPCs) —————

const StartInput = z.object({
  message: z.string().trim().min(1).max(4000),
  client_name: z.string().trim().max(120).optional().default(""),
  client_email: z.string().trim().max(255).optional().default(""),
});

export const startClientProject = createServerFn({ method: "POST" })
  .inputValidator((raw: unknown) => StartInput.parse(raw))
  .handler(async ({ data }) => {
    const sb = serverAnonClient();
    const { data: token, error } = await sb.rpc("portal_start", {
      p_message: data.message,
      p_name: data.client_name,
      p_email: data.client_email,
    });
    if (error || !token) throw new Error(error?.message || "Failed to create project");
    return { token: token as string };
  });

const TokenInput = z.object({ token: z.string().uuid() });

export const getPortalState = createServerFn({ method: "POST" })
  .inputValidator((raw: unknown) => TokenInput.parse(raw))
  .handler(async ({ data }) => {
    const sb = serverAnonClient();
    const { data: state, error } = await sb.rpc("portal_get_state", { p_token: data.token });
    if (error || !state) throw new Error(error?.message || "Project not found");

    const bundle = state as {
      project: Database["public"]["Tables"]["projects"]["Row"];
      messages: Database["public"]["Tables"]["messages"]["Row"][];
      approvals: Database["public"]["Tables"]["approvals"]["Row"][];
      files: Database["public"]["Tables"]["project_files"]["Row"][];
    };

    const filesWithUrls = await Promise.all(
      (bundle.files ?? []).map(async (f) => {
        const { data: signed } = await sb.storage
          .from(BUCKET)
          .createSignedUrl(f.storage_path, 60 * 60);
        return { ...f, url: signed?.signedUrl ?? null };
      }),
    );

    return {
      project: bundle.project,
      messages: bundle.messages ?? [],
      approvals: bundle.approvals ?? [],
      files: filesWithUrls,
    };
  });

const SendClientMsg = z.object({
  token: z.string().uuid(),
  body: z.string().trim().min(1).max(4000),
});

export const sendClientMessage = createServerFn({ method: "POST" })
  .inputValidator((raw: unknown) => SendClientMsg.parse(raw))
  .handler(async ({ data }) => {
    const sb = serverAnonClient();
    const { error } = await sb.rpc("portal_send_message", {
      p_token: data.token,
      p_body: data.body,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

const DecideApproval = z.object({
  token: z.string().uuid(),
  approval_id: z.string().uuid(),
  decision: z.enum(["approved", "changes_requested"]),
  note: z.string().trim().max(1000).optional().default(""),
});

export const decideApproval = createServerFn({ method: "POST" })
  .inputValidator((raw: unknown) => DecideApproval.parse(raw))
  .handler(async ({ data }) => {
    const sb = serverAnonClient();
    const { error } = await sb.rpc("portal_decide_approval", {
      p_token: data.token,
      p_approval_id: data.approval_id,
      p_decision: data.decision,
      p_note: data.note,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

const CreateUpload = z.object({
  token: z.string().uuid(),
  filename: z.string().trim().min(1).max(200),
  size_bytes: z.number().int().nonnegative().max(50 * 1024 * 1024),
});

export const createClientUpload = createServerFn({ method: "POST" })
  .inputValidator((raw: unknown) => CreateUpload.parse(raw))
  .handler(async ({ data }) => {
    const sb = serverAnonClient();
    const { data: projectId, error: pidErr } = await sb.rpc("portal_project_id", {
      p_token: data.token,
    });
    if (pidErr || !projectId) throw new Error(pidErr?.message || "Project not found");

    const safeName = data.filename.replace(/[^a-zA-Z0-9._-]/g, "_");
    const path = `${projectId}/client/${Date.now()}-${safeName}`;
    const { data: signed, error } = await sb.storage
      .from(BUCKET)
      .createSignedUploadUrl(path);
    if (error || !signed) throw new Error(error?.message || "Failed to create upload URL");
    return {
      path,
      token: signed.token,
      signedUrl: signed.signedUrl,
      project_id: projectId as string,
      original: data.filename,
      size_bytes: data.size_bytes,
    };
  });

const FinalizeUpload = z.object({
  token: z.string().uuid(),
  storage_path: z.string(),
  filename: z.string(),
  size_bytes: z.number().int().nonnegative(),
});

export const finalizeClientUpload = createServerFn({ method: "POST" })
  .inputValidator((raw: unknown) => FinalizeUpload.parse(raw))
  .handler(async ({ data }) => {
    const sb = serverAnonClient();
    const { error } = await sb.rpc("portal_finalize_upload", {
      p_token: data.token,
      p_storage_path: data.storage_path,
      p_filename: data.filename,
      p_size_bytes: data.size_bytes,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ————— Staff-only server functions (use authenticated user's client + RLS) —————

export const listProjects = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const sb = context.supabase;
    const { data: projects, error } = await sb
      .from("projects")
      .select("*")
      .order("updated_at", { ascending: false });
    if (error) throw new Error(error.message);

    const withLast = await Promise.all(
      (projects ?? []).map(async (p) => {
        const { data: last } = await sb
          .from("messages")
          .select("body, sender, created_at")
          .eq("project_id", p.id)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        return { ...p, last_message: last };
      }),
    );
    return withLast;
  });

const ProjectIdInput = z.object({ project_id: z.string().uuid() });

export const getStaffProject = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw: unknown) => ProjectIdInput.parse(raw))
  .handler(async ({ data, context }) => {
    const sb = context.supabase;
    const { data: project, error } = await sb
      .from("projects")
      .select("*")
      .eq("id", data.project_id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!project) throw new Error("Project not found");

    const [messages, approvals, files] = await Promise.all([
      sb.from("messages").select("*").eq("project_id", project.id).order("created_at"),
      sb.from("approvals").select("*").eq("project_id", project.id).order("created_at"),
      sb.from("project_files").select("*").eq("project_id", project.id).order("created_at"),
    ]);
    const filesWithUrls = await Promise.all(
      (files.data ?? []).map(async (f) => {
        const { data: signed } = await sb.storage
          .from(BUCKET)
          .createSignedUrl(f.storage_path, 60 * 60);
        return { ...f, url: signed?.signedUrl ?? null };
      }),
    );
    return {
      project,
      messages: messages.data ?? [],
      approvals: approvals.data ?? [],
      files: filesWithUrls,
    };
  });

const SendStaffMsg = z.object({
  project_id: z.string().uuid(),
  body: z.string().trim().min(1).max(4000),
});

export const sendStaffMessage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw: unknown) => SendStaffMsg.parse(raw))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("messages").insert({
      project_id: data.project_id,
      sender: "studio",
      body: data.body,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

const UpdateProject = z.object({
  project_id: z.string().uuid(),
  phase: z.enum(["inquiry", "design", "documentation", "construction", "complete"]).optional(),
  next_milestone: z.string().trim().max(200).nullable().optional(),
});

export const updateProject = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw: unknown) => UpdateProject.parse(raw))
  .handler(async ({ data, context }) => {
    const patch: { phase?: typeof data.phase; next_milestone?: string | null } = {};
    if (data.phase) patch.phase = data.phase;
    if (data.next_milestone !== undefined) patch.next_milestone = data.next_milestone;
    if (Object.keys(patch).length === 0) return { ok: true };
    const { error } = await context.supabase
      .from("projects")
      .update(patch)
      .eq("id", data.project_id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

const CreateApproval = z.object({
  project_id: z.string().uuid(),
  title: z.string().trim().min(1).max(160),
  description: z.string().trim().max(2000).optional().default(""),
});

export const createApproval = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw: unknown) => CreateApproval.parse(raw))
  .handler(async ({ data, context }) => {
    const sb = context.supabase;
    const { error } = await sb.from("approvals").insert({
      project_id: data.project_id,
      title: data.title,
      description: data.description || null,
    });
    if (error) throw new Error(error.message);
    await sb.from("messages").insert({
      project_id: data.project_id,
      sender: "studio",
      body: `📝 New for your review: ${data.title}`,
    });
    return { ok: true };
  });

const IdInput = z.object({ id: z.string().uuid() });

export const deleteMessage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw: unknown) => IdInput.parse(raw))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("messages").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteApproval = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw: unknown) => IdInput.parse(raw))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("approvals").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteProjectFile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw: unknown) => IdInput.parse(raw))
  .handler(async ({ data, context }) => {
    const sb = context.supabase;
    const { data: file, error: fetchErr } = await sb
      .from("project_files")
      .select("storage_path")
      .eq("id", data.id)
      .maybeSingle();
    if (fetchErr) throw new Error(fetchErr.message);
    if (file?.storage_path) {
      await sb.storage.from(BUCKET).remove([file.storage_path]);
    }
    const { error } = await sb.from("project_files").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteProject = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw: unknown) => IdInput.parse(raw))
  .handler(async ({ data, context }) => {
    const sb = context.supabase;
    const { data: files } = await sb
      .from("project_files")
      .select("storage_path")
      .eq("project_id", data.id);
    const paths = (files ?? []).map((f) => f.storage_path).filter(Boolean);
    if (paths.length > 0) {
      await sb.storage.from(BUCKET).remove(paths);
    }
    const { error } = await sb.from("projects").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
