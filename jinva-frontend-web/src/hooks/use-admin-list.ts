"use client"

import { useCallback, useEffect, useState } from "react"
import { apiFetchWithMeta } from "@/lib/api"

export const ADMIN_PAGE_SIZE = 20
const SEARCH_DEBOUNCE_MS = 300

type Filter = "all" | "ACTIVE" | "SUSPENDED" | "BANNED"

/**
 * QA ADM-03: an admin list that pages, searches and filters on the server.
 * The Clients page used to load 100 rows once and search those, so anyone
 * past the first 100 could never be found. Status totals come from the API's
 * own counts, not from the loaded page.
 */
export function useAdminList<T>(endpoint: string, baseQuery: Record<string, string> = {}) {
  const [items, setItems] = useState<T[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [loadFailed, setLoadFailed] = useState(false)
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [total, setTotal] = useState(0)
  const [search, setSearch] = useState("")
  const [debounced, setDebounced] = useState("")
  const [status, setStatus] = useState<Filter>("all")
  const [counts, setCounts] = useState<Record<Filter, number | null>>({
    all: null,
    ACTIVE: null,
    SUSPENDED: null,
    BANNED: null,
  })
  const [reloadKey, setReloadKey] = useState(0)
  const baseKey = JSON.stringify(baseQuery)

  useEffect(() => {
    const t = setTimeout(() => setDebounced(search.trim()), SEARCH_DEBOUNCE_MS)
    return () => clearTimeout(t)
  }, [search])

  // A new search or filter starts again from the first page.
  useEffect(() => setPage(1), [debounced, status])

  const query = useCallback(
    (extra: Record<string, string>) =>
      `${endpoint}?${new URLSearchParams({ ...JSON.parse(baseKey), ...extra }).toString()}`,
    [endpoint, baseKey],
  )

  useEffect(() => {
    let cancelled = false
    setIsLoading(true)
    setLoadFailed(false)
    apiFetchWithMeta<T[]>(
      query({
        page: String(page),
        limit: String(ADMIN_PAGE_SIZE),
        ...(debounced ? { search: debounced } : {}),
        ...(status !== "all" ? { status } : {}),
      }),
    )
      .then(({ data, meta }) => {
        if (cancelled) return
        const pagination = meta?.pagination as { total?: number; totalPages?: number } | undefined
        setItems(Array.isArray(data) ? data : [])
        setTotal(pagination?.total ?? 0)
        setTotalPages(Math.max(pagination?.totalPages ?? 1, 1))
      })
      .catch(() => !cancelled && setLoadFailed(true))
      .finally(() => !cancelled && setIsLoading(false))
    return () => {
      cancelled = true
    }
  }, [query, page, debounced, status, reloadKey])

  useEffect(() => {
    let cancelled = false
    const filters: Filter[] = ["all", "ACTIVE", "SUSPENDED", "BANNED"]
    Promise.all(
      filters.map((f) =>
        apiFetchWithMeta<T[]>(query({ page: "1", limit: "1", ...(f !== "all" ? { status: f } : {}) }))
          .then(({ meta }) => (meta?.pagination as { total?: number } | undefined)?.total ?? null)
          .catch(() => null),
      ),
    ).then((totals) => {
      if (!cancelled) setCounts(Object.fromEntries(filters.map((f, i) => [f, totals[i]])) as Record<Filter, number | null>)
    })
    return () => {
      cancelled = true
    }
  }, [query, reloadKey])

  return {
    items,
    setItems,
    isLoading,
    loadFailed,
    page,
    setPage,
    totalPages,
    total,
    search,
    setSearch,
    status,
    setStatus,
    counts,
    reload: () => setReloadKey((k) => k + 1),
  }
}
