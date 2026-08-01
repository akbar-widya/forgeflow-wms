import { Link } from "react-router-dom";
import {
  Boxes,
  Warehouse as WarehouseIcon,
  PackageSearch,
  AlertTriangle,
  FileText,
  ClipboardList
} from "lucide-react";
import { useCapacity, useInventorySummary, useKpis } from "@/lib/hooks";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { StatusBadge } from "@/components/status-badge";
import { formatNumber } from "@/lib/utils";

function KpiCard({
  label,
  value,
  icon: Icon,
  to,
  accent
}: {
  label: string;
  value: number | string;
  icon: React.ElementType;
  to?: string;
  accent?: "primary" | "warning" | "danger" | "success";
}) {
  const accentColor =
    accent === "warning"
      ? "text-warning"
      : accent === "danger"
        ? "text-danger"
        : accent === "success"
          ? "text-success"
          : "text-primary";
  const content = (
    <Card className="cursor-pointer transition-colors hover:bg-secondary/40">
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <div className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            {label}
          </div>
          <Icon className={`size-4 ${accentColor}`} />
        </div>
        <div className="mt-2 font-mono text-2xl font-semibold">{value}</div>
      </CardContent>
    </Card>
  );
  return to ? <Link to={to} className="block">{content}</Link> : content;
}

export function DashboardPage() {
  const { data: kpis, isLoading: kpisLoading } = useKpis();
  const { data: capacity } = useCapacity();
  const { data: summary } = useInventorySummary();

  return (
    <div>
      <PageHeader
        title="Dashboard"
        description="Stock register, capacity and operational analytics"
      />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-3 xl:grid-cols-6">
        <KpiCard
          label="Active SKUs"
          value={kpisLoading ? "—" : formatNumber(kpis?.totalSkuCount ?? 0)}
          icon={Boxes}
          accent="primary"
        />
        <KpiCard
          label="On-hand qty"
          value={kpisLoading ? "—" : formatNumber(kpis?.totalOnHandQty ?? 0)}
          icon={PackageSearch}
          accent="success"
        />
        <KpiCard
          label="Warehouses"
          value={kpisLoading ? "—" : formatNumber(kpis?.totalWarehouseCount ?? 0)}
          icon={WarehouseIcon}
          accent="primary"
        />
        <KpiCard
          label="Low stock"
          value={kpisLoading ? "—" : formatNumber(kpis?.lowStockCount ?? 0)}
          icon={AlertTriangle}
          accent="warning"
        />
        <KpiCard
          label="Open POs"
          value={kpisLoading ? "—" : formatNumber(kpis?.openPoCount ?? 0)}
          icon={FileText}
          accent="primary"
          to="/inbound/receiving"
        />
        <KpiCard
          label="Open jobs"
          value={kpisLoading ? "—" : formatNumber(kpis?.openJobCount ?? 0)}
          icon={ClipboardList}
          accent="primary"
          to="/outbound/job-allocation"
        />
      </div>

      <div className="mt-6 grid grid-cols-1 gap-6 xl:grid-cols-5">
        <Card className="xl:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">Warehouse capacity</CardTitle>
          </CardHeader>
          <CardContent>
            {!capacity ? (
              <Skeleton className="h-40 w-full" />
            ) : (
              <div className="space-y-4">
                {capacity.warehouses.length === 0 && (
                  <div className="text-sm text-muted-foreground">No warehouses yet.</div>
                )}
                {capacity.warehouses.map((w) => {
                  const pct = Math.min(100, Math.round(w.utilizationPct));
                  return (
                    <div key={w.warehouseId}>
                      <div className="flex items-center justify-between text-sm">
                        <span className="font-medium">{w.warehouseCode}</span>
                        <span className="font-mono text-xs text-muted-foreground">
                          {formatNumber(w.onHandQty)} on-hand
                        </span>
                      </div>
                      <div className="mt-1 h-2 w-full rounded-none bg-secondary">
                        <div
                          className="h-2 bg-primary"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                      <div className="mt-1 text-right font-mono text-[11px] text-muted-foreground">
                        {pct}% utilized
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="xl:col-span-3">
          <CardHeader>
            <CardTitle className="text-base">Inventory summary</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="max-h-[420px] overflow-auto">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>SKU</th>
                    <th>Item</th>
                    <th>UoM</th>
                    <th className="text-right">On-hand</th>
                    <th className="text-right">Allocated</th>
                    <th className="text-right">Available</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {(summary?.items ?? []).map((row) => (
                    <tr key={row.itemId}>
                      <td className="font-mono text-xs">{row.sku}</td>
                      <td className="font-medium">{row.itemName}</td>
                      <td>{row.uom}</td>
                      <td className="text-right font-mono">{formatNumber(row.totalOnHand)}</td>
                      <td className="text-right font-mono">{formatNumber(row.totalAllocated)}</td>
                      <td className="text-right font-mono font-semibold">
                        {formatNumber(row.totalAvailable)}
                      </td>
                      <td>
                        <StatusBadge kind="stock" value={row.stockStatus} />
                      </td>
                    </tr>
                  ))}
                  {(summary?.items ?? []).length === 0 && (
                    <tr>
                      <td colSpan={7} className="py-8 text-center text-sm text-muted-foreground">
                        No inventory on hand. Receive stock to see it here.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
