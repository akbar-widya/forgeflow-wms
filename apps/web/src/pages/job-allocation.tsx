import { useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { toast } from "sonner";
import { ArrowLeft, Plus, RotateCcw, Workflow } from "lucide-react";
import {
  useCreateIssues,
  useCreateJob,
  useCreateScrapReturn,
  useItems,
  useJob,
  useJobs,
  usePreviewIssues,
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
import { formatNumber } from "@/lib/utils";

function CreateJobDialog({
  open,
  onOpenChange
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { data: warehouses } = useWarehouses({ pageSize: 100 });
  const { data: items } = useItems({ pageSize: 100 });
  const createJob = useCreateJob();
  const [warehouseId, setWarehouseId] = useState("");
  const [workOrderRef, setWorkOrderRef] = useState("");
  const [lines, setLines] = useState<
    { itemId: string; requiredQty: number }[]
  >([{ itemId: "", requiredQty: 0 }]);
  const [submitting, setSubmitting] = useState(false);

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
                <SelectTrigger>
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
                    {(items?.items ?? []).map((item) => (
                      <SelectItem key={item.id} value={item.id}>
                        {item.sku} · {item.name}
                      </SelectItem>
                    ))}
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
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleCreate} disabled={submitting}>
            {submitting ? "Creating..." : "Create job"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function JobDetail({ jobId }: { jobId: string }) {
  const { data: job } = useJob(jobId);
  const preview = usePreviewIssues();
  const createIssues = useCreateIssues();
  const scrapReturn = useCreateScrapReturn();
  const { data: whLocations } = useWarehouseLocations(job?.warehouseId);
  const locations = whLocations?.locations ?? [];

  const [issueQuantities, setIssueQuantities] = useState<Record<string, number>>({});
  const [scrapOpen, setScrapOpen] = useState(false);

  if (!job) return null;

  const canIssue = job.status === "planned" || job.status === "allocated" || job.status === "in_progress";

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => window.history.back()}>
            <ArrowLeft className="size-4" />
          </Button>
          <div>
            <CardTitle className="text-base">{job.jobNumber}</CardTitle>
            <div className="text-xs text-muted-foreground">
              {job.warehouseCode} · {job.workOrderRef ?? "no work order"}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <StatusBadge kind="job" value={job.status} />
          {canIssue && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => setScrapOpen(true)}
            >
              <RotateCcw data-icon="inline-start" />
              Scrap return
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
              <th className="text-right">Required</th>
              <th className="text-right">Issued</th>
              <th>Status</th>
              {canIssue && (
                <>
                  <th className="text-right">Issue qty</th>
                  <th className="text-right">Action</th>
                </>
              )}
            </tr>
          </thead>
          <tbody>
            {job.bomLines.map((line) => {
              const remaining = line.requiredQty - line.issuedQty;
              const alreadyDone = remaining <= 0;
              return (
                <tr key={line.id}>
                  <td className="font-mono text-xs">{line.sku}</td>
                  <td className="font-medium">{line.itemName}</td>
                  <td className="text-right font-mono">{formatNumber(line.requiredQty)}</td>
                  <td className="text-right font-mono">{formatNumber(line.issuedQty)}</td>
                  <td>
                    <StatusBadge
                      kind="stock"
                      value={alreadyDone ? "available" : line.issuedQty > 0 ? "low" : "out_of_stock"}
                    />
                  </td>
                  {canIssue && (
                    <>
                      <td className="text-right">
                        <Input
                          type="number"
                          min={1}
                          max={remaining}
                          disabled={alreadyDone}
                          className="ml-auto h-7 w-24 text-right text-xs"
                          value={issueQuantities[line.id] ?? ""}
                          onChange={(e) =>
                            setIssueQuantities((q) => ({
                              ...q,
                              [line.id]: Number(e.target.value)
                            }))
                          }
                        />
                      </td>
                      <td className="text-right">
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={alreadyDone || !(issueQuantities[line.id] ?? 0)}
                          onClick={async () => {
                            try {
                              const result = await preview.mutateAsync(jobId);
                              const previewLine = result.lines.find(
                                (l) => l.bomLineId === line.id
                              );
                              const qty = issueQuantities[line.id] ?? 0;
                              if (previewLine?.short) {
                                toast.warning(
                                  `Only ${previewLine.availableQty} available for ${line.sku}`
                                );
                              }
                              await createIssues.mutateAsync({
                                jobId,
                                body: {
                                  lines: [
                                    {
                                      bomLineId: line.id,
                                      issueQty: qty,
                                      sourceLocationId:
                                        previewLine?.locationId ?? locations[0]?.id ?? ""
                                    }
                                  ]
                                }
                              });
                              toast.success(`Issued ${formatNumber(qty)} × ${line.sku}`);
                            } catch (err) {
                              toast.error(
                                err instanceof Error ? err.message : "Issue failed"
                              );
                            }
                          }}
                        >
                          Issue
                        </Button>
                      </td>
                    </>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </CardContent>

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
    </Card>
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
  const [createOpen, setCreateOpen] = useState(false);
  const { jobId } = useParams();
  const navigate = useNavigate();
  const { data: jobs } = useJobs({ pageSize: 100 });
  const [statusFilter, setStatusFilter] = useState("all");

  const filtered = useMemo(() => {
    if (statusFilter === "all") return jobs?.items ?? [];
    return (jobs?.items ?? []).filter((j) => j.status === statusFilter);
  }, [jobs, statusFilter]);

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
                  onClick={() => navigate(`/jobs/${job.id}`)}
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
                        navigate(`/jobs/${job.id}`);
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

      {jobId && (
        <div className="mt-6">
          <JobDetail jobId={jobId} />
        </div>
      )}

      <CreateJobDialog open={createOpen} onOpenChange={setCreateOpen} />
    </div>
  );
}
