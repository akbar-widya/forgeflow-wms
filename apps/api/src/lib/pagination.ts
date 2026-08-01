import { buildPaginationMeta, type PaginationMeta } from "@forgeflow/contracts";

export type PaginationInput = {
  page: number;
  pageSize: number;
};

export function offsetFor(input: PaginationInput): number {
  return (input.page - 1) * input.pageSize;
}

export function pageMeta(
  page: number,
  pageSize: number,
  total: number
): PaginationMeta {
  return buildPaginationMeta(page, pageSize, total);
}
