import type { PostgrestError } from "@supabase/supabase-js";

const PAGE_SIZE = 1000;

/**
 * Fetch every row from a Supabase query, transparently paging past the
 * default 1000-row PostgREST cap.
 *
 * `buildQuery(from, to)` must return a fresh query builder with `.range(from, to)`
 * applied (and any filters/select/order needed). The loop keeps requesting pages
 * until a short page is returned.
 */
export async function fetchAllRows<T = unknown>(
  buildQuery: (
    from: number,
    to: number,
  ) => PromiseLike<{ data: T[] | null; error: PostgrestError | null }>,
  pageSize: number = PAGE_SIZE,
): Promise<T[]> {
  let all: T[] = [];
  for (let offset = 0; ; offset += pageSize) {
    const { data, error } = await buildQuery(offset, offset + pageSize - 1);
    if (error) throw error;
    if (!data || data.length === 0) break;
    all = all.concat(data);
    if (data.length < pageSize) break;
  }
  return all;
}