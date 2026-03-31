"use client";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import toast from "react-hot-toast";

export function InventoryActions({ productId, productName, price }: { productId: string; productName: string; price: number }) {
  const [loading, setLoading] = useState<string | null>(null);

  async function restock() {
    const qty = prompt(`How many units of "${productName}" to add?`);
    if (!qty || isNaN(Number(qty))) return;
    setLoading("restock");
    const res = await fetch("/api/inventory", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "restock", productId, quantity: Number(qty) }) });
    setLoading(null);
    if (res.ok) { toast.success(`Added ${qty} units`); window.location.reload(); }
    else toast.error("Restock failed");
  }

  return (
    <div className="flex gap-2">
      <Button variant="outline" size="sm" className="flex-1" onClick={restock} loading={loading === "restock"}>Restock</Button>
    </div>
  );
}
