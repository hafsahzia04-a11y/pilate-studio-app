import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatCurrency, formatDateTime } from "@/lib/utils";
import { InventoryManager } from "./_components/InventoryActions";

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

  return (
    <DashboardLayout role={profile.role as "founder"} userName={profile.fullName} userEmail={profile.email} pageTitle="Inventory">
      <div className="space-y-5">
        <InventoryManager initialProducts={products.map(p => ({
          id: p.id,
          name: p.name,
          description: p.description,
          price: Number(p.price),
          stockQuantity: p.stockQuantity,
          lowStockThreshold: p.lowStockThreshold,
          category: p.category,
          isActive: p.isActive,
        }))} />

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
