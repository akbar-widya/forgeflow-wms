import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  apiGet,
  apiPatch,
  apiPost,
  genIdempotencyKey,
  type QueryParams
} from "@/lib/api-client";
import type {
  CapacityResponse,
  CreateIssuesRequest,
  CreateJobRequest,
  CreateReceiptRequest,
  InventorySummaryResponse,
  IssuePreviewResponse,
  Item,
  ItemListResponse,
  Job,
  JobListResponse,
  Kpi,
  MovementListResponse,
  Notification,
  NotificationListResponse,
  PurchaseOrder,
  Receipt,
  ScrapReturnRequest,
  StockBalanceListResponse,
  Warehouse,
  WarehouseListResponse,
  WarehouseLocationsResponse
} from "@forgeflow/contracts";

export function useMe() {
  return useQuery({
    queryKey: ["me"],
    queryFn: () => apiGet<{ user: { id: string; email: string; name: string; role: string; staffProfile: unknown } }>("/api/me"),
    retry: false,
    staleTime: 60_000
  });
}

export function useKpis() {
  return useQuery({
    queryKey: ["dashboard", "kpis"],
    queryFn: () => apiGet<Kpi>("/api/dashboard/kpis")
  });
}

export function useCapacity() {
  return useQuery({
    queryKey: ["dashboard", "capacity"],
    queryFn: () => apiGet<CapacityResponse>("/api/dashboard/capacity")
  });
}

export function useInventorySummary() {
  return useQuery({
    queryKey: ["dashboard", "inventory-summary"],
    queryFn: () => apiGet<InventorySummaryResponse>("/api/dashboard/inventory-summary")
  });
}

export function useWarehouses(params?: QueryParams) {
  return useQuery({
    queryKey: ["warehouses", params],
    queryFn: () => apiGet<WarehouseListResponse>("/api/warehouses", params)
  });
}

export function useWarehouse(id: string | undefined) {
  return useQuery({
    queryKey: ["warehouses", id],
    queryFn: () => apiGet<Warehouse>("/api/warehouses", { id }),
    enabled: Boolean(id)
  });
}

export function useWarehouseLocations(warehouseId: string | undefined) {
  return useQuery({
    queryKey: ["warehouses", warehouseId, "locations"],
    queryFn: () =>
      apiGet<WarehouseLocationsResponse>(`/api/warehouses/${warehouseId}/locations`),
    enabled: Boolean(warehouseId)
  });
}

export function useItems(params?: QueryParams) {
  return useQuery({
    queryKey: ["items", params],
    queryFn: () => apiGet<ItemListResponse>("/api/inventory/items", params)
  });
}

export function useItem(id: string | undefined) {
  return useQuery({
    queryKey: ["items", id],
    queryFn: () => apiGet<Item>(`/api/inventory/items/${id}`),
    enabled: Boolean(id)
  });
}

export function useStockBalances(params?: QueryParams) {
  return useQuery({
    queryKey: ["stock-balances", params],
    queryFn: () => apiGet<StockBalanceListResponse>("/api/inventory/balances", params)
  });
}

export function usePurchaseOrders(params?: QueryParams) {
  return useQuery({
    queryKey: ["purchase-orders", params],
    queryFn: () => apiGet<{ items: PurchaseOrder[]; meta: unknown }>("/api/purchase-orders", params)
  });
}

export function usePurchaseOrder(id: string | undefined) {
  return useQuery({
    queryKey: ["purchase-orders", id],
    queryFn: () => apiGet<PurchaseOrder>(`/api/purchase-orders/${id}`),
    enabled: Boolean(id)
  });
}

export function useJobs(params?: QueryParams) {
  return useQuery({
    queryKey: ["jobs", params],
    queryFn: () => apiGet<JobListResponse>("/api/jobs", params)
  });
}

export function useJob(id: string | undefined) {
  return useQuery({
    queryKey: ["jobs", id],
    queryFn: () => apiGet<Job>(`/api/jobs/${id}`),
    enabled: Boolean(id)
  });
}

export function useMovements(params?: QueryParams) {
  return useQuery({
    queryKey: ["movements", params],
    queryFn: () => apiGet<MovementListResponse>("/api/movements", params)
  });
}

export function useNotifications(params?: QueryParams) {
  return useQuery({
    queryKey: ["notifications", params],
    queryFn: () => apiGet<NotificationListResponse>("/api/notifications", params)
  });
}

export function useReceipt(id: string | undefined) {
  return useQuery({
    queryKey: ["receipts", id],
    queryFn: () => apiGet<Receipt>(`/api/receipts/${id}`),
    enabled: Boolean(id)
  });
}

export function useCreateReceipt() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: CreateReceiptRequest) =>
      apiPost<Receipt>("/api/receipts", body, genIdempotencyKey()),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["purchase-orders"] });
    }
  });
}

export function useInspectReceiptLine() {
  return useMutation({
    mutationFn: ({
      receiptId,
      lineId,
      body
    }: {
      receiptId: string;
      lineId: string;
      body: {
        result: string;
        discrepancyCode?: string;
        notes?: string;
        acceptedQty?: number;
        rejectedQty?: number;
      };
    }) =>
      apiPost(`/api/receipts/${receiptId}/lines/${lineId}/inspect`, body)
  });
}

export function usePostReceipt() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (receiptId: string) =>
      apiPost(`/api/receipts/${receiptId}/post`, undefined, genIdempotencyKey()),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["receipts"] });
      qc.invalidateQueries({ queryKey: ["purchase-orders"] });
      qc.invalidateQueries({ queryKey: ["stock-balances"] });
      qc.invalidateQueries({ queryKey: ["movements"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
    }
  });
}

export function useCreateJob() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: CreateJobRequest) => apiPost<Job>("/api/jobs", body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["jobs"] })
  });
}

export function usePreviewIssues() {
  return useMutation({
    mutationFn: (jobId: string) => apiPost<IssuePreviewResponse>(`/api/jobs/${jobId}/issues/preview`)
  });
}

export function useCreateIssues() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ jobId, body }: { jobId: string; body: CreateIssuesRequest }) =>
      apiPost(`/api/jobs/${jobId}/issues`, body, genIdempotencyKey()),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["jobs"] });
      qc.invalidateQueries({ queryKey: ["stock-balances"] });
      qc.invalidateQueries({ queryKey: ["movements"] });
    }
  });
}

export function useCreateScrapReturn() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ jobId, body }: { jobId: string; body: ScrapReturnRequest }) =>
      apiPost(`/api/jobs/${jobId}/scrap-returns`, body, genIdempotencyKey()),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["jobs"] });
      qc.invalidateQueries({ queryKey: ["stock-balances"] });
      qc.invalidateQueries({ queryKey: ["movements"] });
    }
  });
}

export function useCreateItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: Record<string, unknown>) => apiPost<Item>("/api/inventory/items", body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["items"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
    }
  });
}

export function useMarkNotificationRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiPatch(`/api/notifications/${id}/read`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["notifications"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
    }
  });
}

export function useMarkAllNotificationsRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => apiPatch("/api/notifications/read-all"),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["notifications"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
    }
  });
}

export type { Notification };
