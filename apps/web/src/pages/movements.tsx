import { useMemo, useState } from "react";
import { Scissors } from "lucide-react";
import { useMovements } from "@/lib/hooks";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "@/components/ui/select";
import { StatusBadge } from "@/components/status-badge";
import { formatDateTime, formatNumber } from "@/lib/utils";

export function MovementsPage() {
  const [typeFilter, setTypeFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);

  const { data, isLoading } = useMovements({
    page,
    pageSize: 50,
    movementType: typeFilter === "all" ? undefined : typeFilter
  });

  const filtered = useMemo(() => {
    if (!data) return [];
    const q = search.trim().toLowerCase();
    if (!q) return data.items;
    return data.items.filter(
      (m) =>
        m.sku.toLowerCase().includes(q) ||
        m.itemName.toLowerCase().includes(q) ||
        m.lotCode?.toLowerCase().includes(q) ||
        m.fromLocationCode?.toLowerCase().includes(q) ||
        m.toLocationCode?.toLowerCase().includes(q)
    );
  }, [data, search]);

  return (
    <div>
      <PageHeader
        title="Stock movement ledger"
        description="Immutable, append-only record of every inventory transaction"
      />

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <Select value={typeFilter} onValueChange={(v) => { setTypeFilter(v); setPage(1); }}>
          <SelectTrigger className="w-44">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All types</SelectItem>
            <SelectItem value="receive">Received</SelectItem>
            <SelectItem value="issue">Issued</SelectItem>
            <SelectItem value="adjust">Adjusted</SelectItem>
            <SelectItem value="transfer">Transfers</SelectItem>
            <SelectItem value="scrap_return">Scrap returns</SelectItem>
            <SelectItem value="correction">Corrections</SelectItem>
          </SelectContent>
        </Select>
        <Input
          placeholder="Search SKU, item, lot, location..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-xs"
        />
      </div>

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-8 text-center text-sm text-muted-foreground">Loading movements...</div>
          ) : (
            <table className="data-table">
              <thead>
                <tr>
                  <th>Type</th>
                  <th>SKU</th>
                  <th>Item</th>
                  <th>Lot</th>
                  <th>From</th>
                  <th>To</th>
                  <th className="text-right">Qty</th>
                  <th>Reference</th>
                  <th>By</th>
                  <th className="text-right">Occurred</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((m) => {
                  const positive = m.qtyDelta > 0;
                  return (
                    <tr key={m.id}>
                      <td>
                        <StatusBadge kind="movement" value={m.movementType} />
                      </td>
                      <td className="font-mono text-xs">{m.sku}</td>
                      <td className="font-medium">{m.itemName}</td>
                      <td className="font-mono text-xs">{m.lotCode ?? "—"}</td>
                      <td className="font-mono text-xs">{m.fromLocationCode ?? "—"}</td>
                      <td className="font-mono text-xs">{m.toLocationCode ?? "—"}</td>
                      <td className={`text-right font-mono font-semibold ${positive ? "text-success" : "text-danger"}`}>
                        {positive ? "+" : ""}
                        {formatNumber(m.qtyDelta)}
                      </td>
                      <td className="font-mono text-xs">{m.referenceId ?? "—"}</td>
                      <td className="text-xs text-muted-foreground">{m.performedByName ?? "—"}</td>
                      <td className="text-right font-mono text-xs">
                        {formatDateTime(m.occurredAt)}
                      </td>
                    </tr>
                  );
                })}
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={10} className="py-8 text-center text-sm text-muted-foreground">
                      <Scissors className="mx-auto mb-2 size-5 opacity-50" />
                      No movements found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>

      {data && data.meta.totalPages > 1 && (
        <div className="mt-4 flex items-center justify-between text-sm">
          <span className="text-muted-foreground">
            {data.meta.total} movements · page {data.meta.page} of {data.meta.totalPages}
          </span>
          <div className="flex gap-2">
            <button
              className="rounded-[4px] border border-border px-3 py-1.5 hover:bg-secondary disabled:opacity-40"
              disabled={!data.meta.hasPrev}
              onClick={() => setPage((p) => p - 1)}
            >
              Prev
            </button>
            <button
              className="rounded-[4px] border border-border px-3 py-1.5 hover:bg-secondary disabled:opacity-40"
              disabled={!data.meta.hasNext}
              onClick={() => setPage((p) => p + 1)}
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
