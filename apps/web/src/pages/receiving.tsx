import { useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import { toast } from "sonner";
import { FilePlus, PackagePlus, Plus } from "lucide-react";
import { Controller, useFieldArray, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  useCreatePurchaseOrder,
  useCreateReceipt,
  useInspectReceiptLine,
  useItems,
  usePostReceipt,
  usePurchaseOrders,
  useReceipt,
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
import { formatDate, formatNumber } from "@/lib/utils";
import type { PurchaseOrder } from "@forgeflow/contracts";

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
  initialPoId
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialPoId?: string | null;
}) {
  const { data: pos } = usePurchaseOrders({ status: "open", pageSize: 100 });
  const openPos = pos?.items ?? [];
  const [selectedPoId, setSelectedPoId] = useState<string | null>(null);
  const selectedPo = useMemo(
    () => openPos.find((p) => p.id === selectedPoId),
    [openPos, selectedPoId]
  );
  const warehouseId = selectedPo?.warehouseId;
  const { data: whLocations } = useWarehouseLocations(warehouseId);
  const locations = whLocations?.locations ?? [];

  const [drafts, setDrafts] = useState<Record<string, ReceiptLineDraft>>({});
  const createReceipt = useCreateReceipt();
  const [submitting, setSubmitting] = useState(false);
  const preselected = useRef(false);

  function handleSelectPo(poId: string) {
    setSelectedPoId(poId);
    const po = openPos.find((p) => p.id === poId);
    if (po) {
      const next: Record<string, ReceiptLineDraft> = {};
      for (const line of po.lines) {
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

  async function handleCreate() {
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
    setSubmitting(true);
    try {
      const receipt = await createReceipt.mutateAsync({
        warehouseId: selectedPo.warehouseId,
        purchaseOrderId: selectedPo.id,
        lines: lines.map((l) => ({
          purchaseOrderLineId: l.purchaseOrderLineId,
          itemId: l.itemId,
          lotCode: l.lotCode || undefined,
          targetLocationId: l.targetLocationId,
          receivedQty: l.receivedQty
        }))
      });
      toast.success(`Receipt ${receipt.receiptNumber} created`);
      onOpenChange(false);
      reset();
      window.dispatchEvent(
        new CustomEvent("receipt:created", { detail: receipt.id })
      );
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to create receipt");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { onOpenChange(o); if (!o) reset(); }}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Create receipt</DialogTitle>
          <DialogDescription>
            Register inbound stock against an open purchase order.
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
                    No open POs — create one first
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
            Cancel
          </Button>
          <Button onClick={handleCreate} disabled={submitting || !selectedPo}>
            <PackagePlus data-icon="inline-start" />
            {submitting ? "Creating..." : "Create receipt"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ReceiptDetail({ receiptId }: { receiptId: string }) {
  const { data: receipt } = useReceipt(receiptId);
  const postReceipt = usePostReceipt();

  if (!receipt) return null;

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between">
        <div className="flex items-center gap-3">
          <div>
            <CardTitle className="text-base">{receipt.receiptNumber}</CardTitle>
            <div className="text-xs text-muted-foreground">
              PO {receipt.poNumber ?? "—"} · {receipt.warehouseCode || receipt.warehouseId}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <StatusBadge kind="receipt" value={receipt.status} />
          {receipt.status === "inspecting" && (
            <Button
              size="sm"
              onClick={async () => {
                try {
                  await postReceipt.mutateAsync(receiptId);
                  toast.success("Receipt posted — stock updated");
                } catch (err) {
                  toast.error(
                    err instanceof Error ? err.message : "Failed to post receipt"
                  );
                }
              }}
              disabled={postReceipt.isPending}
            >
              Post receipt
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
              <th>Lot</th>
              <th className="text-right">Received</th>
              <th className="text-right">Accepted</th>
              <th className="text-right">Rejected</th>
              <th>Target</th>
              <th>Inspection</th>
              <th className="text-right">Action</th>
            </tr>
          </thead>
          <tbody>
            {receipt.lines.map((line) => (
              <ReceiptLineRow key={line.id} receiptId={receiptId} line={line} />
            ))}
          </tbody>
        </table>
      </CardContent>
    </Card>
  );
}

function ReceiptLineRow({
  receiptId,
  line
}: {
  receiptId: string;
  line: {
    id: string;
    sku: string;
    itemName: string;
    lotCode: string | null;
    receivedQty: number;
    acceptedQty: number;
    rejectedQty: number;
    inspectionResult: string | null;
    targetLocationCode: string | null;
  };
}) {
  const inspect = useInspectReceiptLine();
  const [result, setResult] = useState<"accepted" | "rejected" | "quarantined">("accepted");
  const [acceptedQty, setAcceptedQty] = useState<number>(line.receivedQty);
  const [discrepancyCode, setDiscrepancyCode] = useState("damaged");
  const [busy, setBusy] = useState(false);

  const inspected = line.inspectionResult !== null && line.inspectionResult !== "pending";
  const needsDiscrepancy = result !== "accepted";

  async function record() {
    setBusy(true);
    try {
      const rejectedQty =
        result === "quarantined"
          ? line.receivedQty
          : line.receivedQty - acceptedQty;
      await inspect.mutateAsync({
        receiptId,
        lineId: line.id,
        body: {
          result,
          acceptedQty: result === "accepted" || result === "rejected" ? acceptedQty : 0,
          rejectedQty,
          discrepancyCode: needsDiscrepancy ? discrepancyCode : undefined
        }
      });
      toast.success("Inspection recorded");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Inspection failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <tr>
      <td className="font-mono text-xs">{line.sku}</td>
      <td className="font-medium">{line.itemName}</td>
      <td className="font-mono text-xs">{line.lotCode || "—"}</td>
      <td className="text-right font-mono">{formatNumber(line.receivedQty)}</td>
      <td className="text-right font-mono">{formatNumber(line.acceptedQty)}</td>
      <td className="text-right font-mono">{formatNumber(line.rejectedQty)}</td>
      <td className="font-mono text-xs">{line.targetLocationCode || "—"}</td>
      <td>
        {inspected ? (
          <StatusBadge kind="inspection" value={line.inspectionResult ?? "pending"} />
        ) : (
          <StatusBadge kind="inspection" value="pending" />
        )}
      </td>
      <td className="text-right">
        {!inspected ? (
          <div className="flex flex-col items-end gap-2">
            <div className="flex items-center justify-end gap-2">
              <Select value={result} onValueChange={(v) => setResult(v as typeof result)}>
                <SelectTrigger className="h-7 w-[120px] text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="accepted">Accept</SelectItem>
                  <SelectItem value="rejected">Reject</SelectItem>
                  <SelectItem value="quarantined">Quarantine</SelectItem>
                </SelectContent>
              </Select>
              <Input
                type="number"
                min={0}
                max={line.receivedQty}
                className="h-7 w-20 text-xs"
                value={acceptedQty}
                onChange={(e) => setAcceptedQty(Number(e.target.value))}
              />
            </div>
            <div className="flex items-center justify-end gap-2">
              {needsDiscrepancy && (
                <Select value={discrepancyCode} onValueChange={setDiscrepancyCode}>
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
              )}
              <Button size="xs" variant="outline" disabled={busy} onClick={record}>
                Record
              </Button>
            </div>
          </div>
        ) : (
          <span className="text-xs text-muted-foreground">—</span>
        )}
      </td>
    </tr>
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
            {po.lines.map((l) => {
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
  const [activeReceiptId, setActiveReceiptId] = useState<string | null>(null);
  const { receiptId } = useParams();

  const { data: pos } = usePurchaseOrders({ pageSize: 100 });

  useEffect(() => {
    const handler = ((e: CustomEvent) =>
      setActiveReceiptId(e.detail)) as EventListener;
    window.addEventListener("receipt:created", handler);
    return () => window.removeEventListener("receipt:created", handler);
  }, []);

  const effectiveReceiptId = receiptId ?? activeReceiptId;
  const selectedPo = useMemo(
    () => pos?.items.find((p) => p.id === selectedPoId) ?? null,
    [pos, selectedPoId]
  );

  function openReceive(poId: string) {
    setReceivePoId(poId);
    setCreateReceiptOpen(true);
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
        <TabsList>
          <TabsTrigger value="po-list">Purchase orders</TabsTrigger>
          <TabsTrigger value="po-detail" disabled={!selectedPoId}>
            PO detail
          </TabsTrigger>
          <TabsTrigger value="receipt" disabled={!effectiveReceiptId}>
            Active receipt
          </TabsTrigger>
        </TabsList>

        <TabsContent value="po-list" className="mt-4">
          <Card>
            <CardContent className="p-0">
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
                      <td className="text-right font-mono">{po.lines.length}</td>
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
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="po-detail" className="mt-4">
          {selectedPo && (
            <PoDetail po={selectedPo} onReceive={openReceive} />
          )}
        </TabsContent>

        <TabsContent value="receipt" className="mt-4">
          {effectiveReceiptId && <ReceiptDetail receiptId={effectiveReceiptId} />}
        </TabsContent>
      </Tabs>

      <CreatePoDialog open={createPoOpen} onOpenChange={setCreatePoOpen} />
      <CreateReceiptDialog
        open={createReceiptOpen}
        onOpenChange={setCreateReceiptOpen}
        initialPoId={receivePoId}
      />
    </div>
  );
}
