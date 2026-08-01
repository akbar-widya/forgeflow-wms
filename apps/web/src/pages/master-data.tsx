import { useEffect, useMemo } from "react";
import { toast } from "sonner";
import { Boxes, Layers, MapPin, Warehouse as WarehouseIcon } from "lucide-react";
import { useForm, Controller, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  useCreateItem,
  useCreateLocation,
  useCreateWarehouse,
  useCreateZone,
  useItems,
  useLocations,
  useWarehouseLocations,
  useWarehouses
} from "@/lib/hooks";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "@/components/ui/select";
import { formatDate, formatNumber } from "@/lib/utils";

const warehouseSchema = z.object({
  code: z
    .string()
    .trim()
    .min(1, "Code is required")
    .max(20, "Max 20 characters"),
  name: z
    .string()
    .trim()
    .min(1, "Name is required")
    .max(120, "Max 120 characters"),
  status: z.enum(["active", "inactive"]).default("active")
});

type WarehouseFormValues = z.infer<typeof warehouseSchema>;

const itemSchema = z.object({
  sku: z
    .string()
    .trim()
    .min(1, "SKU is required")
    .max(40, "Max 40 characters"),
  name: z
    .string()
    .trim()
    .min(1, "Name is required")
    .max(120, "Max 120 characters"),
  uom: z
    .string()
    .trim()
    .min(1, "UoM is required")
    .max(10, "Max 10 characters"),
  category: z
    .string()
    .trim()
    .max(60, "Max 60 characters")
    .optional()
    .or(z.literal("")),
  reorderPoint: z
    .string()
    .trim()
    .refine(
      (v) => v === "" || (Number.isFinite(Number(v)) && Number(v) >= 0),
      { message: "Must be a non-negative number" }
    ),
  lotTracked: z.boolean().default(false),
  expiryTracked: z.boolean().default(false),
  status: z.enum(["active", "inactive", "discontinued"]).default("active")
});

type ItemFormValues = z.infer<typeof itemSchema>;

const zoneFormSchema = z.object({
  warehouseId: z.string().min(1, "Warehouse is required"),
  code: z
    .string()
    .trim()
    .min(1, "Code is required")
    .max(20, "Max 20 characters"),
  name: z
    .string()
    .trim()
    .min(1, "Name is required")
    .max(120, "Max 120 characters"),
  type: z
    .enum(["receiving", "storage", "staging", "shipping", "quarantine"])
    .default("storage"),
  status: z.enum(["active", "inactive"]).default("active")
});

type ZoneFormValues = z.infer<typeof zoneFormSchema>;

const locationFormSchema = z.object({
  warehouseId: z.string().min(1, "Warehouse is required"),
  zoneId: z.string().min(1, "Zone is required"),
  code: z
    .string()
    .trim()
    .min(1, "Code is required")
    .max(40, "Max 40 characters"),
  locationType: z
    .enum(["rack", "bin", "floor", "dock", "staging", "quarantine"])
    .default("rack"),
  capacityQty: z
    .string()
    .trim()
    .refine(
      (v) => v === "" || (Number.isFinite(Number(v)) && Number(v) >= 0),
      { message: "Must be a non-negative number" }
    ),
  status: z.enum(["active", "inactive", "blocked"]).default("active")
});

type LocationFormValues = z.infer<typeof locationFormSchema>;

function statusBadge(
  status: "active" | "inactive" | "discontinued" | "blocked"
) {
  const variant =
    status === "active" ? "success" : status === "inactive" ? "secondary" : "danger";
  return (
    <Badge variant={variant} className="uppercase tracking-wide">
      {status}
    </Badge>
  );
}

function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return <p className="text-xs text-danger">{message}</p>;
}

