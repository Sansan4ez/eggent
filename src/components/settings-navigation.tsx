"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Cable,
  CalendarClock,
  FolderOpen,
  GitBranch,
  Send,
  Settings,
} from "lucide-react";

const SETTINGS_SECTIONS = [
  { href: "/dashboard/settings", label: "General", icon: Settings },
  { href: "/dashboard/projects", label: "Projects", icon: FolderOpen },
  { href: "/dashboard/pipelines", label: "Pipelines", icon: GitBranch },
  { href: "/dashboard/schedules", label: "Schedules", icon: CalendarClock },
  { href: "/dashboard/messengers", label: "Messengers", icon: Send },
  { href: "/dashboard/api", label: "API", icon: Cable },
] as const;

export function SettingsNavigation() {
  const pathname = usePathname();

  return (
    <nav aria-label="Settings sections" className="rounded-xl border bg-card p-1.5 shadow-sm">
      <div className="flex items-center gap-1 overflow-x-auto">
        {SETTINGS_SECTIONS.map(({ href, label, icon: Icon }) => {
          const active =
            pathname === href ||
            pathname.startsWith(`${href}/`) ||
            (href === "/dashboard/pipelines" && pathname.startsWith("/dashboard/pipeline-runs/"));
          return (
            <Link
              key={href}
              href={href}
              aria-current={active ? "page" : undefined}
              className={`inline-flex shrink-0 items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                active
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              }`}
            >
              <Icon className="size-4" />
              <span>{label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
