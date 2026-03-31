import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatCurrency, formatDateTime } from "@/lib/utils";
import { InventoryActions } from "./_components/InventoryActions";
import { AlertTriangle } from "lucide-react";

export const metadata = { title: "Inventory" };

export default async function InventoryPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const profile = await prisma.profile.findUnique({ where: { id: user.id }, select: { fullName: true, email: true, role: true } });
  if (!profile || !["founder", "staff"].includes(profile.role)) redirect("/login");

  const products = await prisma.product.findMany({
    where: { isActive: true },
    include: { _count: { select: { transactions: true } } },
    orderBy: { name: "asc" },
  });

  const recentTx = await prisma.productTransaction.findMany({
    include: {
      product: { select: { name: true } },
      client: { select: { fullName: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 20,
  });

  const lowStock = products.filter(p => p.stockQuantity <= p.lowStockThreshold);

  return (
    <DashboardLayout role={profile.role as "founder"} userName={profile.fullName} userEmail={profile.email} pageTitle="Inventory">
      <div className="space-y-5">
        {lowStock.length > 0 && (
          <div className="flex items-center gap-3 bg-amber-50 border border-amber-200 rounded-2xl px-4 py-3">
            <AlertTriangle className="h-4 w-4 text-amber-600 flex-shrink-0" />
            <p className="text-sm text-amber-700 font-medium">{lowStock.length} product{lowStock.length > 1 ? "s" : ""} running low: {lowStock.map(p => p.name).join(", ")}</p>
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {products.map(product => {
            const isLow = product.stockQuantity <= product.lowStockThreshold;
            const isOut = product.stockQuantity === 0;
            return (
              <Card key={product.id} className="p-4">
                <div className="flex items-start justify-between gap-2 mb-3">
                  <div>
                    <p className="font-semibold text-stone-900">{product.name}</p>
                    <p className="text-xs text-stone-500 mt-0.5 capitalize">{product.category ?? "Product"}</p>
                  </div>
                  <Badge variant={isOut ? "danger" : isLow ? "warning" : "sage"}>
                    {isOut ? "Out of stock" : isLow ? "Low stock" : "In stock"}
                  </Badge>
                </div>
                <div className="flex justify-between items-end">
                  <div>
                    <p className="text-2xl font-bold text-stone-900">{product.stockQuantity}</p>
                    <p className="text-xs text-stone-400">units remaining</p>
                  </div>
                  <p className="text-sm font-semibold text-sage-600">{formatCurrency(Number(product.price))}</p>
                </div>
                <div className="mt-3 pt-3 border-t border-stone-50">
                  <InventoryActions productId={product.id} productName={product.name} price={Number(product.price)} />
                </div>
              </Card>
            );
          })}
        </div>

        <Card>
          <CardHeader><CardTitle>Recent Transactions</CardTitle></CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-stone-100">
                    {["Time","Client","Product","Type","Qty","Amount"].map(h => (
                      <th key={h} className="text-left px-4 py-3 text-xs font-medium text-stone-500 uppercase tracking-wide">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {recentTx.map(tx => (
                    <tr key={tx.id} className="border-b border-stone-50">
                      <td className="px-4 py-3 text-xs text-stone-500 whitespace-nowrap">{formatDateTime(tx.createdAt)}</td>
                      <td className="px-4 py-3 text-sm text-stone-700">{tx.client.fullName}</td>
                      <td className="px-4 py-3 text-sm text-stone-700">{tx.product.name}</td>
                      <td className="px-4 py-3">
                        <Badge variant={tx.type === "complimentary" ? "sage" : tx.type === "purchased" ? "blue" : "default"} className="capitalize">{tx.type}</Badge>
                      </td>
                      <td className="px-4 py-3 text-sm text-stone-600">{tx.quantity}</td>
                      <td className="px-4 py-3 text-sm font-medium text-stone-800">
                        {tx.type === "complimentary" ? <span className="text-sage-600">Free</span> : formatCurrency(Number(tx.totalAmount))}
                      </td>
                    </tr>
                  ))}
                  {recentTx.length === 0 && <tr><td colSpan={6} className="text-center py-8 text-stone-400">No transactions yet</td></tr>}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
