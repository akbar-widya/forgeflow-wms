import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Outlet, Navigate, useLocation } from "react-router-dom";
import { apiGet } from "@/lib/api-client";
import { useAuthStore } from "@/stores/auth-store";
import { Skeleton } from "@/components/ui/skeleton";

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

function FullScreenLoader() {
  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="w-72">
        <Skeleton className="h-8 w-48 mb-3" />
        <Skeleton className="h-4 w-full mb-2" />
        <Skeleton className="h-4 w-2/3" />
      </div>
    </div>
  );
}

export function RequireAuth() {
  const location = useLocation();
  const { status, setAuthenticated, setUnauthenticated } = useAuthStore();

  const { data, error, isLoading } = useQuery({
    queryKey: ["me"],
    queryFn: () => apiGet<MeResponse>("/api/me"),
    retry: false,
    staleTime: 60_000
  });

  const isAuthenticated = Boolean(data?.user);

  useEffect(() => {
    if (data?.user) {
      const staff = data.user?.staffProfile;
      setAuthenticated({
        id: data.user.id,
        email: data.user.email,
        name: staff?.displayName ?? data.user.name,
        role: (staff?.role ?? data.user.role) as "operator" | "manager" | "admin" | "auditor",
        staffProfile: staff
          ? {
              id: staff.id,
              authUserId: staff.authUserId,
              employeeCode: staff.employeeCode,
              displayName: staff.displayName,
              role: staff.role as "operator" | "manager" | "admin" | "auditor",
              status: staff.status
            }
          : undefined
      });
    } else {
      setUnauthenticated();
    }
  }, [data, error, setAuthenticated, setUnauthenticated]);

  // Loading: show a full-screen loader while the session is being resolved.
  if (isLoading && status === "loading") {
    return <FullScreenLoader />;
  }

  // Not authenticated (no user, request failed/unauthorized, or login required):
  // send the user to the login page instead of rendering an empty shell.
  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return <Outlet />;
}

export function RequirePublicOnly() {
  const { data, error } = useQuery({
    queryKey: ["me"],
    queryFn: () => apiGet<MeResponse>("/api/me"),
    retry: false,
    staleTime: 60_000
  });

  if (data) {
    return <Navigate to="/dashboard" replace />;
  }

  if (error) {
    return <Outlet />;
  }

  return <FullScreenLoader />;
}
