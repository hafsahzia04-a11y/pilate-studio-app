"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { formatCurrency } from "@/lib/utils";
import {
  Plus, Pencil, PackagePlus, X, AlertTriangle, Trash2, Gift,
} from "lucide-react";
import { cn } from "@/lib/utils";
import toast from "react-hot-toast";

interface Product {
  id: string;
  name: string;
  description: string | null;
  price: number;
  stockQuantity: number;
  lowStockThreshold: number;
  category: string | null;
  isActive: boolean;
}

interface ClientPerk {
  clientPackageId: string;
  clientId: string;
  clientName: string;
  clientEmail: string;
  packageName: string;
  drinksRemaining: number;
  drinksPerPeriod: number;
}

const inputCls =
  "w-full rounded-xl border border-stone-200 bg-white px-3 py-2 text-sm text-stone-800 outline-none focus:border-sage-400 focus:ring-2 focus:ring-sage-100";
const labelCls = "block text-xs font-medium text-stone-600 mb-1";

export const CATEGORIES = [
  { value: "wellness_shot", label: "Wellness Shot" },
  { value: "beverage", label: "Beverage" },
  { value: "supplement", label: "Supplement" },
  { value: "snack", label: "Snack" },
  { value: "equipment", label: "Equipment" },
  { value: "merchandise", label: "Merchandise" },
  { value: "other", label: "Other" },
];

// Categories where a client can "redeem" a perk from their package
const PERK_CATEGORIES = ["wellness_shot", "beverage"];

const emptyForm = {
  name: "",
  description: "",
  price: "",
  stockQuantity: "0",
  lowStockThreshold: "5",
  category: "wellness_shot",
};

