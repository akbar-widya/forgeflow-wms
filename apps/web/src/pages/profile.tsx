import { useQuery } from "@tanstack/react-query";
import { apiGet } from "@/lib/api-client";
import { PageHeader } from "@/components/page-header";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";

type MeResponse = {
  user: {
    id: string;
    email: string;
    name: string;
    role: string;
    staffProfile?: {
      id: string;
      authUserId: string;
      employeeCode: string;
      displayName: string;
      role: string;
      status: string;
    };
  };
};

const ROLE_VARIANTS: Record<string, "secondary" | "success" | "warning" | "danger" | "info"> = {
  operator: "success",
  manager: "warning",
  admin: "danger",
  auditor: "info"
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

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4 px-6 py-3.5">
      <span className="font-mono text-[11px] uppercase tracking-wide text-muted-foreground">
        {label}
      </span>
      <span className="text-sm font-medium">{value || "—"}</span>
    </div>
  );
}

export function ProfilePage() {
  const { data, isLoading } = useQuery({
    queryKey: ["me"],
    queryFn: () => apiGet<MeResponse>("/api/me"),
    staleTime: 60_000
  });

  const user = data?.user;
  const staff = user?.staffProfile;
  const displayName = staff?.displayName ?? user?.name ?? "";
  const email = user?.email ?? "";
  const role = staff?.role ?? user?.role ?? "";
  const employeeCode = staff?.employeeCode ?? "";

  return (
    <div>
      <PageHeader title="Profile" description="Your account and warehouse identity" />

      <Card className="max-w-2xl rounded-none border-border shadow-none">
        {isLoading && !data ? (
          <CardContent className="py-8 text-center text-sm text-muted-foreground">
            Loading profile...
          </CardContent>
        ) : (
          <CardContent className="p-0">
            <div className="flex items-center gap-4 border-b border-border p-6">
              <Avatar className="size-14">
                <AvatarFallback className="bg-primary/10 text-primary text-base font-semibold">
                  {initials(displayName || "U")}
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <h2 className="truncate text-lg font-semibold">{displayName || "User"}</h2>
                  {role && (
                    <Badge variant={ROLE_VARIANTS[role] ?? "secondary"} className="uppercase">
                      {role}
                    </Badge>
                  )}
                </div>
                <div className="mt-0.5 truncate font-mono text-xs text-muted-foreground">
                  {email}
                </div>
              </div>
            </div>

            <dl className="divide-y divide-border">
              <DetailRow label="Name" value={displayName} />
              <DetailRow label="Email" value={email} />
              <DetailRow label="Role" value={role} />
              <DetailRow label="Employee ID" value={employeeCode} />
            </dl>
          </CardContent>
        )}
      </Card>
    </div>
  );
}
