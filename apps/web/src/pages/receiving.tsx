import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { FilePlus, PackagePlus, Plus, Trash2 } from "lucide-react";
import { Controller, useFieldArray, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  useBatchPostReceipts,
  useCreatePurchaseOrder,
  useItems,
  usePurchaseOrders,
  useWarehouseLocations,
  useWarehouses
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { StatusBadge } from "@/components/status-badge";
import { ErrorState } from "@/components/error-state";
import { formatDate, formatNumber } from "@/lib/utils";
import type { DiscrepancyCode, PurchaseOrder } from "@forgeflow/contracts";

const createPoSchema = z.object({
  warehouseId: z.string().min(1, "Select a warehouse"),
  supplierName: z
    .string()
    .trim()
    .min(1, "Supplier name is required")
    .max(160, "Max 160 characters"),
  expectedDate: z.string().optional().or(z.literal("")),
  lines: z
    .array(
      z.object({
        itemId: z.string().min(1, "Select an item"),
        orderedQty: z.string().refine(
          (v) => v.trim() !== "" && Number.isFinite(Number(v)) && Number(v) > 0,
          { message: "Qty must be > 0" }
        )
      })
    )
    .min(1, "Add at least one line")
});

type CreatePoValues = z.infer<typeof createPoSchema>;

const DISCREPANCIES = [
  { value: "damaged", label: "Damaged" },
  { value: "wrong_item", label: "Wrong item" },
  { value: "wrong_qty", label: "Wrong qty" },
  { value: "expired", label: "Expired" },
  { value: "no_issue", label: "No issue" }
];

type ReceiptLineDraft = {
  purchaseOrderLineId: string;
  itemId: string;
  sku: string;
  itemName: string;
  receivedQty: number;
  lotCode: string;
  targetLocationId: string;
};

type StagedLine = ReceiptLineDraft & {
  id: string;
  purchaseOrderId: string;
  poNumber: string;
  supplierName: string;
  warehouseId: string;
  warehouseCode: string;
  targetLocationCode: string;
  inspectionResult: "accepted" | "rejected" | "quarantined";
  acceptedQty: number;
  discrepancyCode: string;
};

function genId() {
  return crypto.randomUUID();
}

function CreatePoDialog({
  open,
  onOpenChange
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { data: warehouses } = useWarehouses({ pageSize: 100 });
  const { data: items } = useItems({ pageSize: 100 });
  const createPo = useCreatePurchaseOrder();

  const {
    register,
    handleSubmit,
    control,
    reset,
    formState: { errors, isSubmitting }
  } = useForm<CreatePoValues>({
    resolver: zodResolver(createPoSchema),
    defaultValues: {
      warehouseId: "",
      supplierName: "",
      expectedDate: "",
      lines: [{ itemId: "", orderedQty: "" }]
    }
  });

  const { fields, append, remove } = useFieldArray({ control, name: "lines" });

  function close() {
    onOpenChange(false);
    reset();
  }

  async function onSubmit(values: CreatePoValues) {
    try {
      const po = await createPo.mutateAsync({
        warehouseId: values.warehouseId,
        supplierName: values.supplierName,
        expectedDate: values.expectedDate
          ? new Date(values.expectedDate).getTime()
          : undefined,
        lines: values.lines.map((l) => ({
          itemId: l.itemId,
          orderedQty: Number(l.orderedQty)
        }))
      });
      toast.success(`PO ${po.poNumber} created`);
      close();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to create PO");
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { onOpenChange(o); if (!o) reset(); }}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Create purchase order</DialogTitle>
          <DialogDescription>
            Raise a purchase order against a warehouse and add the items to receive.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Warehouse</Label>
              <Controller
                control={control}
                name="warehouseId"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Select warehouse" />
                    </SelectTrigger>
                    <SelectContent>
                      {(warehouses?.items ?? []).map((w) => (
                        <SelectItem key={w.id} value={w.id}>
                          {w.code} · {w.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
              {errors.warehouseId && (
                <p className="text-xs text-danger">{errors.warehouseId.message}</p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label>Expected date</Label>
              <Input
                type="date"
                className="font-mono"
                aria-invalid={Boolean(errors.expectedDate)}
                {...register("expectedDate")}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Supplier name</Label>
            <Input
              placeholder="Acme Components Inc."
              aria-invalid={Boolean(errors.supplierName)}
              {...register("supplierName")}
            />
            {errors.supplierName && (
              <p className="text-xs text-danger">{errors.supplierName.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label>Items</Label>
            <div className="max-h-[260px] space-y-2 overflow-auto pr-1">
              {fields.map((field, index) => (
                <div key={field.id} className="flex items-center gap-3">
                  <Controller
                    control={control}
                    name={`lines.${index}.itemId`}
                    render={({ field: itemField }) => (
                      <Select
                        value={itemField.value}
                        onValueChange={itemField.onChange}
                      >
                        <SelectTrigger className="flex-1">
                          <SelectValue placeholder="Select item" />
                        </SelectTrigger>
                        <SelectContent>
                          {(items?.items ?? []).map((item) => (
                            <SelectItem key={item.id} value={item.id}>
                              {item.sku} · {item.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  />
                  <Input
                    type="number"
                    min={0}
                    placeholder="Qty"
                    className="w-28 font-mono"
                    aria-invalid={Boolean(errors.lines?.[index]?.orderedQty)}
                    {...register(`lines.${index}.orderedQty`)}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => remove(index)}
                    disabled={fields.length === 1}
                  >
                    <Plus className="size-4 rotate-45" />
                  </Button>
                </div>
              ))}
            </div>
            {errors.lines?.message && (
              <p className="text-xs text-danger">{errors.lines.message}</p>
            )}
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => append({ itemId: "", orderedQty: "" })}
            >
              <Plus data-icon="inline-start" />
              Add line
            </Button>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={close}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              <FilePlus data-icon="inline-start" />
              {isSubmitting ? "Creating..." : "Create PO"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function CreateReceiptDialog({
  open,
  onOpenChange,
  initialPoId,
  onAdd
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialPoId?: string | null;
  onAdd: (lines: StagedLine[]) => void;
}) {
  const { data: pos } = usePurchaseOrders({ pageSize: 100 });
  const openPos = (pos?.items ?? []).filter(
    (p) => p.status === "open" || p.status === "partially_received"
  );
  const [selectedPoId, setSelectedPoId] = useState<string | null>(null);
  const selectedPo = useMemo(
    () => openPos.find((p) => p.id === selectedPoId),
    [openPos, selectedPoId]
  );
  const warehouseId = selectedPo?.warehouseId;
  const { data: whLocations } = useWarehouseLocations(warehouseId);
  const locations = whLocations?.locations ?? [];

  const [drafts, setDrafts] = useState<Record<string, ReceiptLineDraft>>({});
  const preselected = useRef(false);

  function handleSelectPo(poId: string) {
    setSelectedPoId(poId);
    const po = openPos.find((p) => p.id === poId);
    if (po) {
      const next: Record<string, ReceiptLineDraft> = {};
      for (const line of po.lines ?? []) {
        next[line.id] = {
          purchaseOrderLineId: line.id,
          itemId: line.itemId,
          sku: line.sku,
          itemName: line.itemName,
          receivedQty: Math.max(0, line.orderedQty - line.receivedQty),
          lotCode: "",
          targetLocationId: ""
        };
      }
      setDrafts(next);
    }
  }

  useEffect(() => {
    if (!open) {
      preselected.current = false;
      return;
    }
    if (preselected.current || !initialPoId) return;
    const po = openPos.find((p) => p.id === initialPoId);
    if (po) {
      handleSelectPo(initialPoId);
      preselected.current = true;
    }
  }, [open, initialPoId, openPos]);

  function reset() {
    setSelectedPoId(null);
    setDrafts({});
  }

  function handleAdd() {
    if (!selectedPo) return;
    const lines = Object.values(drafts).filter((d) => d.receivedQty > 0);
    if (lines.length === 0) {
      toast.error("Add at least one line with a quantity");
      return;
    }
    const missingLocation = lines.some((l) => !l.targetLocationId);
    if (missingLocation) {
      toast.error("Every line needs a target location");
      return;
    }
    const locById = new Map(locations.map((loc) => [loc.id, loc]));
    const staged: StagedLine[] = lines.map((l) => ({
      id: genId(),
      purchaseOrderLineId: l.purchaseOrderLineId,
      itemId: l.itemId,
      sku: l.sku,
      itemName: l.itemName,
      receivedQty: l.receivedQty,
      lotCode: l.lotCode,
      targetLocationId: l.targetLocationId,
      targetLocationCode: locById.get(l.targetLocationId)?.code ?? "",
      purchaseOrderId: selectedPo.id,
      poNumber: selectedPo.poNumber,
      supplierName: selectedPo.supplierName,
      warehouseId: selectedPo.warehouseId,
      warehouseCode: selectedPo.warehouseCode,
      inspectionResult: "accepted",
      acceptedQty: l.receivedQty,
      discrepancyCode: ""
    }));
    onAdd(staged);
    toast.success(`Added ${staged.length} line(s) to the active receipt`);
    setDrafts((d) => {
      const next = { ...d };
      for (const id of staged.map((s) => s.purchaseOrderLineId)) {
        if (next[id]) {
          next[id] = { ...next[id], receivedQty: 0, lotCode: "" };
        }
      }
      return next;
    });
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { onOpenChange(o); if (!o) reset(); }}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Receive stock</DialogTitle>
          <DialogDescription>
            Add lines to the active receipt staging list. They are posted to
            stock together from the Active receipt tab.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>Purchase order</Label>
            <Select value={selectedPoId ?? ""} onValueChange={handleSelectPo}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select an open PO" />
              </SelectTrigger>
              <SelectContent>
                {openPos.map((po) => (
                  <SelectItem key={po.id} value={po.id}>
                    {po.poNumber} · {po.supplierName}
                  </SelectItem>
                ))}
                {openPos.length === 0 && (
                  <SelectItem value="__none" disabled>
                    No open or partial POs — create one first
                  </SelectItem>
                )}
              </SelectContent>
            </Select>
          </div>

          {selectedPo && (
            <div className="space-y-3 border-t border-border pt-4">
              <div className="flex items-center justify-between text-sm">
                <span className="font-medium">{selectedPo.warehouseCode}</span>
                <span className="text-muted-foreground">
                  {selectedPo.supplierName}
                </span>
              </div>
              <div className="max-h-[320px] space-y-3 overflow-auto pr-1">
                {Object.values(drafts).map((draft) => (
                  <div key={draft.purchaseOrderLineId} className="rounded-[4px] border border-border p-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <span className="font-mono text-xs">{draft.sku}</span>
                        <div className="text-sm font-medium">{draft.itemName}</div>
                      </div>
                      <StatusBadge kind="po" value="open" />
                    </div>
                    <div className="mt-3 grid grid-cols-3 gap-3">
                      <div className="space-y-1">
                        <Label className="text-xs">Quantity</Label>
                        <Input
                          type="number"
                          min={0}
                          value={draft.receivedQty}
                          onChange={(e) =>
                            setDrafts((d) => ({
                              ...d,
                              [draft.purchaseOrderLineId]: {
                                ...draft,
                                receivedQty: Number(e.target.value)
                              }
                            }))
                          }
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Lot code</Label>
                        <Input
                          value={draft.lotCode}
                          placeholder="LOT-001"
                          onChange={(e) =>
                            setDrafts((d) => ({
                              ...d,
                              [draft.purchaseOrderLineId]: {
                                ...draft,
                                lotCode: e.target.value
                              }
                            }))
                          }
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Target location</Label>
                        <Select
                          value={draft.targetLocationId}
                          onValueChange={(v) =>
                            setDrafts((d) => ({
                              ...d,
                              [draft.purchaseOrderLineId]: {
                                ...draft,
                                targetLocationId: v
                              }
                            }))
                          }
                        >
                          <SelectTrigger className="w-full">
                            <SelectValue placeholder="Location" />
                          </SelectTrigger>
                          <SelectContent>
                            {(locations ?? []).map((loc) => (
                              <SelectItem key={loc.id} value={loc.id}>
                                {loc.code} · {loc.locationType}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              {locations.length === 0 && (
                <p className="text-xs text-muted-foreground">
                  No active locations defined for {selectedPo.warehouseCode}.
                </p>
              )}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
          <Button onClick={handleAdd} disabled={!selectedPo}>
            <PackagePlus data-icon="inline-start" />
            Add to receipt
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ActiveLineRow({
  line,
  onChange,
  onRemove
}: {
  line: StagedLine;
  onChange: (id: string, patch: Partial<StagedLine>) => void;
  onRemove: (id: string) => void;
}) {
  const needsDiscrepancy = line.inspectionResult !== "accepted";

  return (
    <tr>
      <td className="font-mono text-xs">{line.poNumber}</td>
      <td className="font-mono text-xs">{line.sku}</td>
      <td className="font-medium">{line.itemName}</td>
      <td className="font-mono text-xs">{line.lotCode || "—"}</td>
      <td className="text-right font-mono">{formatNumber(line.receivedQty)}</td>
      <td>
        <Input
          type="number"
          min={0}
          max={line.receivedQty}
          className="h-7 w-20 text-xs"
          value={line.acceptedQty}
          onChange={(e) => onChange(line.id, { acceptedQty: Number(e.target.value) })}
        />
      </td>
      <td>
        <Select
          value={line.inspectionResult}
          onValueChange={(v) =>
            onChange(line.id, {
              inspectionResult: v as StagedLine["inspectionResult"],
              acceptedQty:
                v === "accepted"
                  ? line.receivedQty
                  : v === "quarantined"
                    ? 0
                    : line.acceptedQty
            })
          }
        >
          <SelectTrigger className="h-7 w-[120px] text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="accepted">Accept</SelectItem>
            <SelectItem value="rejected">Reject</SelectItem>
            <SelectItem value="quarantined">Quarantine</SelectItem>
          </SelectContent>
        </Select>
      </td>
      <td>
        {needsDiscrepancy ? (
          <Select
            value={line.discrepancyCode || "damaged"}
            onValueChange={(v) => onChange(line.id, { discrepancyCode: v })}
          >
            <SelectTrigger className="h-7 w-[140px] text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {DISCREPANCIES.map((d) => (
                <SelectItem key={d.value} value={d.value}>
                  {d.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : (
          <span className="text-xs text-muted-foreground">—</span>
        )}
      </td>
      <td className="font-mono text-xs">{line.targetLocationCode || "—"}</td>
      <td className="text-right">
        <Button size="icon" variant="ghost" onClick={() => onRemove(line.id)}>
          <Trash2 className="size-4" />
        </Button>
      </td>
    </tr>
  );
}

function ActiveReceiptPanel({
  staged,
  onChange,
  onRemove,
  onPostAll,
  posting
}: {
  staged: StagedLine[];
  onChange: (id: string, patch: Partial<StagedLine>) => void;
  onRemove: (id: string) => void;
  onPostAll: () => void;
  posting: boolean;
}) {
  const totalQty = staged.reduce((sum, l) => sum + l.receivedQty, 0);
  const invalid = staged.some(
    (l) =>
      !l.targetLocationId ||
      !Number.isFinite(l.acceptedQty) ||
      l.acceptedQty < 0 ||
      l.acceptedQty > l.receivedQty
  );

  if (staged.length === 0) {
    return (
      <Card>
        <CardContent className="py-10 text-center">
          <p className="text-sm text-muted-foreground">
            No staged receipts. Use "New receipt" to add received items.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          {staged.length} staged line(s) · {formatNumber(totalQty)} units ·
          posted to stock together
        </p>
        <Button onClick={onPostAll} disabled={posting || invalid}>
          <PackagePlus data-icon="inline-start" />
          {posting ? "Posting..." : "Post/Record Receipts"}
        </Button>
      </div>
      {invalid && (
        <p className="text-xs text-danger">
          Review accepted quantities — each must be between 0 and the received
          quantity.
        </p>
      )}
      <Card>
        <CardContent className="p-0">
          <div className="max-h-[480px] overflow-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th>PO</th>
                  <th>SKU</th>
                  <th>Item</th>
                  <th>Lot</th>
                  <th className="text-right">Received</th>
                  <th className="text-right">Accepted</th>
                  <th>Result</th>
                  <th>Discrepancy</th>
                  <th>Target</th>
                  <th className="text-right">Action</th>
                </tr>
              </thead>
              <tbody>
                {staged.map((line) => (
                  <ActiveLineRow
                    key={line.id}
                    line={line}
                    onChange={onChange}
                    onRemove={onRemove}
                  />
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function PoDetail({
  po,
  onReceive
}: {
  po: PurchaseOrder;
  onReceive: (poId: string) => void;
}) {
  const canReceive = po.status === "open" || po.status === "partially_received";

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between">
        <div className="flex items-center gap-3">
          <div>
            <CardTitle className="text-base">{po.poNumber}</CardTitle>
            <div className="text-xs text-muted-foreground">
              {po.supplierName} · {po.warehouseCode}
              {po.expectedDate ? ` · Expected ${formatDate(po.expectedDate)}` : ""}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <StatusBadge kind="po" value={po.status} />
          {canReceive && (
            <Button size="sm" onClick={() => onReceive(po.id)}>
              <PackagePlus data-icon="inline-start" />
              Receive
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <table className="data-table">
          <thead>
            <tr>
              <th>SKU</th>
              <th>Item</th>
              <th className="text-right">Ordered</th>
              <th className="text-right">Received</th>
              <th className="text-right">Remaining</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {(po.lines ?? []).map((l) => {
              const remaining = l.orderedQty - l.receivedQty;
              const lineStatus =
                remaining <= 0
                  ? "received"
                  : l.receivedQty > 0
                    ? "partially_received"
                    : "pending";
              return (
                <tr key={l.id}>
                  <td className="font-mono text-xs">{l.sku}</td>
                  <td className="font-medium">{l.itemName}</td>
                  <td className="text-right font-mono">{formatNumber(l.orderedQty)}</td>
                  <td className="text-right font-mono">{formatNumber(l.receivedQty)}</td>
                  <td className="text-right font-mono">{formatNumber(remaining)}</td>
                  <td>
                    <StatusBadge kind="po" value={lineStatus} />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </CardContent>
    </Card>
  );
}

export function ReceivingPage() {
  const [view, setView] = useState<"po-list" | "po-detail" | "receipt">("po-list");
  const [createPoOpen, setCreatePoOpen] = useState(false);
  const [createReceiptOpen, setCreateReceiptOpen] = useState(false);
  const [selectedPoId, setSelectedPoId] = useState<string | null>(null);
  const [receivePoId, setReceivePoId] = useState<string | null>(null);
  const [staged, setStaged] = useState<StagedLine[]>([]);
  const batchPost = useBatchPostReceipts();

  const { data: pos, error: posError } = usePurchaseOrders({ pageSize: 100 });

  const selectedPo = useMemo(
    () => (pos?.items ?? []).find((p) => p.id === selectedPoId) ?? null,
    [pos, selectedPoId]
  );

  function openReceive(poId: string) {
    setReceivePoId(poId);
    setCreateReceiptOpen(true);
  }

  function handleAddLines(lines: StagedLine[]) {
    setStaged((prev) => [...prev, ...lines]);
  }

  function handleUpdateLine(id: string, patch: Partial<StagedLine>) {
    setStaged((prev) => prev.map((l) => (l.id === id ? { ...l, ...patch } : l)));
  }

  function handleRemoveLine(id: string) {
    setStaged((prev) => prev.filter((l) => l.id !== id));
  }

  async function handlePostAll() {
    if (staged.length === 0) return;
    const byPo = new Map<string, StagedLine[]>();
    for (const line of staged) {
      const list = byPo.get(line.purchaseOrderId) ?? [];
      list.push(line);
      byPo.set(line.purchaseOrderId, list);
    }
    try {
      const result = await batchPost.mutateAsync({
        receipts: Array.from(byPo.values()).map((lines) => ({
          warehouseId: lines[0]!.warehouseId,
          purchaseOrderId: lines[0]!.purchaseOrderId,
          lines: lines.map((l) => ({
            purchaseOrderLineId: l.purchaseOrderLineId,
            itemId: l.itemId,
            lotCode: l.lotCode || undefined,
            targetLocationId: l.targetLocationId,
            receivedQty: l.receivedQty,
            inspectionResult: l.inspectionResult,
            acceptedQty: l.acceptedQty,
            rejectedQty: l.receivedQty - l.acceptedQty,
            discrepancyCode:
              l.inspectionResult === "accepted"
                ? undefined
                : (l.discrepancyCode || undefined) as DiscrepancyCode | undefined
          }))
        }))
      });
      toast.success(
        `Posted ${result.movementCount} movement(s) across ${(result.receipts ?? []).length} receipt(s)`
      );
      setStaged([]);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to post receipts");
    }
  }

  return (
    <div>
      <PageHeader
        title="Inbound receiving"
        description="Raise purchase orders, receive, inspect and post inbound stock"
        actions={
          <>
            <Button variant="outline" onClick={() => setCreatePoOpen(true)}>
              <FilePlus data-icon="inline-start" />
              New PO
            </Button>
            <Button onClick={() => { setReceivePoId(null); setCreateReceiptOpen(true); }}>
              <PackagePlus data-icon="inline-start" />
              New receipt
            </Button>
          </>
        }
      />

      <Tabs
        value={view}
        onValueChange={(v) => setView(v as typeof view)}
        className="mb-6"
      >
        <TabsList variant="line" className="gap-1 border-b border-[#f0f0f0] pb-px">
          <TabsTrigger value="po-list">Purchase orders</TabsTrigger>
          <TabsTrigger
            value="po-detail"
            disabled={!selectedPoId}
            className="disabled:cursor-not-allowed"
          >
            PO detail
          </TabsTrigger>
          <TabsTrigger
            value="receipt"
            disabled={staged.length === 0}
            className="disabled:cursor-not-allowed"
          >
            Active receipt ({staged.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="po-list" className="mt-4">
          <Card>
            <CardContent className="p-0">
              {posError ? (
                <ErrorState
                  title="Failed to load purchase orders"
                  message={posError instanceof Error ? posError.message : undefined}
                />
              ) : (
              <table className="data-table">
                <thead>
                  <tr>
                    <th>PO</th>
                    <th>Supplier</th>
                    <th>Warehouse</th>
                    <th className="text-right">Lines</th>
                    <th>Status</th>
                    <th className="text-right">Created</th>
                    <th className="text-right">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {(pos?.items ?? []).map((po) => (
                    <tr
                      key={po.id}
                      className="cursor-pointer"
                      onClick={() => setSelectedPoId(po.id)}
                    >
                      <td className="font-mono text-xs">{po.poNumber}</td>
                      <td className="font-medium">{po.supplierName}</td>
                      <td className="font-mono text-xs">{po.warehouseCode}</td>
                      <td className="text-right font-mono">{po.lines?.length ?? 0}</td>
                      <td>
                        <StatusBadge kind="po" value={po.status} />
                      </td>
                      <td className="font-mono text-xs">
                        {new Date(po.createdAt).toLocaleDateString()}
                      </td>
                      <td className="text-right">
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={
                            po.status === "received" ||
                            po.status === "closed" ||
                            po.status === "cancelled"
                          }
                          onClick={(e) => {
                            e.stopPropagation();
                            openReceive(po.id);
                          }}
                        >
                          Receive
                        </Button>
                      </td>
                    </tr>
                  ))}
                  {(pos?.items ?? []).length === 0 && (
                    <tr>
                      <td
                        colSpan={7}
                        className="py-8 text-center text-sm text-muted-foreground"
                      >
                        No purchase orders found. Create one to start receiving.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="po-detail" className="mt-4">
          {selectedPo && (
            <PoDetail po={selectedPo} onReceive={openReceive} />
          )}
        </TabsContent>

        <TabsContent value="receipt" className="mt-4">
          <ActiveReceiptPanel
            staged={staged}
            onChange={handleUpdateLine}
            onRemove={handleRemoveLine}
            onPostAll={handlePostAll}
            posting={batchPost.isPending}
          />
        </TabsContent>
      </Tabs>

      <CreatePoDialog open={createPoOpen} onOpenChange={setCreatePoOpen} />
      <CreateReceiptDialog
        open={createReceiptOpen}
        onOpenChange={setCreateReceiptOpen}
        initialPoId={receivePoId}
        onAdd={handleAddLines}
      />
    </div>
  );
}