function WarehouseForm() {
  const createWarehouse = useCreateWarehouse();
  const {
    register,
    handleSubmit,
    control,
    reset,
    formState: { errors, isSubmitting }
  } = useForm<WarehouseFormValues>({
    resolver: zodResolver(warehouseSchema),
    defaultValues: { code: "", name: "", status: "active" }
  });

  async function onSubmit(values: WarehouseFormValues) {
    try {
      const created = await createWarehouse.mutateAsync(values);
      toast.success(`Warehouse ${created.code} created`);
      reset();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to create warehouse");
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="wh-code">Code</Label>
          <Input
            id="wh-code"
            placeholder="WH-01"
            className="font-mono"
            aria-invalid={Boolean(errors.code)}
            {...register("code")}
          />
          <FieldError message={errors.code?.message} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="wh-status">Status</Label>
          <Controller
            control={control}
            name="status"
            render={({ field }) => (
              <Select value={field.value} onValueChange={field.onChange}>
                <SelectTrigger id="wh-status" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="inactive">Inactive</SelectItem>
                </SelectContent>
              </Select>
            )}
          />
        </div>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="wh-name">Name</Label>
        <Input
          id="wh-name"
          placeholder="Central Distribution Center"
          aria-invalid={Boolean(errors.name)}
          {...register("name")}
        />
        <FieldError message={errors.name?.message} />
      </div>
      <div className="flex justify-end">
        <Button type="submit" disabled={isSubmitting}>
          <WarehouseIcon data-icon="inline-start" />
          {isSubmitting ? "Creating..." : "Create warehouse"}
        </Button>
      </div>
    </form>
  );
}

function ItemForm() {
  const createItem = useCreateItem();
  const {
    register,
    handleSubmit,
    control,
    reset,
    formState: { errors, isSubmitting }
  } = useForm<ItemFormValues>({
    resolver: zodResolver(itemSchema),
    defaultValues: {
      sku: "",
      name: "",
      uom: "",
      category: "",
      reorderPoint: "",
      lotTracked: false,
      expiryTracked: false,
      status: "active"
    }
  });

  async function onSubmit(values: ItemFormValues) {
    try {
      const created = await createItem.mutateAsync({
        sku: values.sku,
        name: values.name,
        uom: values.uom,
        category: values.category || undefined,
        reorderPoint:
          values.reorderPoint === "" || values.reorderPoint === undefined
            ? undefined
            : Number(values.reorderPoint),
        lotTracked: values.lotTracked,
        expiryTracked: values.expiryTracked,
        status: values.status
      });
      toast.success(`Item ${created.sku} created`);
      reset();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to create item");
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="space-y-1.5">
          <Label htmlFor="item-sku">SKU</Label>
          <Input
            id="item-sku"
            placeholder="RM-0001"
            className="font-mono"
            aria-invalid={Boolean(errors.sku)}
            {...register("sku")}
          />
          <FieldError message={errors.sku?.message} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="item-uom">UoM</Label>
          <Input
            id="item-uom"
            placeholder="PCS"
            className="font-mono uppercase"
            aria-invalid={Boolean(errors.uom)}
            {...register("uom")}
          />
          <FieldError message={errors.uom?.message} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="item-status">Status</Label>
          <Controller
            control={control}
            name="status"
            render={({ field }) => (
              <Select value={field.value} onValueChange={field.onChange}>
                <SelectTrigger id="item-status" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="inactive">Inactive</SelectItem>
                  <SelectItem value="discontinued">Discontinued</SelectItem>
                </SelectContent>
              </Select>
            )}
          />
        </div>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="item-name">Name</Label>
        <Input
          id="item-name"
          placeholder="Steel Bracket 4in"
          aria-invalid={Boolean(errors.name)}
          {...register("name")}
        />
        <FieldError message={errors.name?.message} />
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="item-category">Category</Label>
          <Input
            id="item-category"
            placeholder="Raw material"
            aria-invalid={Boolean(errors.category)}
            {...register("category")}
          />
          <FieldError message={errors.category?.message} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="item-reorder">Reorder point</Label>
          <Input
            id="item-reorder"
            type="number"
            min={0}
            step="any"
            placeholder="Optional"
            className="font-mono"
            aria-invalid={Boolean(errors.reorderPoint)}
            {...register("reorderPoint")}
          />
          <FieldError message={errors.reorderPoint?.message} />
        </div>
      </div>
      <div className="flex items-center gap-6">
        <div className="flex items-center gap-2">
          <Controller
            control={control}
            name="lotTracked"
            render={({ field }) => (
              <Checkbox
                id="item-lot"
                checked={field.value}
                onCheckedChange={field.onChange}
              />
            )}
          />
          <Label htmlFor="item-lot" className="text-sm font-normal">
            Lot tracked
          </Label>
        </div>
        <div className="flex items-center gap-2">
          <Controller
            control={control}
            name="expiryTracked"
            render={({ field }) => (
              <Checkbox
                id="item-expiry"
                checked={field.value}
                onCheckedChange={field.onChange}
              />
            )}
          />
          <Label htmlFor="item-expiry" className="text-sm font-normal">
            Expiry tracked
          </Label>
        </div>
      </div>
      <div className="flex justify-end">
        <Button type="submit" disabled={isSubmitting}>
          <Boxes data-icon="inline-start" />
          {isSubmitting ? "Creating..." : "Create item"}
        </Button>
      </div>
    </form>
  );
}

function ZoneForm() {
  const createZone = useCreateZone();
  const { data: warehouses } = useWarehouses({ pageSize: 100 });
  const {
    register,
    handleSubmit,
    control,
    reset,
    formState: { errors, isSubmitting }
  } = useForm<ZoneFormValues>({
    resolver: zodResolver(zoneFormSchema),
    defaultValues: {
      warehouseId: "",
      code: "",
      name: "",
      type: "storage",
      status: "active"
    }
  });

  async function onSubmit(values: ZoneFormValues) {
    try {
      await createZone.mutateAsync({
        warehouseId: values.warehouseId,
        body: {
          code: values.code,
          name: values.name,
          type: values.type,
          status: values.status
        }
      });
      const wh = warehouses?.items.find((w) => w.id === values.warehouseId);
      toast.success(`Zone ${values.code} created in ${wh?.code ?? ""}`);
      reset({
        warehouseId: values.warehouseId,
        code: "",
        name: "",
        type: "storage",
        status: "active"
      });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to create zone");
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="zone-wh">Warehouse</Label>
        <Controller
          control={control}
          name="warehouseId"
          render={({ field }) => (
            <Select value={field.value} onValueChange={field.onChange}>
              <SelectTrigger id="zone-wh" className="w-full">
                <SelectValue placeholder="Select a warehouse" />
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
        <FieldError message={errors.warehouseId?.message} />
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="zone-code">Code</Label>
          <Input
            id="zone-code"
            placeholder="Z-RECV"
            className="font-mono"
            aria-invalid={Boolean(errors.code)}
            {...register("code")}
          />
          <FieldError message={errors.code?.message} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="zone-type">Type</Label>
          <Controller
            control={control}
            name="type"
            render={({ field }) => (
              <Select value={field.value} onValueChange={field.onChange}>
                <SelectTrigger id="zone-type" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="receiving">Receiving</SelectItem>
                  <SelectItem value="storage">Storage</SelectItem>
                  <SelectItem value="staging">Staging</SelectItem>
                  <SelectItem value="shipping">Shipping</SelectItem>
                  <SelectItem value="quarantine">Quarantine</SelectItem>
                </SelectContent>
              </Select>
            )}
          />
        </div>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="zone-name">Name</Label>
        <Input
          id="zone-name"
          placeholder="Receiving dock zone"
          aria-invalid={Boolean(errors.name)}
          {...register("name")}
        />
        <FieldError message={errors.name?.message} />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="zone-status">Status</Label>
        <Controller
          control={control}
          name="status"
          render={({ field }) => (
            <Select value={field.value} onValueChange={field.onChange}>
              <SelectTrigger id="zone-status" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="inactive">Inactive</SelectItem>
              </SelectContent>
            </Select>
          )}
        />
      </div>
      <div className="flex justify-end">
        <Button type="submit" disabled={isSubmitting}>
          <Layers data-icon="inline-start" />
          {isSubmitting ? "Creating..." : "Create zone"}
        </Button>
      </div>
    </form>
  );
}

function LocationForm() {
  const createLocation = useCreateLocation();
  const { data: warehouses } = useWarehouses({ pageSize: 100 });
  const {
    register,
    handleSubmit,
    control,
    setValue,
    reset,
    formState: { errors, isSubmitting }
  } = useForm<LocationFormValues>({
    resolver: zodResolver(locationFormSchema),
    defaultValues: {
      warehouseId: "",
      zoneId: "",
      code: "",
      locationType: "rack",
      capacityQty: "",
      status: "active"
    }
  });

  const warehouseId = useWatch({ control, name: "warehouseId" });
  const { data: whLocations } = useWarehouseLocations(warehouseId);
  const zones = whLocations?.zones ?? [];

  useEffect(() => {
    setValue("zoneId", "");
  }, [warehouseId, setValue]);

  async function onSubmit(values: LocationFormValues) {
    try {
      await createLocation.mutateAsync({
        warehouseId: values.warehouseId,
        body: {
          warehouseId: values.warehouseId,
          zoneId: values.zoneId,
          code: values.code,
          locationType: values.locationType,
          capacityQty:
            values.capacityQty === "" ? undefined : Number(values.capacityQty),
          status: values.status
        }
      });
      toast.success(`Location ${values.code} created`);
      reset({
        warehouseId: values.warehouseId,
        zoneId: values.zoneId,
        code: "",
        locationType: "rack",
        capacityQty: "",
        status: "active"
      });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to create location");
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="loc-wh">Warehouse</Label>
        <Controller
          control={control}
          name="warehouseId"
          render={({ field }) => (
            <Select value={field.value} onValueChange={field.onChange}>
              <SelectTrigger id="loc-wh" className="w-full">
                <SelectValue placeholder="Select a warehouse" />
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
        <FieldError message={errors.warehouseId?.message} />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="loc-zone">Zone</Label>
        <Controller
          control={control}
          name="zoneId"
          render={({ field }) => (
            <Select value={field.value} onValueChange={field.onChange}>
              <SelectTrigger id="loc-zone" className="w-full">
                <SelectValue placeholder="Select a zone" />
              </SelectTrigger>
              <SelectContent>
                {zones.length === 0 && (
                  <SelectItem value="__none" disabled>
                    No zones in this warehouse yet
                  </SelectItem>
                )}
                {zones.map((zone) => (
                  <SelectItem key={zone.id} value={zone.id}>
                    {zone.code} · {zone.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        />
        <FieldError message={errors.zoneId?.message} />
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="loc-code">Code</Label>
          <Input
            id="loc-code"
            placeholder="R-01-A"
            className="font-mono"
            aria-invalid={Boolean(errors.code)}
            {...register("code")}
          />
          <FieldError message={errors.code?.message} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="loc-type">Location type</Label>
          <Controller
            control={control}
            name="locationType"
            render={({ field }) => (
              <Select value={field.value} onValueChange={field.onChange}>
                <SelectTrigger id="loc-type" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="rack">Rack</SelectItem>
                  <SelectItem value="bin">Bin</SelectItem>
                  <SelectItem value="floor">Floor</SelectItem>
                  <SelectItem value="dock">Dock</SelectItem>
                  <SelectItem value="staging">Staging</SelectItem>
                  <SelectItem value="quarantine">Quarantine</SelectItem>
                </SelectContent>
              </Select>
            )}
          />
        </div>
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="loc-capacity">Capacity (optional)</Label>
          <Input
            id="loc-capacity"
            type="number"
            min={0}
            step="any"
            placeholder="e.g. 1000"
            className="font-mono"
            aria-invalid={Boolean(errors.capacityQty)}
            {...register("capacityQty")}
          />
          <FieldError message={errors.capacityQty?.message} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="loc-status">Status</Label>
          <Controller
            control={control}
            name="status"
            render={({ field }) => (
              <Select value={field.value} onValueChange={field.onChange}>
                <SelectTrigger id="loc-status" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="inactive">Inactive</SelectItem>
                  <SelectItem value="blocked">Blocked</SelectItem>
                </SelectContent>
              </Select>
            )}
          />
        </div>
      </div>
      <div className="flex justify-end">
        <Button type="submit" disabled={isSubmitting}>
          <MapPin data-icon="inline-start" />
          {isSubmitting ? "Creating..." : "Create location"}
        </Button>
      </div>
    </form>
  );
}

function LocationsTable() {
  const { data, isLoading } = useLocations();
  const rows = data?.items ?? [];

  return (
    <Card className="rounded-none border-border shadow-none">
      <CardHeader>
        <CardTitle className="text-base">Locations</CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <div className="max-h-[360px] overflow-auto">
          <table className="data-table">
            <thead>
              <tr>
                <th>Code</th>
                <th>Type</th>
                <th>Warehouse</th>
                <th>Zone</th>
                <th className="text-right">Capacity</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((loc) => (
                <tr key={loc.id}>
                  <td className="font-mono text-xs">{loc.code}</td>
                  <td className="text-xs uppercase">{loc.locationType}</td>
                  <td className="font-medium">{loc.warehouseCode}</td>
                  <td className="font-mono text-xs">{loc.zoneCode}</td>
                  <td className="text-right font-mono text-xs">
                    {loc.capacityQty == null ? "—" : formatNumber(loc.capacityQty)}
                  </td>
                  <td>{statusBadge(loc.status)}</td>
                </tr>
              ))}
              {!isLoading && rows.length === 0 && (
                <tr>
                  <td
                    colSpan={6}
                    className="py-8 text-center text-sm text-muted-foreground"
                  >
                    No locations yet. Create a zone and a location above.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}

export function MasterDataPage() {
  const { data: warehouses, isLoading: whLoading } = useWarehouses({
    pageSize: 100
  });
  const { data: items, isLoading: itemsLoading } = useItems({ pageSize: 100 });

  const warehouseRows = useMemo(
    () =>
      (warehouses?.items ?? []).map((w) => ({
        id: w.id,
        code: w.code,
        name: w.name,
        status: w.status,
        createdAt: w.createdAt
      })),
    [warehouses]
  );

  return (
    <div>
      <PageHeader
        title="Master data"
        description="Register warehouses and items that power receiving, jobs and movements"
      />

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <Card className="rounded-none border-border shadow-none">
          <CardHeader>
            <CardTitle className="text-base">New warehouse</CardTitle>
          </CardHeader>
          <CardContent>
            <WarehouseForm />
          </CardContent>
        </Card>

        <Card className="rounded-none border-border shadow-none">
          <CardHeader>
            <CardTitle className="text-base">New zone</CardTitle>
          </CardHeader>
          <CardContent>
            <ZoneForm />
          </CardContent>
        </Card>

        <Card className="rounded-none border-border shadow-none">
          <CardHeader>
            <CardTitle className="text-base">New location</CardTitle>
          </CardHeader>
          <CardContent>
            <LocationForm />
          </CardContent>
        </Card>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-6 xl:grid-cols-2">
        <Card className="rounded-none border-border shadow-none">
          <CardHeader>
            <CardTitle className="text-base">Warehouses</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Code</th>
                  <th>Name</th>
                  <th>Status</th>
                  <th className="text-right">Created</th>
                </tr>
              </thead>
              <tbody>
                {warehouseRows.map((w) => (
                  <tr key={w.id}>
                    <td className="font-mono text-xs">{w.code}</td>
                    <td className="font-medium">{w.name}</td>
                    <td>{statusBadge(w.status)}</td>
                    <td className="text-right font-mono text-xs">
                      {formatDate(w.createdAt)}
                    </td>
                  </tr>
                ))}
                {!whLoading && warehouseRows.length === 0 && (
                  <tr>
                    <td
                      colSpan={4}
                      className="py-8 text-center text-sm text-muted-foreground"
                    >
                      No warehouses yet. Create one above.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </CardContent>
        </Card>

        <Card className="rounded-none border-border shadow-none">
          <CardHeader>
            <CardTitle className="text-base">Items</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="max-h-[360px] overflow-auto">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>SKU</th>
                    <th>Name</th>
                    <th>UoM</th>
                    <th>Lot</th>
                    <th>Exp</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {(items?.items ?? []).map((item) => (
                    <tr key={item.id}>
                      <td className="font-mono text-xs">{item.sku}</td>
                      <td className="font-medium">{item.name}</td>
                      <td className="font-mono text-xs">{item.uom}</td>
                      <td>{item.lotTracked ? "Yes" : "—"}</td>
                      <td>{item.expiryTracked ? "Yes" : "—"}</td>
                      <td>{statusBadge(item.status)}</td>
                    </tr>
                  ))}
                  {!itemsLoading && (items?.items ?? []).length === 0 && (
                    <tr>
                      <td
                        colSpan={6}
                        className="py-8 text-center text-sm text-muted-foreground"
                      >
                        No items yet. Create one above.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="mt-6">
        <LocationsTable />
      </div>
    </div>
  );
}
