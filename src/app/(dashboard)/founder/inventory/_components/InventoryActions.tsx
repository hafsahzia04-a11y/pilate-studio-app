"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { formatCurrency } from "@/lib/utils";
import { Plus, Pencil, PackagePlus, X, AlertTriangle } from "lucide-react";
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

const inputCls = "w-full rounded-xl border border-stone-200 bg-white px-3 py-2 text-sm text-stone-800 outline-none focus:border-sage-400 focus:ring-2 focus:ring-sage-100";
const labelCls = "block text-xs font-medium text-stone-600 mb-1";

const CATEGORIES = [
  { value: "wellness_shot", label: "Wellness Shot" },
  { value: "beverage", label: "Beverage" },
  { value: "supplement", label: "Supplement" },
  { value: "snack", label: "Snack" },
  { value: "merchandise", label: "Merchandise" },
  { value: "other", label: "Other" },
];

const emptyForm = {
  name: "", description: "", price: "", stockQuantity: "0",
  lowStockThreshold: "5", category: "beverage",
};

export function InventoryManager({ initialProducts }: { initialProducts: Product[] }) {
  const [products, setProducts] = useState(initialProducts);
  const [modal, setModal] = useState<"add" | "edit" | "restock" | null>(null);
  const [selected, setSelected] = useState<Product | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [restockQty, setRestockQty] = useState("10");
  const [saving, setSaving] = useState(false);

  function set(f: string, v: string) { setForm((p) => ({ ...p, [f]: v })); }

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
      setProducts((prev) => [...prev, { ...data, price: Number(data.price) }].sort((a, b) => a.name.localeCompare(b.name)));
      toast.success(`"${form.name}" added`);
      setModal(null);
    } finally { setSaving(false); }
  }

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
      setProducts((prev) => prev.map((p) => p.id === selected.id ? { ...p, ...data } : p));
      toast.success("Product updated");
      setModal(null);
    } finally { setSaving(false); }
  }

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
      setProducts((prev) => prev.map((p) => p.id === selected.id ? { ...p, stockQuantity: data.stockQuantity } : p));
      toast.success(`Added ${restockQty} units to ${selected.name}`);
      setModal(null);
    } finally { setSaving(false); }
  }

  const lowStock = products.filter((p) => p.stockQuantity <= p.lowStockThreshold);

  return (
    <div className="space-y-5">
      {/* Low stock alert */}
      {lowStock.length > 0 && (
        <div className="flex items-center gap-3 bg-amber-50 border border-amber-200 rounded-2xl px-4 py-3">
          <AlertTriangle className="h-4 w-4 text-amber-600 flex-shrink-0" />
          <p className="text-sm text-amber-700 font-medium">
            {lowStock.length} product{lowStock.length > 1 ? "s" : ""} running low: {lowStock.map((p) => p.name).join(", ")}
          </p>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-stone-500">{products.length} product{products.length !== 1 ? "s" : ""}</p>
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
          return (
            <Card key={p.id} className="p-4">
              <div className="flex items-start justify-between gap-2 mb-3">
                <div className="min-w-0">
                  <p className="font-semibold text-stone-900 truncate">{p.name}</p>
                  <p className="text-xs text-stone-500 mt-0.5 capitalize">
                    {CATEGORIES.find((c) => c.value === p.category)?.label ?? p.category ?? "Product"}
                  </p>
                </div>
                <Badge variant={isOut ? "danger" : isLow ? "warning" : "sage"}>
                  {isOut ? "Out of stock" : isLow ? "Low stock" : "In stock"}
                </Badge>
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
                <Button variant="ghost" size="sm" onClick={() => openEdit(p)}>
                  <Pencil className="h-3.5 w-3.5" />
                </Button>
              </div>
            </Card>
          );
        })}

        {products.length === 0 && (
          <div className="col-span-3 text-center py-12 text-stone-400">
            <p className="text-sm">No products yet.</p>
            <button onClick={openAdd} className="mt-2 text-xs text-sage-600 hover:underline">+ Add your first product</button>
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

            <form onSubmit={modal === "add" ? submitAdd : submitEdit} className="px-6 py-5 space-y-4">
              <div>
                <label className={labelCls}>Product Name *</label>
                <input className={inputCls} placeholder="e.g. Green Wellness Shot" value={form.name} onChange={(e) => set("name", e.target.value)} required />
              </div>

              <div>
                <label className={labelCls}>Category</label>
                <select className={inputCls} value={form.category} onChange={(e) => set("category", e.target.value)}>
                  {CATEGORIES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelCls}>Price (PKR) *</label>
                  <input type="number" min="0" step="0.01" className={inputCls} placeholder="0" value={form.price} onChange={(e) => set("price", e.target.value)} required />
                </div>
                <div>
                  <label className={labelCls}>Low Stock Alert</label>
                  <input type="number" min="0" className={inputCls} placeholder="5" value={form.lowStockThreshold} onChange={(e) => set("lowStockThreshold", e.target.value)} />
                </div>
              </div>

              {modal === "add" && (
                <div>
                  <label className={labelCls}>Opening Stock</label>
                  <input type="number" min="0" className={inputCls} placeholder="0" value={form.stockQuantity} onChange={(e) => set("stockQuantity", e.target.value)} />
                </div>
              )}

              <div>
                <label className={labelCls}>Description <span className="text-stone-400">(optional)</span></label>
                <textarea className={cn(inputCls, "resize-none")} rows={2} placeholder="Brief description" value={form.description} onChange={(e) => set("description", e.target.value)} />
              </div>

              <div className="flex gap-3 pt-2 border-t border-stone-100">
                <Button type="button" variant="outline" className="flex-1" onClick={() => setModal(null)}>Cancel</Button>
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
              <button onClick={() => setModal(null)} className="text-stone-400 hover:text-stone-600"><X className="h-5 w-5" /></button>
            </div>
            <form onSubmit={submitRestock} className="px-6 py-5 space-y-4">
              <p className="text-sm text-stone-500">Current stock: <span className="font-semibold text-stone-800">{selected.stockQuantity} units</span></p>
              <div>
                <label className={labelCls}>Units to add *</label>
                <input type="number" min="1" className={inputCls} value={restockQty} onChange={(e) => setRestockQty(e.target.value)} autoFocus required />
              </div>
              <div className="flex gap-3 pt-2 border-t border-stone-100">
                <Button type="button" variant="outline" className="flex-1" onClick={() => setModal(null)}>Cancel</Button>
                <Button type="submit" className="flex-1" loading={saving}>
                  {saving ? "Saving…" : `Add ${restockQty || 0} units`}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
