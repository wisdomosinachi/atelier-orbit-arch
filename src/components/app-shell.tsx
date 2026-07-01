import { Link, useRouterState, useNavigate } from "@tanstack/react-router";
import type { ReactNode } from "react";
import {
  Inbox,
  Sparkles,
  FileText,
  CalendarClock,
  Building2,
  Users,
  LogOut,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

const modules = [
  { to: "/inbox", label: "Client Inbox", icon: Users },
  { to: "/receptionist", label: "Receptionist", icon: Inbox },
  { to: "/design-assistant", label: "Design Assistant", icon: Sparkles },
  { to: "/proposals", label: "Proposal Builder", icon: FileText },
  { to: "/projects", label: "Project Manager", icon: CalendarClock },
  { to: "/documents", label: "Doc Intelligence", icon: Building2 },
] as const;

export function AppShell({
  stats,
  headerRight,
  children,
}: {
  stats?: { label: string; value: string }[];
  headerRight?: ReactNode;
  children: ReactNode;
}) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const navigate = useNavigate();

  const signOut = async () => {
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  };

  return (
    <div className="flex h-screen w-full bg-paper font-sans text-graphite selection:bg-drafting/10">
      <aside className="w-64 shrink-0 border-r border-hairline flex flex-col">
        <div className="p-6">
          <Link to="/design-assistant" className="flex items-center gap-2 mb-8">
            <div className="size-5 bg-graphite rounded-sm" />
            <span className="font-medium tracking-tight text-lg italic">Colizza</span>
          </Link>
          <nav className="space-y-1">
            {modules.map((m) => {
              const active = pathname.startsWith(m.to);
              const Icon = m.icon;
              return (
                <Link
                  key={m.to}
                  to={m.to}
                  className={
                    "w-full flex items-center gap-3 px-3 py-2 text-sm font-medium rounded-md transition-colors " +
                    (active
                      ? "bg-secondary text-graphite ring-1 ring-hairline"
                      : "text-muted-foreground hover:text-graphite")
                  }
                >
                  <Icon className="size-4 shrink-0" strokeWidth={1.5} />
                  {m.label}
                </Link>
              );
            })}
          </nav>
        </div>

        <div className="mt-auto p-6 border-t border-hairline">
          <button
            onClick={signOut}
            className="w-full flex items-center gap-3 text-xs font-medium text-muted-foreground hover:text-graphite transition-colors"
          >
            <LogOut className="size-4" strokeWidth={1.5} />
            Sign out
          </button>
        </div>
      </aside>

      <main className="flex-1 flex flex-col min-w-0 bg-paper/50">
        <header className="h-14 border-b border-hairline flex items-center justify-between px-8 bg-paper/80 backdrop-blur-sm z-10">
          <div className="flex gap-8 items-center">
            {(stats ?? []).map((s, i) => (
              <div
                key={s.label}
                className={
                  "flex flex-col " + (i > 0 ? "border-l border-hairline pl-8" : "")
                }
              >
                <span className="text-[10px] uppercase tracking-widest text-muted-foreground font-medium">
                  {s.label}
                </span>
                <span className="font-mono text-sm font-medium leading-none mt-1">
                  {s.value}
                </span>
              </div>
            ))}
          </div>
          <div className="flex items-center gap-4">{headerRight}</div>
        </header>
        {children}
      </main>
    </div>
  );
}
