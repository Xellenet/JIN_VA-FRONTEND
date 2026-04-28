"use client"

import { useState, useMemo } from "react"
import { DashboardLayout } from "@/components/dashboard/layout"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Search,
  ChevronDown,
  Plus,
  MoreVertical,
  Eye,
  Pencil,
  Trash2,
  ArrowUpDown,
  Package,
  PackageCheck,
  PackageX,
  AlertTriangle,
} from "lucide-react"
import { mockUsers, mockProducts } from "@/lib/data/mock-data"

type SortField = "name" | "category" | "price" | "stock" | "status"
type SortDir = "asc" | "desc"

export default function ProductsPage() {
  const user = mockUsers[0]
  const [search, setSearch] = useState("")
  const [statusFilter, setStatusFilter] = useState<string>("all")
  const [categoryFilter, setCategoryFilter] = useState<string>("all")
  const [sortField, setSortField] = useState<SortField>("name")
  const [sortDir, setSortDir] = useState<SortDir>("asc")

  const categories = useMemo(() => {
    const cats = new Set(mockProducts.map((p) => p.category))
    return ["all", ...Array.from(cats)]
  }, [])

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir(sortDir === "asc" ? "desc" : "asc")
    } else {
      setSortField(field)
      setSortDir("asc")
    }
  }

  const filtered = useMemo(() => {
    let result = [...mockProducts]

    if (search) {
      const q = search.toLowerCase()
      result = result.filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          p.category.toLowerCase().includes(q) ||
          p.sku.toLowerCase().includes(q) ||
          p.description.toLowerCase().includes(q)
      )
    }

    if (statusFilter !== "all") {
      result = result.filter((p) => p.status === statusFilter)
    }

    if (categoryFilter !== "all") {
      result = result.filter((p) => p.category === categoryFilter)
    }

    result.sort((a, b) => {
      let cmp = 0
      if (sortField === "price" || sortField === "stock") {
        cmp = a[sortField] - b[sortField]
      } else {
        cmp = String(a[sortField]).localeCompare(String(b[sortField]))
      }
      return sortDir === "asc" ? cmp : -cmp
    })

    return result
  }, [search, statusFilter, categoryFilter, sortField, sortDir])

  const statusCounts = {
    all: mockProducts.length,
    "in-stock": mockProducts.filter((p) => p.status === "in-stock").length,
    "low-stock": mockProducts.filter((p) => p.status === "low-stock").length,
    "out-of-stock": mockProducts.filter((p) => p.status === "out-of-stock").length,
  }

  const stockBadge = (status: string) => {
    const map: Record<string, string> = {
      "in-stock": "border-green-200 bg-green-50 text-green-700",
      "low-stock": "border-yellow-200 bg-yellow-50 text-yellow-700",
      "out-of-stock": "border-red-200 bg-red-50 text-red-700",
    }
    return map[status] || "border-muted bg-muted text-muted-foreground"
  }

  const stockLabel = (status: string) => {
    const map: Record<string, string> = {
      "in-stock": "In Stock",
      "low-stock": "Low Stock",
      "out-of-stock": "Out of Stock",
    }
    return map[status] || status
  }

  const SortHeader = ({ label, field }: { label: string; field: SortField }) => (
    <button
      type="button"
      onClick={() => handleSort(field)}
      className="flex items-center gap-1 font-medium hover:text-foreground"
    >
      {label}
      <ArrowUpDown className="h-3.5 w-3.5" />
    </button>
  )

  return (
    <DashboardLayout user={user}>
      <div className="space-y-6">
        {/* Summary cards */}
        <div className="grid gap-4 md:grid-cols-4">
          {[
            { label: "All Products", count: statusCounts.all, icon: Package, color: "text-foreground", filter: "all" },
            { label: "In Stock", count: statusCounts["in-stock"], icon: PackageCheck, color: "text-green-600", filter: "in-stock" },
            { label: "Low Stock", count: statusCounts["low-stock"], icon: AlertTriangle, color: "text-yellow-600", filter: "low-stock" },
            { label: "Out of Stock", count: statusCounts["out-of-stock"], icon: PackageX, color: "text-red-600", filter: "out-of-stock" },
          ].map((item) => (
            <button
              key={item.label}
              type="button"
              onClick={() => setStatusFilter(item.filter)}
              className="text-left"
            >
              <Card className={`cursor-pointer transition-shadow hover:shadow-md ${statusFilter === item.filter ? "ring-2 ring-primary" : ""}`}>
                <CardContent className="flex items-center gap-4 p-4">
                  <div className={`rounded-lg bg-muted p-2.5 ${item.color}`}>
                    <item.icon className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">{item.label}</p>
                    <p className="text-2xl font-bold">{item.count}</p>
                  </div>
                </CardContent>
              </Card>
            </button>
          ))}
        </div>

        <Card>
          <CardHeader>
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <CardTitle className="text-2xl font-bold">Products</CardTitle>
                <p className="text-sm text-muted-foreground">
                  Manage inventory, pricing, and stock levels for all plumbing products
                </p>
              </div>
              <Button className="w-full bg-primary hover:bg-primary/90 text-primary-foreground sm:w-auto">
                <Plus className="mr-2 h-4 w-4" />
                Add Product
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {/* Search and filters */}
            <div className="mb-6 flex flex-wrap items-center gap-3">
              <div className="relative flex-1 min-w-[200px]">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Search by name, SKU, or description..."
                  className="pl-10"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" className="gap-2 bg-transparent">
                    {statusFilter === "all" ? "All Status" : stockLabel(statusFilter)}
                    <ChevronDown className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  {["all", "in-stock", "low-stock", "out-of-stock"].map((s) => (
                    <DropdownMenuItem key={s} onClick={() => setStatusFilter(s)}>
                      {s === "all" ? "All Status" : stockLabel(s)}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" className="gap-2 bg-transparent">
                    {categoryFilter === "all" ? "All Categories" : categoryFilter}
                    <ChevronDown className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  {categories.map((c) => (
                    <DropdownMenuItem key={c} onClick={() => setCategoryFilter(c)}>
                      {c === "all" ? "All Categories" : c}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>

            {/* Table */}
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b text-left text-sm text-muted-foreground">
                    <th className="pb-3"><SortHeader label="Product Name" field="name" /></th>
                    <th className="pb-3 font-medium">SKU</th>
                    <th className="pb-3"><SortHeader label="Category" field="category" /></th>
                    <th className="pb-3 font-medium">Description</th>
                    <th className="pb-3"><SortHeader label="Price" field="price" /></th>
                    <th className="pb-3"><SortHeader label="Stock" field="stock" /></th>
                    <th className="pb-3"><SortHeader label="Status" field="status" /></th>
                    <th className="pb-3 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="py-12 text-center text-muted-foreground">
                        <PackageX className="mx-auto mb-2 h-8 w-8 opacity-40" />
                        No products found matching your criteria
                      </td>
                    </tr>
                  ) : (
                    filtered.map((product) => (
                      <tr key={product.id} className="border-b last:border-0 hover:bg-muted/30 transition-colors">
                        <td className="py-4">
                          <div className="flex items-center gap-3">
                            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-muted">
                              <Package className="h-4.5 w-4.5 text-muted-foreground" />
                            </div>
                            <span className="font-medium">{product.name}</span>
                          </div>
                        </td>
                        <td className="py-4">
                          <span className="rounded bg-muted px-2 py-0.5 text-xs font-mono font-medium">
                            {product.sku}
                          </span>
                        </td>
                        <td className="py-4 text-sm text-muted-foreground">{product.category}</td>
                        <td className="py-4 text-sm text-muted-foreground max-w-[200px] truncate">
                          {product.description}
                        </td>
                        <td className="py-4 text-sm font-semibold text-foreground">
                          ${product.price.toFixed(2)}
                        </td>
                        <td className="py-4 text-sm font-medium">
                          {product.stock}
                        </td>
                        <td className="py-4">
                          <Badge variant="outline" className={stockBadge(product.status)}>
                            <span className="mr-1.5 inline-block h-1.5 w-1.5 rounded-full bg-current" />
                            {stockLabel(product.status)}
                          </Badge>
                        </td>
                        <td className="py-4">
                          <div className="flex items-center gap-1">
                            <Button variant="ghost" size="icon" className="h-8 w-8">
                              <Eye className="h-4 w-4" />
                            </Button>
                            <Button variant="ghost" size="icon" className="h-8 w-8">
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-8 w-8">
                                  <MoreVertical className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem>Restock</DropdownMenuItem>
                                <DropdownMenuItem>Duplicate</DropdownMenuItem>
                                <DropdownMenuItem className="text-destructive">
                                  <Trash2 className="mr-2 h-4 w-4" />
                                  Delete
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Footer summary */}
            <div className="mt-4 flex flex-col gap-2 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
              <p>Showing {filtered.length} of {mockProducts.length} products</p>
              <p>
                Total Inventory Value:{" "}
                <span className="font-semibold text-foreground">
                  ${mockProducts.reduce((sum, p) => sum + p.price * p.stock, 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  )
}
