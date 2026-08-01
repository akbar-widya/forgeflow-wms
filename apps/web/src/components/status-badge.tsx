import { Badge } from "@/components/ui/badge";

type StatusMap = Record<string, "default" | "secondary" | "success" | "warning" | "danger" | "info" | "outline" | "ghost" | "link">;

const MOVEMENT_MAP: StatusMap = {
  receive: "success",
  transfer: "info",
  issue: "warning",
  adjust: "secondary",
  scrap_return: "danger",
  correction: "secondary"
};

const PO_MAP: StatusMap = {
  draft: "secondary",
  open: "info",
  partially_received: "warning",
  received: "success",
  closed: "secondary",
  cancelled: "danger"
};

const JOB_MAP: StatusMap = {
  planned: "secondary",
  allocated: "info",
  in_progress: "warning",
  completed: "success",
  cancelled: "danger"
};

const STOCK_MAP: StatusMap = {
  available: "success",
  low: "warning",
  out_of_stock: "danger",
  quarantined: "danger",
  reserved: "info"
};

const INSPECTION_MAP: StatusMap = {
  pending: "secondary",
  accepted: "success",
  rejected: "danger",
  quarantined: "warning"
};

const RECEIPT_MAP: StatusMap = {
  draft: "secondary",
  inspecting: "warning",
  posted: "success"
};

const SEVERITY_MAP: StatusMap = {
  info: "info",
  warning: "warning",
  critical: "danger"
};

const LABELS: Record<string, string> = {
  receive: "Received",
  transfer: "Transfer",
  issue: "Issued",
  adjust: "Adjusted",
  scrap_return: "Scrap return",
  correction: "Correction",
  draft: "Draft",
  open: "Open",
  partially_received: "Partial",
  received: "Received",
  closed: "Closed",
  cancelled: "Cancelled",
  planned: "Planned",
  allocated: "Allocated",
  in_progress: "In progress",
  completed: "Completed",
  available: "Available",
  low: "Low stock",
  out_of_stock: "Out of stock",
  quarantined: "Quarantined",
  reserved: "Reserved",
  pending: "Pending",
  accepted: "Accepted",
  rejected: "Rejected",
  inspecting: "Inspecting",
  posted: "Posted",
  info: "Info",
  warning: "Warning",
  critical: "Critical"
};

function pickMap(kind: string): StatusMap {
  switch (kind) {
    case "movement":
      return MOVEMENT_MAP;
    case "po":
      return PO_MAP;
    case "job":
      return JOB_MAP;
    case "stock":
      return STOCK_MAP;
    case "inspection":
      return INSPECTION_MAP;
    case "receipt":
      return RECEIPT_MAP;
    case "severity":
      return SEVERITY_MAP;
    default:
      return {};
  }
}

export function StatusBadge({
  kind,
  value
}: {
  kind: "movement" | "po" | "job" | "stock" | "inspection" | "receipt" | "severity";
  value: string;
}) {
  const map = pickMap(kind);
  return (
    <Badge variant={map[value] ?? "secondary"} className="uppercase tracking-wide">
      {LABELS[value] ?? value}
    </Badge>
  );
}
