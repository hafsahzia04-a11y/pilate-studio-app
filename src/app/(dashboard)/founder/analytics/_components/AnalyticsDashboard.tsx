"use client";

import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
} from "recharts";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { StatCard } from "@/components/ui/stat-card";
import { formatCurrency } from "@/lib/utils";
import { TrendingUp, Users, Calendar } from "lucide-react";

interface Props {
  revenueByWeek: { week: string; revenue: number }[];
  bookingStats: { status: string; count: number }[];
  packageSales: { name: string; count: number; revenue: number }[];
  occupancyData: { name: string; booked: number; capacity: number; pct: number }[];
  summary: { totalRevenue: number; activeMembers: number; totalBookings: number };
}

const BOOKING_COLORS: Record<string, string> = {
  attended: "#4A7A4A",
  confirmed: "#6B8F6B",
  cancelled: "#A8A29E",
  late_cancelled: "#D4A96A",
  no_show: "#C08080",
};

export function AnalyticsDashboard({
  revenueByWeek, bookingStats, packageSales, occupancyData, summary,
}: Props) {
  const pieData = bookingStats.map((b) => ({
    name: b.status.replace("_", " "),
    value: b.count,
    color: BOOKING_COLORS[b.status] ?? "#78716C",
  }));

  return (
    <div className="space-y-6">
      {/* Summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard
          title="Revenue (3 months)"
          value={formatCurrency(summary.totalRevenue)}
          icon={<TrendingUp className="h-5 w-5" />}
          color="sage"
        />
        <StatCard
          title="Active Members"
          value={summary.activeMembers}
          icon={<Users className="h-5 w-5" />}
          color="blue"
        />
        <StatCard
          title="Total Bookings"
          value={summary.totalBookings}
          icon={<Calendar className="h-5 w-5" />}
          color="purple"
        />
      </div>

      {/* Revenue chart */}
      <Card>
        <CardHeader>
          <CardTitle>Revenue by Week</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={revenueByWeek} margin={{ top: 0, right: 0, left: -10, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#F5F5F4" />
              <XAxis dataKey="week" tick={{ fontSize: 11, fill: "#78716C" }} />
              <YAxis tick={{ fontSize: 11, fill: "#78716C" }}
                tickFormatter={(v) => `${v / 1000}k`} />
              <Tooltip
                formatter={(v: number) => [formatCurrency(v), "Revenue"]}
                contentStyle={{ borderRadius: 12, border: "1px solid #E7E5E4", fontSize: 12 }}
              />
              <Bar dataKey="revenue" fill="#6B8F6B" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Booking breakdown */}
        <Card>
          <CardHeader>
            <CardTitle>Booking Outcomes</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie data={pieData} cx="50%" cy="50%" innerRadius={50} outerRadius={80}
                  dataKey="value" paddingAngle={3}>
                  {pieData.map((entry, i) => (
                    <Cell key={i} fill={entry.color} />
                  ))}
                </Pie>
                <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11 }} />
                <Tooltip contentStyle={{ borderRadius: 12, fontSize: 12 }} />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Class occupancy */}
        <Card>
          <CardHeader>
            <CardTitle>Top Classes by Attendance</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {occupancyData.map((c) => (
                <div key={c.name}>
                  <div className="flex justify-between text-xs text-stone-600 mb-1">
                    <span>{c.name}</span>
                    <span className="font-medium">{c.booked}/{c.capacity} ({c.pct}%)</span>
                  </div>
                  <div className="h-2 bg-stone-100 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full bg-sage-400 transition-all"
                      style={{ width: `${Math.min(c.pct, 100)}%` }}
                    />
                  </div>
                </div>
              ))}
              {occupancyData.length === 0 && (
                <p className="text-sm text-stone-400 text-center py-4">No completed classes yet</p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Package sales */}
      <Card>
        <CardHeader>
          <CardTitle>Package Sales (3 months)</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-stone-100">
                  <th className="text-left py-2 text-stone-500 font-medium">Package</th>
                  <th className="text-right py-2 text-stone-500 font-medium">Sold</th>
                  <th className="text-right py-2 text-stone-500 font-medium">Revenue</th>
                </tr>
              </thead>
              <tbody>
                {packageSales.map((p) => (
                  <tr key={p.name} className="border-b border-stone-50">
                    <td className="py-2.5 text-stone-700">{p.name}</td>
                    <td className="py-2.5 text-right text-stone-600">{p.count}</td>
                    <td className="py-2.5 text-right font-medium text-stone-800">
                      {formatCurrency(p.revenue)}
                    </td>
                  </tr>
                ))}
                {packageSales.length === 0 && (
                  <tr>
                    <td colSpan={3} className="py-6 text-center text-stone-400">
                      No package sales in this period
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
