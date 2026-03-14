"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Search,
  Bookmark,
  Star,
  Settings,
  CreditCard,
  Shield,
  BarChart3,
  MessageSquare,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { Profile } from "@/types/user";

interface SidebarProps {
  profile: Profile | null;
}

const LP_NAV = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/search", label: "Search Sponsors", icon: Search },
  { href: "/watchlist", label: "Watchlist", icon: Bookmark },
  { href: "/settings", label: "Settings", icon: Settings },
  { href: "/billing", label: "Billing", icon: CreditCard },
];

const GP_NAV = [
  { href: "/claim", label: "Claim Profile", icon: Shield },
  { href: "/profile", label: "My Profile", icon: Star },
  { href: "/analytics", label: "Analytics", icon: BarChart3 },
  { href: "/respond", label: "Reviews", icon: MessageSquare },
];

const ADMIN_NAV = [
  { href: "/admin/settings", label: "Platform Settings", icon: Settings },
];

export function Sidebar({ profile }: SidebarProps) {
  const pathname = usePathname();

  const isGP = profile?.role === "gp" || profile?.role === "admin";
  const isAdmin = profile?.role === "admin";

  return (
    <aside className="w-64 border-r bg-white flex flex-col h-full">
      {/* Logo */}
      <div className="h-16 flex items-center px-6 border-b">
        <Link href="/dashboard" className="font-bold text-xl text-blue-600">
          SyndiCheck
        </Link>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-1">
        {LP_NAV.map(({ href, label, icon: Icon }) => (
          <NavLink key={href} href={href} label={label} icon={Icon} active={pathname === href || pathname.startsWith(href + "/")} />
        ))}

        {isGP && (
          <>
            <div className="pt-4 pb-1 px-3">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
                GP Tools
              </p>
            </div>
            {GP_NAV.map(({ href, label, icon: Icon }) => (
              <NavLink key={href} href={href} label={label} icon={Icon} active={pathname === href || pathname.startsWith(href + "/")} />
            ))}
          </>
        )}

        {isAdmin && (
          <>
            <div className="pt-4 pb-1 px-3">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
                Admin
              </p>
            </div>
            {ADMIN_NAV.map(({ href, label, icon: Icon }) => (
              <NavLink key={href} href={href} label={label} icon={Icon} active={pathname === href} />
            ))}
          </>
        )}
      </nav>

      {/* User info */}
      {profile && (
        <div className="border-t p-4">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-semibold text-sm">
              {profile.fullName?.[0] ?? profile.email[0].toUpperCase()}
            </div>
            <div className="min-w-0">
              <p className="text-sm font-medium truncate">
                {profile.fullName ?? "User"}
              </p>
              <p className="text-xs text-gray-500 capitalize">
                {profile.subscriptionTier} plan
              </p>
            </div>
          </div>
        </div>
      )}
    </aside>
  );
}

function NavLink({
  href,
  label,
  icon: Icon,
  active,
}: {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  active: boolean;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors",
        active
          ? "bg-blue-50 text-blue-700"
          : "text-gray-700 hover:bg-gray-50 hover:text-gray-900"
      )}
    >
      <Icon className="h-4 w-4 shrink-0" />
      {label}
    </Link>
  );
}
