"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  PhoneCall,
  Users,
  Upload,
  Settings,
  LogOut,
  BarChart3,
} from "lucide-react";
import HexaLogo from "@/components/layout/hexa-logo";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import type { User } from "@/types";

const navItems = [
  { name: "Contacts", icon: Users, href: "/contacts" },
  { name: "Call Tracker", icon: PhoneCall, href: "/call-tracker" },
  { name: "Productivity", icon: BarChart3, href: "/productivity" },
  { name: "Import", icon: Upload, href: "/import" },
  { name: "Settings", icon: Settings, href: "/settings" },
];

interface AppSidebarProps {
  user: User | null;
}

export default function AppSidebar({ user }: AppSidebarProps) {
  const pathname = usePathname();
  const router = useRouter();

  const isActive = (href: string) => {
    if (href === "/contacts") return pathname === "/" || pathname.startsWith("/contacts");
    return pathname.startsWith(href);
  };

  const handleLogout = () => {
    localStorage.removeItem("access_token");
    localStorage.removeItem("refresh_token");
    localStorage.removeItem("user");
    router.push("/login");
  };

  const initials = user?.full_name
    ? user.full_name
        .split(" ")
        .map((n) => n[0])
        .join("")
        .toUpperCase()
        .slice(0, 2)
    : "?";

  return (
    <aside className="side-pane-dark flex h-full w-[248px] flex-shrink-0 flex-col border-r border-white/15">
      <div className="px-4 pb-6 pt-5">
        <HexaLogo size={24} showText textClassName="text-base text-white" />
      </div>

      <nav className="flex-1 space-y-1 px-2 overflow-y-auto">
        {navItems.map((item) => {
          const active = isActive(item.href);
          return (
            <Link
              key={item.name}
              href={item.href}
              className={cn(
                "relative flex items-center gap-2.5 px-3 py-2 text-sm transition-colors",
                active
                  ? "bg-white/15 text-white"
                  : "text-white/75 hover:bg-white/10 hover:text-white"
              )}
            >
              {active && (
                <div className="absolute left-0 top-1/2 h-[18px] w-[2px] -translate-y-1/2 rounded-r bg-primary" />
              )}
              <item.icon size={15} strokeWidth={active ? 2 : 1.7} />
              <span>{item.name}</span>
            </Link>
          );
        })}
      </nav>

      <div className="mx-3 mb-2 px-3 py-2">
        <button
          onClick={handleLogout}
          className="flex w-full items-center gap-2.5 text-sm text-white/75 hover:text-white transition-colors"
        >
          <LogOut size={15} strokeWidth={1.7} />
          <span>Sign out</span>
        </button>
      </div>

      <div className="mx-3 mb-3 flex items-center gap-3 border border-white/15 bg-white/5 p-3">
        <Avatar className="h-9 w-9">
          <AvatarFallback className="bg-primary text-xs font-semibold text-primary-foreground">
            {initials}
          </AvatarFallback>
        </Avatar>
        <div className="flex-1 min-w-0">
          <p className="truncate text-sm font-medium text-white">
            {user?.full_name || "User"}
          </p>
          <p className="mt-0.5 truncate text-xs text-white/75">
            {user?.email || ""}
          </p>
        </div>
        <div className="h-2 w-2 flex-shrink-0 rounded-full bg-emerald-400" />
      </div>
    </aside>
  );
}
