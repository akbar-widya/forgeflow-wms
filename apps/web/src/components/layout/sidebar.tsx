import { NavLink } from "react-router-dom";
import { Boxes, ClipboardList, LayoutDashboard, MoveRight, Truck, Bell } from "lucide-react";
import { cn } from "@/lib/utils";

const NAV_GROUPS = [
  {
    label: "Overview",
    items: [{ to: "/dashboard", label: "Dashboard", icon: LayoutDashboard }]
  },
  {
    label: "Operations",
    items: [
      { to: "/inbound/receiving", label: "Inbound Receiving", icon: Truck },
      { to: "/outbound/job-allocation", label: "Job Allocation", icon: ClipboardList }
    ]
  },
  {
    label: "Records",
    items: [
      { to: "/movements", label: "Stock Movements", icon: MoveRight },
      { to: "/notifications", label: "Notifications", icon: Bell }
    ]
  }
];

export function Sidebar() {
  return (
    <aside className="fixed inset-y-0 left-0 w-[260px] border-r border-border bg-card">
      <div className="flex h-[64px] items-center gap-2 border-b border-border px-4">
        <div className="flex size-8 items-center justify-center rounded-[4px] bg-primary text-white">
          <Boxes className="size-5" />
        </div>
        <div className="leading-tight">
          <div className="text-sm font-semibold">ForgeFlow</div>
          <div className="font-mono text-[11px] text-muted-foreground">WMS · v0.1</div>
        </div>
      </div>

      <nav className="px-2 py-3">
        {NAV_GROUPS.map((group) => (
          <div key={group.label} className="mb-4">
            <div className="px-4 pb-1 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
              {group.label}
            </div>
            {group.items.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  cn("sidebar-nav-item", isActive && "active")
                }
              >
                <item.icon className="size-4 shrink-0" />
                {item.label}
              </NavLink>
            ))}
          </div>
        ))}
      </nav>

      <div className="absolute bottom-0 left-0 right-0 border-t border-border p-4">
        <div className="text-[11px] text-muted-foreground">
          Cloudflare D1 · SQLite
        </div>
      </div>
    </aside>
  );
}
