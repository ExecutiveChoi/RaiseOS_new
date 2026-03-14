"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Bell, LogOut, User } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import type { Profile } from "@/types/user";

interface NavbarProps {
  profile: Profile | null;
}

export function Navbar({ profile }: NavbarProps) {
  const [signingOut, setSigningOut] = useState(false);
  const router = useRouter();
  const supabase = createClient();

  async function handleSignOut() {
    setSigningOut(true);
    await supabase.auth.signOut();
    router.push("/");
    router.refresh();
  }

  return (
    <header className="h-16 border-b bg-white flex items-center justify-between px-6">
      <div className="flex items-center gap-2">
        <span className="text-sm text-gray-500">
          {profile?.subscriptionTier === "free" && (
            <span className="text-amber-600 font-medium">
              Free Plan —{" "}
              <a href="/billing" className="underline hover:no-underline">
                Upgrade to Pro
              </a>
            </span>
          )}
        </span>
      </div>

      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon">
          <Bell className="h-4 w-4" />
        </Button>

        <div className="flex items-center gap-2 text-sm text-gray-700">
          <User className="h-4 w-4" />
          <span>{profile?.fullName ?? profile?.email ?? "User"}</span>
        </div>

        <Button
          variant="ghost"
          size="icon"
          onClick={handleSignOut}
          disabled={signingOut}
          title="Sign out"
        >
          <LogOut className="h-4 w-4" />
        </Button>
      </div>
    </header>
  );
}
