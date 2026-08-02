import { Link, useNavigate } from "react-router-dom";
import { LogOut, User } from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { apiGet } from "@/lib/api-client";
import { authClient } from "@/lib/auth-client";
import { useAuthStore } from "@/stores/auth-store";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

type MeResponse = {
  user: {
    id: string;
    email: string;
    name: string;
    role: string;
    staffProfile?: { employeeCode: string; role: string; displayName: string };
  };
};

function initials(name: string): string {
  return name
    .split(/\s+/)
    .map((p) => p[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

export function Header() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { setUnauthenticated } = useAuthStore();
  const { data } = useQuery({
    queryKey: ["me"],
    queryFn: () => apiGet<MeResponse>("/api/me"),
    staleTime: 60_000
  });

  const user = data?.user;
  const displayName = user?.staffProfile?.displayName ?? user?.name ?? "";
  const role = user?.staffProfile?.role ?? user?.role ?? "";
  const employeeCode = user?.staffProfile?.employeeCode ?? "";

  async function handleLogout() {
    try {
      await authClient.signOut();
    } catch {
      // still clear local session even if the server call fails
    }
    setUnauthenticated();
    queryClient.clear();
    navigate("/login", { replace: true });
  }

  return (
    <header className="sticky top-0 z-20 flex h-[64px] items-center justify-between border-b border-border bg-card px-6">
      <div className="font-mono text-xs text-muted-foreground">
        {new Date().toLocaleDateString("en-US", {
          weekday: "long",
          year: "numeric",
          month: "long",
          day: "numeric"
        })}
      </div>

      <div className="flex items-center gap-3">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="flex items-center gap-2 rounded-[4px] border border-border px-2 py-1 hover:bg-secondary">
              <Avatar className="size-7">
                <AvatarFallback className="bg-primary/10 text-primary text-xs font-semibold">
                  {initials(displayName || "U")}
                </AvatarFallback>
              </Avatar>
              <div className="text-left leading-tight">
                <div className="text-xs font-medium">{displayName || "User"}</div>
                <div className="font-mono text-[10px] uppercase text-muted-foreground">
                  {role || ""}
                  {employeeCode ? ` · ${employeeCode}` : ""}
                </div>
              </div>
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel>
              {displayName || "User"}
              <div className="text-xs font-normal text-muted-foreground">
                {user?.email ?? ""}
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <Link to="/profile">
                <User data-icon="inline-start" />
                Profile
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem onClick={handleLogout}>
              <LogOut data-icon="inline-start" />
              Sign out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
