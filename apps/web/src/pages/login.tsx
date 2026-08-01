import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Boxes, Eye, EyeOff, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { authClient } from "@/lib/auth-client";

export function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const from = (location.state as { from?: { pathname?: string } })?.from?.pathname ?? "/dashboard";

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const { error: signInError } = await authClient.signIn.email({ email, password });
      if (signInError) {
        setError("Invalid email or password");
        return;
      }
      toast.success("Signed in");
      navigate(from, { replace: true });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen">
      <div className="hidden w-1/2 flex-col justify-between border-r border-border bg-card p-10 lg:flex">
        <div className="flex items-center gap-2">
          <div className="flex size-9 items-center justify-center rounded-[4px] bg-primary text-white">
            <Boxes className="size-5" />
          </div>
          <div className="leading-tight">
            <div className="text-base font-semibold">ForgeFlow</div>
            <div className="font-mono text-[11px] text-muted-foreground">WMS</div>
          </div>
        </div>

        <div>
          <div className="font-mono text-xs uppercase tracking-widest text-primary">
            Warehouse Management System
          </div>
          <h2 className="mt-3 text-3xl font-semibold leading-tight">
            Mission-critical inventory control at the edge.
          </h2>
          <ul className="mt-8 space-y-3 text-sm text-muted-foreground">
            <li className="flex items-center gap-2">
              <span className="font-mono text-primary">01</span> Receive, inspect and post inbound stock
            </li>
            <li className="flex items-center gap-2">
              <span className="font-mono text-primary">02</span> Allocate material to jobs with full traceability
            </li>
            <li className="flex items-center gap-2">
              <span className="font-mono text-primary">03</span> Immutable movement ledger &amp; live balances
            </li>
          </ul>
        </div>

        <div className="text-xs text-muted-foreground">
          ForgeFlow WMS · Cloudflare D1 · Powered by Workers
        </div>
      </div>

      <div className="flex flex-1 items-center justify-center bg-background p-6">
        <div className="w-full max-w-sm">
          <div className="mb-8 lg:hidden">
            <div className="flex items-center gap-2">
              <div className="flex size-9 items-center justify-center rounded-[4px] bg-primary text-white">
                <Boxes className="size-5" />
              </div>
              <div className="text-base font-semibold">ForgeFlow WMS</div>
            </div>
          </div>

          <h1 className="text-2xl font-semibold">Sign in</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Access your warehouse operations console.
          </p>

          <form onSubmit={handleSubmit} className="mt-8 space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@forgeflow.io"
              />
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label htmlFor="password">Password</Label>
                <Link
                  to="#"
                  className="text-xs text-primary hover:underline"
                  onClick={(e) => e.preventDefault()}
                >
                  Forgot password?
                </Link>
              </div>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((s) => !s)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-muted-foreground hover:text-foreground"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                </button>
              </div>
            </div>

            {error && (
              <div className="rounded-[4px] border border-danger/30 bg-danger/10 px-3 py-2 text-xs text-danger">
                {error}
              </div>
            )}

            <Button type="submit" className="w-full" disabled={loading}>
              {loading && <Loader2 className="size-4 animate-spin" data-icon="inline-start" />}
              {loading ? "Signing in..." : "Sign in"}
            </Button>
          </form>

          <div className="mt-6 border-t border-border pt-4 text-center text-xs text-muted-foreground">
            Authorized personnel only. All activity is logged.
          </div>
        </div>
      </div>
    </div>
  );
}
