import { createLovableAiGatewayProvider } from "@/lib/ai-gateway.server";
import { createFileRoute } from "@tanstack/react-router";
import { convertToModelMessages, streamText, type UIMessage } from "ai";

const SYSTEM_PROMPTS: Record<string, string> = {
  "design-assistant":
    "You are Colizza AI Studio's Design Assistant — a senior architectural collaborator embedded in a boutique architecture firm. You help the studio explore massing, materials, structural systems, site strategy, daylighting, and code compliance. Reason precisely, cite typical spans and material properties where relevant, and structure responses with short headings and concise paragraphs. Never invent client details.",
  receptionist:
    "You are Colizza AI Studio's Receptionist — the warm, professional first point of contact for prospective and existing clients of a boutique architecture firm. Qualify inquiries (project type, scope, site, budget range, timeline), answer questions about the studio's process, and hand off to the appropriate module. Keep responses short and human.",
  proposals:
    "You are Colizza AI Studio's Proposal Builder. Draft structured, phase-based architectural proposals (scope, deliverables, fee basis, exclusions, schedule). Use precise AIA-style phase names when helpful (SD, DD, CD, CA).",
  projects:
    "You are Colizza AI Studio's Project Manager. Help track project phases, deadlines, consultants, RFIs, and submittals. Suggest next actions concisely.",
  documents:
    "You are Colizza AI Studio's Document Intelligence assistant. Extract, summarize, and cross-reference information from architectural documents — specs, drawings, contracts, geotech reports. Be exact and cite the section when possible.",
  portal:
    "You are Colizza AI Studio's Client Portal assistant, speaking on behalf of the studio to clients. Warm, clear, jargon-light updates on project status and next steps.",
};

type ChatBody = { messages?: unknown; module?: unknown };

export const Route = createFileRoute("/api/chat")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { messages, module } = (await request.json()) as ChatBody;
        if (!Array.isArray(messages)) {
          return new Response("Messages are required", { status: 400 });
        }
        const key = process.env.LOVABLE_API_KEY;
        if (!key) return new Response("Missing LOVABLE_API_KEY", { status: 500 });

        const moduleKey = typeof module === "string" ? module : "design-assistant";
        const system = SYSTEM_PROMPTS[moduleKey] ?? SYSTEM_PROMPTS["design-assistant"];

        const gateway = createLovableAiGatewayProvider(key);
        const model = gateway("google/gemini-3-flash-preview");

        const result = streamText({
          model,
          system,
          messages: await convertToModelMessages(messages as UIMessage[]),
        });

        return result.toUIMessageStreamResponse({
          originalMessages: messages as UIMessage[],
        });
      },
    },
  },
});
