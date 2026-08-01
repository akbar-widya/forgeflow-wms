import { useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { toast } from "sonner";
import { ArrowLeft, PackagePlus } from "lucide-react";
import {
  useCreateReceipt,
  useInspectReceiptLine,
  usePostReceipt,
  usePurchaseOrders,
  useReceipt,
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
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { StatusBadge } from "@/components/status-badge";
import { formatNumber } from "@/lib/utils";

type ReceiptLineDraft = {
  purchaseOrderLineId: string;
  itemId: string;
  sku: string;
  itemName: string;
  receivedQty: number;
  lotCode: string;
  targetLocationId: string;
};

function CreateReceiptDialog({
  open,
  onOpenChange
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { data: pos } = usePurchaseOrders({ status: "open", pageSize: 100 });
  const [selectedPoId, setSelectedPoId] = useState<string | null>(null);
  const selectedPo = useMemo(
    () => pos?.items.find((p) => p.id === selectedPoId),
    [pos, selectedPoId]
  );
  const warehouseId = selectedPo?.warehouseId;
  const { data: whLocations } = useWarehouseLocations(warehouseId);
  const locations = whLocations?.locations ?? [];

  const [drafts, setDrafts] = useState<Record<string, ReceiptLineDraft>>({});
  const createReceipt = useCreateReceipt();
  const [submitting, setSubmitting] = useState(false);

  function handleSelectPo(poId: string) {
    setSelectedPoId(poId);
    const po = pos?.items.find((p) => p.id === poId);
    if (po) {
      const next: Record<string, ReceiptLineDraft> = {};
      for (const line of po.lines) {
        next[line.id] = {
          purchaseOrderLineId: line.id,
          itemId: line.itemId,
          sku: line.sku,
          itemName: line.itemName,
          receivedQty: line.orderedQty - line.receivedQty,
          lotCode: "",
          targetLocationId: ""
        };
      }
      setDrafts(next);
    }
  }

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
      window.dispatchEvent(new CustomEvent("receipt:created", { detail: receipt.id }));
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
              <SelectTrigger>
                <SelectValue placeholder="Select an open PO" />
              </SelectTrigger>
              <SelectContent>
                {(pos?.items ?? []).map((po) => (
                  <SelectItem key={po.id} value={po.id}>
                    {po.poNumber} · {po.supplierName}
                  </SelectItem>
                ))}
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
                          <SelectTrigger>
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
  const inspect = useInspectReceiptLine();
  const postReceipt = usePostReceipt();

  if (!receipt) return null;

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => window.history.back()}>
            <ArrowLeft className="size-4" />
          </Button>
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
              <ReceiptLineRow
                key={line.id}
                receiptId={receiptId}
                line={line}
                inspect={inspect}
              />
            ))}
          </tbody>
        </table>
      </CardContent>
    </Card>
  );
}

function ReceiptLineRow({
  receiptId,
  line,
  inspect
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
    targetLocationCode: string | null;
  };
  inspect: ReturnType<typeof useInspectReceiptLine>;
}) {
  const [result, setResult] = useState<"accepted" | "rejected" | "quarantined">("accepted");
  const [acceptedQty, setAcceptedQty] = useState<number>(line.receivedQty);
  const [busy, setBusy] = useState(false);

  const isPending = line.acceptedQty === 0 && line.rejectedQty === 0;

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
        {isPending ? (
          <StatusBadge kind="inspection" value="pending" />
        ) : (
          <StatusBadge kind="inspection" value={result} />
        )}
      </td>
      <td className="text-right">
        {isPending ? (
          <div className="flex items-center justify-end gap-2">
            <Select value={result} onValueChange={(v) => setResult(v as typeof result)}>
              <SelectTrigger className="h-7 w-[130px] text-xs">
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
            <Button
              size="xs"
              variant="outline"
              disabled={busy}
              onClick={async () => {
                setBusy(true);
                try {
                  await inspect.mutateAsync({
                    receiptId,
                    lineId: line.id,
                    body: {
                      result,
                      acceptedQty: result === "accepted" ? acceptedQty : 0,
                      rejectedQty:
                        result === "rejected" ? line.receivedQty - acceptedQty : 0
                    }
                  });
                  toast.success("Inspection recorded");
                } catch (err) {
                  toast.error(err instanceof Error ? err.message : "Inspection failed");
                } finally {
                  setBusy(false);
                }
              }}
            >
              Record
            </Button>
          </div>
        ) : (
          <span className="text-xs text-muted-foreground">—</span>
        )}
      </td>
    </tr>
  );
}

export function ReceivingPage() {
  const [createOpen, setCreateOpen] = useState(false);
  const [activeReceiptId, setActiveReceiptId] = useState<string | null>(null);
  const { receiptId } = useParams();
  const navigate = useNavigate();

  const { data: pos } = usePurchaseOrders({ pageSize: 100 });

  window.addEventListener("receipt:created", ((e: CustomEvent) => {
    setActiveReceiptId(e.detail);
  }) as EventListener);

  const effectiveReceiptId = receiptId ?? activeReceiptId;

  return (
    <div>
      <PageHeader
        title="Inbound receiving"
        description="Receive, inspect and post inbound purchase orders"
        actions={
          <Button onClick={() => setCreateOpen(true)}>
            <PackagePlus data-icon="inline-start" />
            New receipt
          </Button>
        }
      />

      <Tabs value="po-list" className="mb-6">
        <TabsList>
          <TabsTrigger value="po-list">Purchase orders</TabsTrigger>
          <TabsTrigger value="receipt" disabled={!effectiveReceiptId}>
            Active receipt
          </TabsTrigger>
        </TabsList>
      </Tabs>

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
                <tr key={po.id} className="cursor-pointer" onClick={() => navigate(`/purchase-orders/${po.id}`)}>
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
                      disabled={po.status === "received" || po.status === "closed" || po.status === "cancelled"}
                      onClick={(e) => {
                        e.stopPropagation();
                        setCreateOpen(true);
                      }}
                    >
                      Receive
                    </Button>
                  </td>
                </tr>
              ))}
              {(pos?.items ?? []).length === 0 && (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-sm text-muted-foreground">
                    No purchase orders found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </CardContent>
      </Card>

      {effectiveReceiptId && (
        <div className="mt-6">
          <ReceiptDetail receiptId={effectiveReceiptId} />
        </div>
      )}

      <CreateReceiptDialog open={createOpen} onOpenChange={setCreateOpen} />
    </div>
  );
}