export function InventoryManager({ initialProducts }: { initialProducts: Product[] }) {
  const [products, setProducts] = useState(initialProducts);
  const [modal, setModal] = useState<"add" | "edit" | "restock" | "redeem" | "delete" | null>(null);
  const [selected, setSelected] = useState<Product | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [restockQty, setRestockQty] = useState("10");
  const [saving, setSaving] = useState(false);

  // Redeem perk state
  const [clientPerks, setClientPerks] = useState<ClientPerk[]>([]);
  const [loadingPerks, setLoadingPerks] = useState(false);
  const [selectedPerk, setSelectedPerk] = useState<string>(""); // clientPackageId

  function set(f: string, v: string) {
    setForm((p) => ({ ...p, [f]: v }));
  }

  function openAdd() {
    setForm(emptyForm);
    setSelected(null);
    setModal("add");
  }

  function openEdit(p: Product) {
    setSelected(p);
    setForm({
      name: p.name,
      description: p.description ?? "",
      price: String(p.price),
      stockQuantity: String(p.stockQuantity),
      lowStockThreshold: String(p.lowStockThreshold),
      category: p.category ?? "other",
    });
    setModal("edit");
  }

  function openRestock(p: Product) {
    setSelected(p);
    setRestockQty("10");
    setModal("restock");
  }

  function openDelete(p: Product) {
    setSelected(p);
    setModal("delete");
  }

  async function openRedeem(p: Product) {
    setSelected(p);
    setSelectedPerk("");
    setLoadingPerks(true);
    setModal("redeem");
    try {
      const res = await fetch("/api/inventory/perks");
      const data = await res.json();
      if (!res.ok) { toast.error(data.error ?? "Failed to load clients"); return; }
      setClientPerks(data.data ?? []);
    } finally {
      setLoadingPerks(false);
    }
  }

  // ── Add product ────────────────────────────────────────────────────────────
  async function submitAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim()) { toast.error("Name required"); return; }
    if (!form.price || isNaN(Number(form.price))) { toast.error("Valid price required"); return; }
    setSaving(true);
    try {
      const res = await fetch("/api/inventory", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "create",
          name: form.name.trim(),
          description: form.description.trim() || null,
          price: Number(form.price),
          stockQuantity: Number(form.stockQuantity),
          lowStockThreshold: Number(form.lowStockThreshold),
          category: form.category,
        }),
      });
      const data = await res.json();
      if (!res.ok) { toast.error(data.error ?? "Failed"); return; }
      setProducts((prev) =>
        [...prev, { ...data.data, price: Number(data.data.price) }].sort((a, b) =>
          a.name.localeCompare(b.name)
        )
      );
      toast.success(`"${form.name}" added`);
      setModal(null);
    } finally {
      setSaving(false);
    }
  }

  // ── Edit product ───────────────────────────────────────────────────────────
  async function submitEdit(e: React.FormEvent) {
    e.preventDefault();
    if (!selected) return;
    setSaving(true);
    try {
      const res = await fetch("/api/inventory", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: selected.id,
          name: form.name.trim(),
          description: form.description.trim() || null,
          price: Number(form.price),
          lowStockThreshold: Number(form.lowStockThreshold),
          category: form.category,
        }),
      });
      const data = await res.json();
      if (!res.ok) { toast.error(data.error ?? "Failed"); return; }
      setProducts((prev) =>
        prev.map((p) =>
          p.id === selected.id ? { ...p, ...data.data, price: Number(data.data.price) } : p
        )
      );
      toast.success("Product updated");
      setModal(null);
    } finally {
      setSaving(false);
    }
  }

  // ── Restock ────────────────────────────────────────────────────────────────
  async function submitRestock(e: React.FormEvent) {
    e.preventDefault();
    if (!selected || !restockQty || isNaN(Number(restockQty))) return;
    setSaving(true);
    try {
      const res = await fetch("/api/inventory", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "restock", productId: selected.id, quantity: Number(restockQty) }),
      });
      const data = await res.json();
      if (!res.ok) { toast.error(data.error ?? "Failed"); return; }
      setProducts((prev) =>
        prev.map((p) => (p.id === selected.id ? { ...p, stockQuantity: data.data.stockQuantity } : p))
      );
      toast.success(`Added ${restockQty} units to ${selected.name}`);
      setModal(null);
    } finally {
      setSaving(false);
    }
  }

  // ── Delete (soft) ──────────────────────────────────────────────────────────
  async function submitDelete() {
    if (!selected) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/inventory?id=${selected.id}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) { toast.error(data.error ?? "Failed"); return; }
      setProducts((prev) => prev.filter((p) => p.id !== selected.id));
      toast.success(`"${selected.name}" removed`);
      setModal(null);
    } finally {
      setSaving(false);
    }
  }

  // ── Redeem perk (wellness shot / beverage from package) ────────────────────
  async function submitRedeem(e: React.FormEvent) {
    e.preventDefault();
    if (!selected || !selectedPerk) { toast.error("Select a client"); return; }
    const perk = clientPerks.find((c) => c.clientPackageId === selectedPerk);
    if (!perk) return;
    setSaving(true);
    try {
      const res = await fetch("/api/inventory", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "redeem",
          productId: selected.id,
          clientId: perk.clientId,
          clientPackageId: perk.clientPackageId,
        }),
      });
      const data = await res.json();
      if (!res.ok) { toast.error(data.error ?? "Failed"); return; }
      // Update stock in UI
      setProducts((prev) =>
        prev.map((p) =>
          p.id === selected.id ? { ...p, stockQuantity: Math.max(0, p.stockQuantity - 1) } : p
        )
      );
      // Update perk count in state
      setClientPerks((prev) =>
        prev
          .map((c) =>
            c.clientPackageId === selectedPerk
              ? { ...c, drinksRemaining: c.drinksRemaining - 1 }
              : c
          )
          .filter((c) => c.drinksRemaining > 0)
      );
      toast.success(`Redeemed for ${perk.clientName} — ${data.data.drinksRemaining} drink${data.data.drinksRemaining !== 1 ? "s" : ""} left`);
      setModal(null);
    } finally {
      setSaving(false);
    }
  }

  const lowStock = products.filter((p) => p.stockQuantity <= p.lowStockThreshold);

  return (
    <div className="space-y-5">
      {/* Low stock alert */}
      {lowStock.length > 0 && (
        <div className="flex items-center gap-3 bg-amber-50 border border-amber-200 rounded-2xl px-4 py-3">
          <AlertTriangle className="h-4 w-4 text-amber-600 flex-shrink-0" />
          <p className="text-sm text-amber-700 font-medium">
            {lowStock.length} product{lowStock.length > 1 ? "s" : ""} running low:{" "}
            {lowStock.map((p) => p.name).join(", ")}
          </p>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-stone-500">
          {products.length} item{products.length !== 1 ? "s" : ""}
        </p>
        <Button size="sm" onClick={openAdd}>
          <Plus className="h-4 w-4" />
          Add Product
        </Button>
      </div>

      {/* Product grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {products.map((p) => {
          const isLow = p.stockQuantity <= p.lowStockThreshold;
          const isOut = p.stockQuantity === 0;
          const canRedeem = PERK_CATEGORIES.includes(p.category ?? "");
          return (
            <Card key={p.id} className="p-4">
              <div className="flex items-start justify-between gap-2 mb-3">
                <div className="min-w-0">
                  <p className="font-semibold text-stone-900 truncate">{p.name}</p>
                  <p className="text-xs text-stone-500 mt-0.5 capitalize">
                    {CATEGORIES.find((c) => c.value === p.category)?.label ?? p.category ?? "Product"}
                  </p>
                </div>
                <div className="flex items-center gap-1.5 flex-shrink-0">
                  <Badge variant={isOut ? "danger" : isLow ? "warning" : "sage"}>
                    {isOut ? "Out" : isLow ? "Low" : "OK"}
                  </Badge>
                  {/* Delete button */}
                  <button
                    onClick={() => openDelete(p)}
                    className="text-stone-300 hover:text-red-500 transition-colors"
                    title="Remove product"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>

              <div className="flex justify-between items-end mb-3">
                <div>
                  <p className="text-2xl font-bold text-stone-900">{p.stockQuantity}</p>
                  <p className="text-xs text-stone-400">units remaining</p>
                </div>
                <p className="text-sm font-semibold text-sage-600">{formatCurrency(p.price)}</p>
              </div>

              {p.description && (
                <p className="text-xs text-stone-400 mb-3 line-clamp-2">{p.description}</p>
              )}

              <div className="flex gap-2 pt-2 border-t border-stone-50">
                <Button variant="outline" size="sm" className="flex-1" onClick={() => openRestock(p)}>
                  <PackagePlus className="h-3.5 w-3.5" />
                  Restock
                </Button>
                {canRedeem && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1 text-sage-700 border-sage-200 hover:bg-sage-50"
                    onClick={() => openRedeem(p)}
                  >
                    <Gift className="h-3.5 w-3.5" />
                    Redeem
                  </Button>
                )}
                <Button variant="ghost" size="sm" onClick={() => openEdit(p)} title="Edit">
                  <Pencil className="h-3.5 w-3.5" />
                </Button>
              </div>
            </Card>
          );
        })}

        {products.length === 0 && (
          <div className="col-span-3 text-center py-12 text-stone-400">
            <p className="text-sm">No products yet.</p>
            <button onClick={openAdd} className="mt-2 text-xs text-sage-600 hover:underline">
              + Add your first product
            </button>
          </div>
        )}
      </div>

      {/* ── Add / Edit Modal ─────────────────────────────────────────────────── */}
      {(modal === "add" || modal === "edit") && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-6 py-4 border-b border-stone-100">
              <h2 className="text-base font-semibold text-stone-900">
                {modal === "add" ? "Add Product" : `Edit — ${selected?.name}`}
              </h2>
              <button onClick={() => setModal(null)} className="text-stone-400 hover:text-stone-600">
                <X className="h-5 w-5" />
              </button>
            </div>

            <form
              onSubmit={modal === "add" ? submitAdd : submitEdit}
              className="px-6 py-5 space-y-4"
            >
              <div>
                <label className={labelCls}>Product Name *</label>
                <input
                  className={inputCls}
                  placeholder="e.g. Green Wellness Shot"
                  value={form.name}
                  onChange={(e) => set("name", e.target.value)}
                  required
                />
              </div>

              <div>
                <label className={labelCls}>Category</label>
                <select
                  className={inputCls}
                  value={form.category}
                  onChange={(e) => set("category", e.target.value)}
                >
                  {CATEGORIES.map((c) => (
                    <option key={c.value} value={c.value}>
                      {c.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelCls}>Price (PKR) *</label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    className={inputCls}
                    placeholder="0"
                    value={form.price}
                    onChange={(e) => set("price", e.target.value)}
                    required
                  />
                </div>
                <div>
                  <label className={labelCls}>Low Stock Alert</label>
                  <input
                    type="number"
                    min="0"
                    className={inputCls}
                    placeholder="5"
                    value={form.lowStockThreshold}
                    onChange={(e) => set("lowStockThreshold", e.target.value)}
                  />
                </div>
              </div>

              {modal === "add" && (
                <div>
                  <label className={labelCls}>Opening Stock</label>
                  <input
                    type="number"
                    min="0"
                    className={inputCls}
                    placeholder="0"
                    value={form.stockQuantity}
                    onChange={(e) => set("stockQuantity", e.target.value)}
                  />
                </div>
              )}

              <div>
                <label className={labelCls}>
                  Description <span className="text-stone-400">(optional)</span>
                </label>
                <textarea
                  className={cn(inputCls, "resize-none")}
                  rows={2}
                  placeholder="Brief description"
                  value={form.description}
                  onChange={(e) => set("description", e.target.value)}
                />
              </div>

              <div className="flex gap-3 pt-2 border-t border-stone-100">
                <Button type="button" variant="outline" className="flex-1" onClick={() => setModal(null)}>
                  Cancel
                </Button>
                <Button type="submit" className="flex-1" loading={saving}>
                  {saving ? "Saving…" : modal === "add" ? "Add Product" : "Save Changes"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Restock Modal ────────────────────────────────────────────────────── */}
      {modal === "restock" && selected && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm">
            <div className="flex items-center justify-between px-6 py-4 border-b border-stone-100">
              <h2 className="text-base font-semibold text-stone-900">Restock — {selected.name}</h2>
              <button onClick={() => setModal(null)} className="text-stone-400 hover:text-stone-600">
                <X className="h-5 w-5" />
              </button>
            </div>
            <form onSubmit={submitRestock} className="px-6 py-5 space-y-4">
              <p className="text-sm text-stone-500">
                Current stock:{" "}
                <span className="font-semibold text-stone-800">{selected.stockQuantity} units</span>
              </p>
              <div>
                <label className={labelCls}>Units to add *</label>
                <input
                  type="number"
                  min="1"
                  className={inputCls}
                  value={restockQty}
                  onChange={(e) => setRestockQty(e.target.value)}
                  autoFocus
                  required
                />
              </div>
              <div className="flex gap-3 pt-2 border-t border-stone-100">
                <Button type="button" variant="outline" className="flex-1" onClick={() => setModal(null)}>
                  Cancel
                </Button>
                <Button type="submit" className="flex-1" loading={saving}>
                  {saving ? "Saving…" : `Add ${restockQty || 0} units`}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Redeem Perk Modal ────────────────────────────────────────────────── */}
      {modal === "redeem" && selected && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm">
            <div className="flex items-center justify-between px-6 py-4 border-b border-stone-100">
              <div>
                <h2 className="text-base font-semibold text-stone-900">Redeem Perk</h2>
                <p className="text-xs text-stone-400 mt-0.5">{selected.name}</p>
              </div>
              <button onClick={() => setModal(null)} className="text-stone-400 hover:text-stone-600">
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={submitRedeem} className="px-6 py-5 space-y-4">
              {loadingPerks ? (
                <p className="text-sm text-stone-400 text-center py-4">Loading clients…</p>
              ) : clientPerks.length === 0 ? (
                <div className="text-center py-4 space-y-1">
                  <Gift className="h-8 w-8 text-stone-200 mx-auto" />
                  <p className="text-sm text-stone-500 font-medium">No perks available</p>
                  <p className="text-xs text-stone-400">
                    No active clients have drink perks remaining this period.
                  </p>
                </div>
              ) : (
                <>
                  <div>
                    <label className={labelCls}>Select Client *</label>
                    <select
                      className={inputCls}
                      value={selectedPerk}
                      onChange={(e) => setSelectedPerk(e.target.value)}
                      required
                    >
                      <option value="">— choose a client —</option>
                      {clientPerks.map((c) => (
                        <option key={c.clientPackageId} value={c.clientPackageId}>
                          {c.clientName} — {c.drinksRemaining} drink
                          {c.drinksRemaining !== 1 ? "s" : ""} left ({c.packageName})
                        </option>
                      ))}
                    </select>
                  </div>

                  {selectedPerk && (() => {
                    const perk = clientPerks.find((c) => c.clientPackageId === selectedPerk);
                    return perk ? (
                      <div className="bg-sage-50 border border-sage-100 rounded-xl px-4 py-3 text-sm space-y-1">
                        <p className="font-medium text-stone-800">{perk.clientName}</p>
                        <p className="text-stone-500">{perk.packageName}</p>
                        <p className="text-sage-700 font-semibold">
                          {perk.drinksRemaining} / {perk.drinksPerPeriod} drinks remaining this period
                        </p>
                      </div>
                    ) : null;
                  })()}

                  <p className="text-xs text-stone-400 bg-stone-50 rounded-xl px-3 py-2">
                    This will deduct 1 unit from <span className="font-medium">{selected.name}</span> stock
                    and mark the client&apos;s perk as used.
                  </p>

                  <div className="flex gap-3 pt-2 border-t border-stone-100">
                    <Button
                      type="button"
                      variant="outline"
                      className="flex-1"
                      onClick={() => setModal(null)}
                    >
                      Cancel
                    </Button>
                    <Button
                      type="submit"
                      className="flex-1 bg-sage-600 hover:bg-sage-700"
                      loading={saving}
                      disabled={!selectedPerk}
                    >
                      {saving ? "Confirming…" : "Confirm Redemption"}
                    </Button>
                  </div>
                </>
              )}

              {clientPerks.length === 0 && !loadingPerks && (
                <Button
                  type="button"
                  variant="outline"
                  className="w-full"
                  onClick={() => setModal(null)}
                >
                  Close
                </Button>
              )}
            </form>
          </div>
        </div>
      )}

      {/* ── Delete Confirm Modal ─────────────────────────────────────────────── */}
      {modal === "delete" && selected && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm">
            <div className="px-6 py-5 space-y-4">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-red-50 flex items-center justify-center flex-shrink-0">
                  <Trash2 className="h-5 w-5 text-red-500" />
                </div>
                <div>
                  <p className="font-semibold text-stone-900">Remove product?</p>
                  <p className="text-sm text-stone-500 mt-0.5">
                    &ldquo;{selected.name}&rdquo; will be hidden from inventory. Transaction history is kept.
                  </p>
                </div>
              </div>
              <div className="flex gap-3 pt-2 border-t border-stone-100">
                <Button
                  type="button"
                  variant="outline"
                  className="flex-1"
                  onClick={() => setModal(null)}
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  className="flex-1 bg-red-500 hover:bg-red-600 text-white"
                  loading={saving}
                  onClick={submitDelete}
                >
                  {saving ? "Removing…" : "Yes, Remove"}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
