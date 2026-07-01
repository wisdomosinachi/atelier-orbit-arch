import { createFileRoute } from "@tanstack/react-router";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { useMemo } from "react";
import { AppShell } from "@/components/app-shell";
import {
  Conversation,
  ConversationContent,
  ConversationEmptyState,
  ConversationScrollButton,
} from "@/components/ai-elements/conversation";
import { Message, MessageContent, MessageResponse } from "@/components/ai-elements/message";
import {
  PromptInput,
  PromptInputTextarea,
  PromptInputFooter,
  PromptInputSubmit,
  type PromptInputMessage,
} from "@/components/ai-elements/prompt-input";
import { Shimmer } from "@/components/ai-elements/shimmer";
import { Sparkles } from "lucide-react";

export const Route = createFileRoute("/_authenticated/design-assistant")({
  head: () => ({
    meta: [
      { title: "AI Design Assistant — Colizza AI Studio" },
      { name: "description", content: "AI collaborator for architectural design ideation." },
    ],
  }),
  component: DesignAssistant,
});

function DesignAssistant() {
  const transport = useMemo(
    () => new DefaultChatTransport({ api: "/api/chat", body: { module: "design-assistant" } }),
    [],
  );
  const { messages, sendMessage, status } = useChat({ transport });
  const busy = status === "submitted" || status === "streaming";

  const onSubmit = (msg: PromptInputMessage) => {
    if (!msg.text.trim()) return;
    void sendMessage({ text: msg.text });
  };

  return (
    <AppShell
      stats={[
        { label: "Active Projects", value: "14" },
        { label: "Pending Inquiries", value: "08" },
        { label: "Docs Processed", value: "1,242" },
      ]}
      headerRight={
        <span className="text-[10px] uppercase tracking-widest font-semibold text-muted-foreground">
          Context · Oasis Plaza
        </span>
      }
    >
      <section className="flex-1 flex overflow-hidden">
        <div className="flex-1 flex flex-col relative min-w-0">
          <Conversation className="flex-1">
            <ConversationContent className="max-w-3xl mx-auto px-12 py-12">
              {messages.length === 0 ? (
                <ConversationEmptyState
                  className="border-none"
                  icon={<Sparkles className="size-6 text-drafting" strokeWidth={1.5} />}
                  title="Design Assistant ready"
                  description="Ask about site analysis, material specs, structural systems, or design iterations. Context is scoped to Oasis Plaza."
                />
              ) : (
                messages.map((m) => (
                  <Message key={m.id} from={m.role === "user" ? "user" : "assistant"}>
                    {m.role === "assistant" ? (
                      <MessageContent variant="flat" className="prose prose-sm max-w-none">
                        {m.parts.map((part, i) =>
                          part.type === "text" ? (
                            <MessageResponse key={i}>{part.text}</MessageResponse>
                          ) : null,
                        )}
                      </MessageContent>
                    ) : (
                      <MessageContent className="bg-graphite text-paper">
                        {m.parts.map((part, i) =>
                          part.type === "text" ? <span key={i}>{part.text}</span> : null,
                        )}
                      </MessageContent>
                    )}
                  </Message>
                ))
              )}
              {status === "submitted" && (
                <div className="px-2 py-4">
                  <Shimmer>Thinking...</Shimmer>
                </div>
              )}
            </ConversationContent>
            <ConversationScrollButton />
          </Conversation>

          <div className="p-8 border-t border-hairline bg-paper">
            <div className="max-w-3xl mx-auto">
              <PromptInput onSubmit={onSubmit}>
                <PromptInputTextarea placeholder="Ask about site analysis, material specs, or design iterations..." />
                <PromptInputFooter className="justify-end">
                  <PromptInputSubmit status={status} disabled={busy} />
                </PromptInputFooter>
              </PromptInput>
              <p className="mt-4 text-[10px] text-center text-muted-foreground font-medium tracking-wide uppercase">
                Shift + Enter for new line · Context: Current Project (Oasis Plaza)
              </p>
            </div>
          </div>
        </div>

        <aside className="w-80 border-l border-hairline bg-paper/30 p-8 space-y-8 overflow-y-auto hidden xl:block">
          <div>
            <h3 className="text-[10px] uppercase tracking-[0.2em] font-bold text-muted-foreground mb-6">
              Recent Projects
            </h3>
            <div className="space-y-4">
              {[
                { name: "Pavilion X", client: "Museo d'Arte", stage: "Schematic", accent: true },
                { name: "Vertical Garden", client: "Green Urbanism", stage: "Construction" },
                { name: "The Monolith", client: "Private Estate", stage: "Design Dev" },
              ].map((p, i) => (
                <div
                  key={p.name}
                  className={
                    "group cursor-pointer " + (i > 0 ? "border-t border-hairline pt-4" : "")
                  }
                >
                  <h4 className="text-sm font-semibold">{p.name}</h4>
                  <div className="flex justify-between items-center mt-1">
                    <span className="text-[10px] text-muted-foreground">{p.client}</span>
                    <span
                      className={
                        "text-[10px] font-mono px-1.5 py-0.5 rounded-sm " +
                        (p.accent
                          ? "text-drafting bg-drafting/5"
                          : "text-muted-foreground")
                      }
                    >
                      {p.stage}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </aside>
      </section>
    </AppShell>
  );
}
