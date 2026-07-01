import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

const BUCKET = "project-files";

async function getAdmin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

async function loadProjectByToken(token: string) {
  const admin = await getAdmin();
  const { data, error } = await admin
    .from("projects")
    .select("*")
    .eq("share_token", token)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Project not found");
  return data;
}

const StartInput = z.object({
  message: z.string().trim().min(1).max(4000),
  client_name: z.string().trim().max(120).optional().default(""),
  client_email: z.string().trim().max(255).optional().default(""),
});

export const startClientProject = createServerFn({ method: "POST" })
  .inputValidator((raw: unknown) => StartInput.parse(raw))
  .handler(async ({ data }) => {
    const admin = await getAdmin();
    // Derive a project name from the first line of the message (max ~60 chars)
    const firstLine = data.message.split("\n")[0].trim();
    const projectName =
      firstLine.length > 60 ? `${firstLine.slice(0, 57)}…` : firstLine || "New inquiry";

    const { data: project, error } = await admin
      .from("projects")
      .insert({
        client_name: data.client_name || "Guest",
        client_email: data.client_email || "",
        project_name: projectName,
        brief: data.message,
      })
      .select("id, share_token")
      .single();
    if (error || !project) throw new Error(error?.message || "Failed to create project");

    await admin.from("messages").insert({
      project_id: project.id,
      sender: "client",
      body: data.message,
    });

    return { token: project.share_token as string };
  });

const TokenInput = z.object({ token: z.string().uuid() });

export const getPortalState = createServerFn({ method: "POST" })
  .inputValidator((raw: unknown) => TokenInput.parse(raw))
  .handler(async ({ data }) => {
    const project = await loadProjectByToken(data.token);
    const admin = await getAdmin();
    const [messages, approvals, files] = await Promise.all([
      admin.from("messages").select("*").eq("project_id", project.id).order("created_at"),
      admin.from("approvals").select("*").eq("project_id", project.id).order("created_at"),
      admin.from("project_files").select("*").eq("project_id", project.id).order("created_at"),
    ]);

    const filesWithUrls = await Promise.all(
      (files.data ?? []).map(async (f) => {
        const { data: signed } = await admin.storage
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

const SendClientMsg = z.object({
  token: z.string().uuid(),
  body: z.string().trim().min(1).max(4000),
});

export const sendClientMessage = createServerFn({ method: "POST" })
  .inputValidator((raw: unknown) => SendClientMsg.parse(raw))
  .handler(async ({ data }) => {
    const project = await loadProjectByToken(data.token);
    const admin = await getAdmin();
    const { error } = await admin.from("messages").insert({
      project_id: project.id,
      sender: "client",
      body: data.body,
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
    const project = await loadProjectByToken(data.token);
    const admin = await getAdmin();
    const { error } = await admin
      .from("approvals")
      .update({
        status: data.decision,
        decision_note: data.note || null,
        decided_at: new Date().toISOString(),
      })
      .eq("id", data.approval_id)
      .eq("project_id", project.id);
    if (error) throw new Error(error.message);

    await admin.from("messages").insert({
      project_id: project.id,
      sender: "client",
      body:
        data.decision === "approved"
          ? `✓ Approved${data.note ? `: ${data.note}` : ""}`
          : `↻ Changes requested${data.note ? `: ${data.note}` : ""}`,
    });
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
    const project = await loadProjectByToken(data.token);
    const admin = await getAdmin();
    const safeName = data.filename.replace(/[^a-zA-Z0-9._-]/g, "_");
    const path = `${project.id}/client/${Date.now()}-${safeName}`;
    const { data: signed, error } = await admin.storage
      .from(BUCKET)
      .createSignedUploadUrl(path);
    if (error || !signed) throw new Error(error?.message || "Failed to create upload URL");
    return {
      path,
      token: signed.token,
      signedUrl: signed.signedUrl,
      project_id: project.id,
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
    const project = await loadProjectByToken(data.token);
    const admin = await getAdmin();
    const { error } = await admin.from("project_files").insert({
      project_id: project.id,
      uploaded_by: "client",
      filename: data.filename,
      storage_path: data.storage_path,
      size_bytes: data.size_bytes,
    });
    if (error) throw new Error(error.message);
    await admin.from("messages").insert({
      project_id: project.id,
      sender: "client",
      body: `📎 Uploaded ${data.filename}`,
    });
    return { ok: true };
  });

// ————— Staff-only server functions —————

export const listProjects = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async () => {
    const admin = await getAdmin();
    const { data: projects, error } = await admin
      .from("projects")
      .select("*")
      .order("updated_at", { ascending: false });
    if (error) throw new Error(error.message);

    const withLast = await Promise.all(
      (projects ?? []).map(async (p) => {
        const { data: last } = await admin
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
  .handler(async ({ data }) => {
    const admin = await getAdmin();
    const { data: project, error } = await admin
      .from("projects")
      .select("*")
      .eq("id", data.project_id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!project) throw new Error("Project not found");

    const [messages, approvals, files] = await Promise.all([
      admin.from("messages").select("*").eq("project_id", project.id).order("created_at"),
      admin.from("approvals").select("*").eq("project_id", project.id).order("created_at"),
      admin.from("project_files").select("*").eq("project_id", project.id).order("created_at"),
    ]);
    const filesWithUrls = await Promise.all(
      (files.data ?? []).map(async (f) => {
        const { data: signed } = await admin.storage
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
  .handler(async ({ data }) => {
    const admin = await getAdmin();
    const { error } = await admin.from("messages").insert({
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
  .handler(async ({ data }) => {
    const admin = await getAdmin();
    const patch: { phase?: typeof data.phase; next_milestone?: string | null } = {};
    if (data.phase) patch.phase = data.phase;
    if (data.next_milestone !== undefined) patch.next_milestone = data.next_milestone;
    if (Object.keys(patch).length === 0) return { ok: true };
    const { error } = await admin.from("projects").update(patch).eq("id", data.project_id);
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
  .handler(async ({ data }) => {
    const admin = await getAdmin();
    const { error } = await admin.from("approvals").insert({
      project_id: data.project_id,
      title: data.title,
      description: data.description || null,
    });
    if (error) throw new Error(error.message);
    await admin.from("messages").insert({
      project_id: data.project_id,
      sender: "studio",
      body: `📝 New for your review: ${data.title}`,
    });
    return { ok: true };
  });
