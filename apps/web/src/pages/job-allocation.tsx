import { useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { toast } from "sonner";
import {
  ArrowLeft,
  ClipboardCheck,
  Plus,
  RotateCcw,
  Trash2,
  Workflow
} from "lucide-react";
import {
  useCreateIssues,
  useCreateJob,
  useCreateScrapReturn,
  useItems,
  useJob,
  useJobs,
  useStockBalances,
  useWarehouses,
  useWarehouseLocations
} from "@/lib/hooks";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "@/components/ui/select";
import { StatusBadge } from "@/components/status-badge";
import { formatDate, formatDateTime, formatNumber } from "@/lib/utils";
import type { JobBomLine, StockBalance } from "@forgeflow/contracts";

function CreateJobDialog({
  open,
  onOpenChange
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { data: warehouses, refetch: refetchWarehouses } = useWarehouses({ pageSize: 100 });
  const { data: items, refetch: refetchItems } = useItems({ pageSize: 100 });
  const createJob = useCreateJob();
  const [warehouseId, setWarehouseId] = useState("");
  const [workOrderRef, setWorkOrderRef] = useState("");
  const [lines, setLines] = useState<
    { itemId: string; requiredQty: number }[]
  >([{ itemId: "", requiredQty: 0 }]);
  const [submitting, setSubmitting] = useState(false);

  const warehouseList = warehouses?.items ?? [];
  const itemList = items?.items ?? [];
  const hasMasterData = warehouseList.length > 0 && itemList.length > 0;

  useEffect(() => {
    if (open) {
      refetchWarehouses();
      refetchItems();
    }
  }, [open, refetchWarehouses, refetchItems]);

  function handleCreate() {
    const validLines = lines.filter((l) => l.itemId && l.requiredQty > 0);
    if (!warehouseId || validLines.length === 0) {
      toast.error("Select a warehouse and add at least one line");
      return;
    }
    setSubmitting(true);
    createJob
      .mutateAsync({
        warehouseId,
        workOrderRef: workOrderRef || undefined,
        bomLines: validLines
      })
      .then((job) => {
        toast.success(`Job ${job.jobNumber} created`);
        onOpenChange(false);
        setWarehouseId("");
        setWorkOrderRef("");
        setLines([{ itemId: "", requiredQty: 0 }]);
      })
      .catch((err) =>
        toast.error(err instanceof Error ? err.message : "Failed to create job")
      )
      .finally(() => setSubmitting(false));
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Create job</DialogTitle>
          <DialogDescription>
            Define a production job with its bill of materials.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Warehouse</Label>
              <Select value={warehouseId} onValueChange={setWarehouseId}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select warehouse" />
                </SelectTrigger>
                <SelectContent>
                  {warehouseList.map((w) => (
                    <SelectItem key={w.id} value={w.id}>
                      {w.code} · {w.name}
                    </SelectItem>
                  ))}
                  {warehouseList.length === 0 && (
                    <SelectItem value="__none" disabled>
                      No warehouses — create one in Master Data
                    </SelectItem>
                  )}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Work order ref</Label>
              <Input
                value={workOrderRef}
                onChange={(e) => setWorkOrderRef(e.target.value)}
                placeholder="WO-1001"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>BOM lines</Label>
            {lines.map((line, i) => (
              <div key={i} className="flex items-center gap-3">
                <Select
                  value={line.itemId}
                  onValueChange={(v) =>
                    setLines((prev) =>
                      prev.map((l, idx) => (idx === i ? { ...l, itemId: v } : l))
                    )
                  }
                >
                  <SelectTrigger className="flex-1">
                    <SelectValue placeholder="Select item" />
                  </SelectTrigger>
                  <SelectContent>
                    {itemList.map((item) => (
                      <SelectItem key={item.id} value={item.id}>
                        {item.sku} · {item.name}
                      </SelectItem>
                    ))}
                    {itemList.length === 0 && (
                      <SelectItem value="__none" disabled>
                        No items — create one in Master Data
                      </SelectItem>
                    )}
                  </SelectContent>
                </Select>
                <Input
                  type="number"
                  min={1}
                  placeholder="Qty"
                  className="w-28"
                  value={line.requiredQty || ""}
                  onChange={(e) =>
                    setLines((prev) =>
                      prev.map((l, idx) =>
                        idx === i ? { ...l, requiredQty: Number(e.target.value) } : l
                      )
                    )
                  }
                />
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setLines((prev) => prev.filter((_, idx) => idx !== i))}
                  disabled={lines.length === 1}
                >
                  <Plus className="size-4 rotate-45" />
                </Button>
              </div>
            ))}
            <Button
              variant="outline"
              size="sm"
              onClick={() => setLines((prev) => [...prev, { itemId: "", requiredQty: 0 }])}
            >
              <Plus data-icon="inline-start" />
              Add line
            </Button>
          </div>
        </div>

        <DialogFooter>
          {!hasMasterData && (
            <p className="mr-auto text-xs text-muted-foreground">
              Create a warehouse and an item under Master Data to enable job creation.
            </p>
          )}
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleCreate}
            disabled={submitting || !hasMasterData}
            title={!hasMasterData ? "Warehouses and items required" : undefined}
          >
            {submitting ? "Creating..." : "Create job"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

type Allocation = {
  key: string;
  balanceId: string;
  bomLineId: string;
  itemId: string;
  sku: string;
  itemName: string;
  lotId: string | null;
  lotCode: string | null;
  locationId: string;
  locationCode: string;
  qty: number;
};

function AllocateDialog({
  line,
  balances,
  allocations,
  onClose,
  onAdd,
  onRemove
}: {
  line: JobBomLine;
  balances: StockBalance[];
  allocations: Allocation[];
  onClose: () => void;
  onAdd: (a: Allocation) => void;
  onRemove: (key: string) => void;
}) {
  const [balanceId, setBalanceId] = useState("");
  const [qty, setQty] = useState(0);

  const remaining = line.requiredQty - line.issuedQty;
  const allocatedForLine = allocations
    .filter((a) => a.bomLineId === line.id)
    .reduce((s, a) => s + a.qty, 0);
  const leftToAllocate = Math.max(0, remaining - allocatedForLine);

  const eligible = balances.filter(
    (b) => b.itemId === line.itemId && b.availableQty > 0
  );
  const usedFromBalance = (balanceId: string) =>
    allocations
      .filter((a) => a.balanceId === balanceId)
      .reduce((s, a) => s + a.qty, 0);

  const selectedBalance = eligible.find((b) => b.id === balanceId);
  const maxQty = selectedBalance
    ? Math.min(
        selectedBalance.availableQty - usedFromBalance(selectedBalance.id),
        leftToAllocate
      )
    : 0;

  function add() {
    if (!selectedBalance || qty <= 0) {
      toast.error("Choose a lot/location and enter a quantity");
      return;
    }
    onAdd({
      key: `${line.id}:${selectedBalance.id}`,
      balanceId: selectedBalance.id,
      bomLineId: line.id,
      itemId: line.itemId,
      sku: line.sku,
      itemName: line.itemName,
      lotId: selectedBalance.lotId,
      lotCode: selectedBalance.lotCode,
      locationId: selectedBalance.locationId,
      locationCode: selectedBalance.locationCode,
      qty
    });
    setBalanceId("");
    setQty(0);
  }

  const lineAllocations = allocations.filter((a) => a.bomLineId === line.id);

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Allocate — {line.sku}</DialogTitle>
          <DialogDescription>
            {line.itemName} · required {formatNumber(line.requiredQty)} · issued{" "}
            {formatNumber(line.issuedQty)} · remaining {formatNumber(remaining)}
          </DialogDescription>
        </DialogHeader>

        {leftToAllocate <= 0 ? (
          <p className="text-sm text-muted-foreground">
            This line is fully issued — nothing left to allocate.
          </p>
        ) : (
          <>
            <div className="flex flex-wrap items-end gap-3">
              <div className="min-w-[240px] flex-1 space-y-1.5">
                <Label>Lot · Location</Label>
                <Select value={balanceId} onValueChange={setBalanceId}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select stock" />
                  </SelectTrigger>
                  <SelectContent>
                    {eligible.map((b) => {
                      const avail = b.availableQty - usedFromBalance(b.id);
                      return (
                        <SelectItem key={b.id} value={b.id} disabled={avail <= 0}>
                          {b.lotCode ?? "No lot"} · {b.locationCode} ·{" "}
                          {formatNumber(avail)} available
                        </SelectItem>
                      );
                    })}
                    {eligible.length === 0 && (
                      <SelectItem value="__none" disabled>
                        No available stock for this item
                      </SelectItem>
                    )}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Qty</Label>
                <Input
                  type="number"
                  min={1}
                  max={Math.max(0, maxQty)}
                  className="w-28"
                  value={qty || ""}
                  onChange={(e) => setQty(Number(e.target.value))}
                />
              </div>
              <Button
                onClick={add}
                disabled={!selectedBalance || qty <= 0 || maxQty <= 0}
              >
                <Plus data-icon="inline-start" />
                Add allocation
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              {formatNumber(leftToAllocate)} of {formatNumber(remaining)} still to
              allocate for this line.
            </p>

            {lineAllocations.length > 0 && (
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Lot</th>
                    <th>Location</th>
                    <th className="text-right">Qty</th>
                    <th className="text-right">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {lineAllocations.map((a) => (
                    <tr key={a.key}>
                      <td className="font-mono text-xs">{a.lotCode ?? "—"}</td>
                      <td className="font-mono text-xs">{a.locationCode}</td>
                      <td className="text-right font-mono">{formatNumber(a.qty)}</td>
                      <td className="text-right">
                        <Button size="icon" variant="ghost" onClick={() => onRemove(a.key)}>
                          <Trash2 className="size-4" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

function JobDetail({ jobId, onBack }: { jobId: string; onBack: () => void }) {
  const navigate = useNavigate();
  const { data: job } = useJob(jobId);
  const { data: balancesData } = useStockBalances({
    warehouseId: job?.warehouseId,
    pageSize: 200
  });
  const balances = balancesData?.items ?? [];
  const createIssues = useCreateIssues();
  const scrapReturn = useCreateScrapReturn();
  const { data: whLocations } = useWarehouseLocations(job?.warehouseId);
  const locations = whLocations?.locations ?? [];

  const [allocations, setAllocations] = useState<Allocation[]>([]);
  const [allocateLineId, setAllocateLineId] = useState<string | null>(null);
  const [scrapOpen, setScrapOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  if (!job) return null;

  const canIssue =
    job.status === "planned" ||
    job.status === "allocated" ||
    job.status === "in_progress";
  const totalAllocated = allocations.reduce((s, a) => s + a.qty, 0);
  const allocateLine =
    job.bomLines.find((l) => l.id === allocateLineId) ?? null;

  function addAllocation(a: Allocation) {
    setAllocations((prev) => {
      const existing = prev.find((x) => x.key === a.key);
      return existing
        ? prev.map((x) => (x.key === a.key ? { ...x, qty: x.qty + a.qty } : x))
        : [...prev, a];
    });
  }

  function removeAllocation(key: string) {
    setAllocations((prev) => prev.filter((a) => a.key !== key));
  }

  async function handleIssueMaterials() {
    if (allocations.length === 0) return;
    setSubmitting(true);
    try {
      await createIssues.mutateAsync({
        jobId: job.id,
        body: {
          lines: allocations.map((a) => ({
            bomLineId: a.bomLineId,
            sourceLocationId: a.locationId,
            lotId: a.lotId ?? undefined,
            issueQty: a.qty
          }))
        }
      });
      toast.success(
        `Issued ${formatNumber(totalAllocated)} units to ${job.jobNumber}`
      );
      setAllocations([]);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Issue materials failed");
    } finally {
      setSubmitting(false);
    }
  }

  const detailCells: { label: string; value: ReactNode }[] = [
    { label: "Job number", value: job.jobNumber },
    { label: "Work order", value: job.workOrderRef ?? "—" },
    { label: "Warehouse", value: job.warehouseCode },
    { label: "Due date", value: formatDate(job.dueDate) },
    { label: "Status", value: <StatusBadge kind="job" value={job.status} /> },
    { label: "Created", value: formatDateTime(job.createdAt) },
    { label: "BOM lines", value: String(job.bomLines.length) }
  ];

  return (
    <div>
      <PageHeader
        title={job.jobNumber}
        description={`${job.warehouseCode} · ${
          job.workOrderRef ?? "no work order"
        }${job.dueDate ? ` · due ${formatDate(job.dueDate)}` : ""}`}
        actions={
          <>
            <Button variant="outline" size="sm" onClick={onBack}>
              <ArrowLeft data-icon="inline-start" />
              Back
            </Button>
            {canIssue && (
              <Button variant="outline" size="sm" onClick={() => setScrapOpen(true)}>
                <RotateCcw data-icon="inline-start" />
                Scrap return
              </Button>
            )}
            <Button
              size="sm"
              onClick={handleIssueMaterials}
              disabled={submitting || allocations.length === 0 || !canIssue}
            >
              <ClipboardCheck data-icon="inline-start" />
              {submitting
                ? "Issuing..."
                : `Issue materials${totalAllocated > 0 ? ` (${formatNumber(totalAllocated)})` : ""}`}
            </Button>
          </>
        }
      />

      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Job details</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="grid grid-cols-2 gap-px bg-border md:grid-cols-4">
              {detailCells.map((cell) => (
                <div key={cell.label} className="bg-card p-4">
                  <div className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                    {cell.label}
                  </div>
                  <div className="mt-1 text-sm">{cell.value}</div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Bill of materials</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <table className="data-table">
              <thead>
                <tr>
                  <th>SKU</th>
                  <th>Item</th>
                  <th className="text-right">Required</th>
                  <th className="text-right">Issued</th>
                  <th className="text-right">Allocated</th>
                  <th className="text-right">Remaining</th>
                  <th>Status</th>
                  <th className="text-right">Action</th>
                </tr>
              </thead>
              <tbody>
                {job.bomLines.map((line) => {
                  const remaining = line.requiredQty - line.issuedQty;
                  const allocatedInCart = allocations
                    .filter((a) => a.bomLineId === line.id)
                    .reduce((s, a) => s + a.qty, 0);
                  const fullyIssued = remaining <= 0;
                  return (
                    <tr key={line.id}>
                      <td className="font-mono text-xs">{line.sku}</td>
                      <td className="font-medium">{line.itemName}</td>
                      <td className="text-right font-mono">{formatNumber(line.requiredQty)}</td>
                      <td className="text-right font-mono">{formatNumber(line.issuedQty)}</td>
                      <td className="text-right font-mono">{formatNumber(allocatedInCart)}</td>
                      <td className="text-right font-mono">{formatNumber(Math.max(0, remaining))}</td>
                      <td>
                        <StatusBadge
                          kind="stock"
                          value={
                            fullyIssued
                              ? "available"
                              : line.issuedQty > 0
                                ? "low"
                                : "out_of_stock"
                          }
                        />
                      </td>
                      <td className="text-right">
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={!canIssue || remaining <= 0}
                          onClick={() => setAllocateLineId(line.id)}
                        >
                          Allocate
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle className="text-base">Allocations</CardTitle>
            <p className="text-xs text-muted-foreground">
              {allocations.length} allocation(s) ·{" "}
              {formatNumber(totalAllocated)} units ready to issue
            </p>
          </CardHeader>
          <CardContent className="p-0">
            {allocations.length === 0 ? (
              <div className="py-10 text-center text-sm text-muted-foreground">
                No allocations staged. Use "Allocate" on a BOM line to pick the
                exact lot and location.
              </div>
            ) : (
              <div className="max-h-[400px] overflow-auto">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>SKU</th>
                      <th>Item</th>
                      <th>Lot</th>
                      <th>Location</th>
                      <th className="text-right">Qty</th>
                      <th className="text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {allocations.map((a) => (
                      <tr key={a.key}>
                        <td className="font-mono text-xs">{a.sku}</td>
                        <td>{a.itemName}</td>
                        <td className="font-mono text-xs">{a.lotCode ?? "—"}</td>
                        <td className="font-mono text-xs">{a.locationCode}</td>
                        <td className="text-right font-mono">{formatNumber(a.qty)}</td>
                        <td className="text-right">
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => removeAllocation(a.key)}
                          >
                            <Trash2 className="size-4" />
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {allocateLine && (
        <AllocateDialog
          key={allocateLine.id}
          line={allocateLine}
          balances={balances}
          allocations={allocations}
          onClose={() => setAllocateLineId(null)}
          onAdd={addAllocation}
          onRemove={removeAllocation}
        />
      )}

      <ScrapReturnDialog
        open={scrapOpen}
        onOpenChange={setScrapOpen}
        jobId={job.id}
        locations={locations}
        onSubmit={(payload) =>
          scrapReturn
            .mutateAsync({ jobId: job.id, body: payload })
            .then(() => toast.success("Scrap return recorded"))
            .catch((err) =>
              toast.error(err instanceof Error ? err.message : "Scrap return failed")
            )
        }
      />
    </div>
  );
}

function ScrapReturnDialog({
  open,
  onOpenChange,
  jobId,
  locations,
  onSubmit
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  jobId: string;
  locations: { id: string; code: string }[];
  onSubmit: (payload: {
    itemId: string;
    targetLocationId: string;
    returnQty: number;
    reasonCode: string;
  }) => void;
}) {
  const { data: job } = useJob(jobId);
  const [itemId, setItemId] = useState("");
  const [targetLocationId, setTargetLocationId] = useState("");
  const [returnQty, setReturnQty] = useState(0);
  const [reasonCode, setReasonCode] = useState("");

  function submit() {
    if (!itemId || !targetLocationId || returnQty <= 0 || !reasonCode) {
      toast.error("Fill all fields to record a scrap return");
      return;
    }
    onSubmit({
      itemId,
      targetLocationId,
      returnQty,
      reasonCode
    });
    onOpenChange(false);
    setItemId("");
    setTargetLocationId("");
    setReturnQty(0);
    setReasonCode("");
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Scrap return</DialogTitle>
          <DialogDescription>
            Return rejected material back to a quarantine location.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>Item</Label>
            <Select value={itemId} onValueChange={setItemId}>
              <SelectTrigger>
                <SelectValue placeholder="Select item" />
              </SelectTrigger>
              <SelectContent>
                {(job?.bomLines ?? []).map((l) => (
                  <SelectItem key={l.id} value={l.itemId}>
                    {l.sku} · {l.itemName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Target location</Label>
            <Select value={targetLocationId} onValueChange={setTargetLocationId}>
              <SelectTrigger>
                <SelectValue placeholder="Quarantine location" />
              </SelectTrigger>
              <SelectContent>
                {locations.map((loc) => (
                  <SelectItem key={loc.id} value={loc.id}>
                    {loc.code}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Quantity</Label>
            <Input
              type="number"
              min={1}
              value={returnQty || ""}
              onChange={(e) => setReturnQty(Number(e.target.value))}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Reason code</Label>
            <Select value={reasonCode} onValueChange={setReasonCode}>
              <SelectTrigger>
                <SelectValue placeholder="Select reason" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="defective">Defective</SelectItem>
                <SelectItem value="damaged">Damaged</SelectItem>
                <SelectItem value="obsolete">Obsolete</SelectItem>
                <SelectItem value="wrong_spec">Wrong spec</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button variant="destructive" onClick={submit}>
            Record return
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function JobAllocationPage() {
  const { jobId } = useParams();
  const navigate = useNavigate();
  const [createOpen, setCreateOpen] = useState(false);
  const { data: jobs } = useJobs({ pageSize: 100 });
  const [statusFilter, setStatusFilter] = useState("all");

  const filtered = useMemo(() => {
    if (statusFilter === "all") return jobs?.items ?? [];
    return (jobs?.items ?? []).filter((j) => j.status === statusFilter);
  }, [jobs, statusFilter]);

  if (jobId) {
    return (
      <JobDetail jobId={jobId} onBack={() => navigate("/outbound/job-allocation")} />
    );
  }

  return (
    <div>
      <PageHeader
        title="Job allocation"
        description="Allocate raw material to production jobs and issue quantities"
        actions={
          <Button onClick={() => setCreateOpen(true)}>
            <Workflow data-icon="inline-start" />
            New job
          </Button>
        }
      />

      <div className="mb-4 flex items-center gap-2">
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-44">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value="planned">Planned</SelectItem>
            <SelectItem value="allocated">Allocated</SelectItem>
            <SelectItem value="in_progress">In progress</SelectItem>
            <SelectItem value="completed">Completed</SelectItem>
            <SelectItem value="cancelled">Cancelled</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Card>
        <CardContent className="p-0">
          <table className="data-table">
            <thead>
              <tr>
                <th>Job</th>
                <th>Work order</th>
                <th>Warehouse</th>
                <th className="text-right">BOM lines</th>
                <th>Status</th>
                <th className="text-right">Created</th>
                <th className="text-right">Action</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((job) => (
                <tr
                  key={job.id}
                  className="cursor-pointer"
                  onClick={() => navigate(`/outbound/job-allocation/${job.id}`)}
                >
                  <td className="font-mono text-xs">{job.jobNumber}</td>
                  <td className="font-mono text-xs">{job.workOrderRef ?? "—"}</td>
                  <td className="font-mono text-xs">{job.warehouseCode}</td>
                  <td className="text-right font-mono">{job.bomLines.length}</td>
                  <td>
                    <StatusBadge kind="job" value={job.status} />
                  </td>
                  <td className="font-mono text-xs">
                    {new Date(job.createdAt).toLocaleDateString()}
                  </td>
                  <td className="text-right">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={(e) => {
                        e.stopPropagation();
                        navigate(`/outbound/job-allocation/${job.id}`);
                      }}
                    >
                      Open
                    </Button>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-sm text-muted-foreground">
                    No jobs found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </CardContent>
      </Card>

      <CreateJobDialog open={createOpen} onOpenChange={setCreateOpen} />
    </div>
  );
}
