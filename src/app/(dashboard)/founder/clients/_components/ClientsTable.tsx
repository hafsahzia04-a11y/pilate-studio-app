"use client";

import { useState } from "react";
import Link from "next/link";
import toast from "react-hot-toast";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { Search, Plus, Filter, UserPlus, Eye, Edit2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Modal } from "@/components/ui/modal";
import { Card } from "@/components/ui/card";
import { cn, formatDate, paymentStatusLabel } from "@/lib/utils";
import type { ClientWithPackage } from "@/types";

interface Props {
  clients: ClientWithPackage[];
  isStaff?: boolean;
}

interface AddClientForm {
  fullName: string;
  email: string;
  phone: string;
  password: string;
}

type FilterStatus = "all" | "active" | "no_package" | "overdue" | "expiring";

function paymentBadgeVariant(status: string): "sage" | "danger" | "warning" | "default" {
  if (status === "paid") return "sage";
  if (status === "overdue") return "danger";
  if (status === "partial") return "warning";
  return "default";
}

export function ClientsTable({ clients }: Props) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<FilterStatus>("all");
  const [addOpen, setAddOpen] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<AddClientForm>();

  const filtered = clients.filter((c) => {
    const q = search.toLowerCase();
    const matchesSearch =
      !q ||
      c.fullName.toLowerCase().includes(q) ||
      c.email.toLowerCase().includes(q) ||
      (c.phone ?? "").includes(q);

    let matchesFilter = true;
    if (filter === "active") matchesFilter = !!c.activePackage;
    else if (filter === "no_package") matchesFilter = !c.activePackage;
    else if (filter === "overdue")
      matchesFilter = c.activePackage?.paymentStatus === "overdue";
    else if (filter === "expiring") {
      if (!c.activePackage) {
        matchesFilter = false;
      } else {
        const daysLeft =
          (new Date(c.activePackage.expiryDate).getTime() - Date.now()) /
          86400000;
        matchesFilter = daysLeft <= 7 && daysLeft >= 0;
      }
    }

    return matchesSearch && matchesFilter;
  });

  async function onAddClient(values: AddClientForm) {
    try {
      const res = await fetch("/api/clients", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to create client");
      toast.success("Client created successfully");
      setAddOpen(false);
      reset();
      router.refresh();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Something went wrong");
    }
  }

  const filterOptions: { label: string; value: FilterStatus }[] = [
    { label: "All", value: "all" },
    { label: "Active Package", value: "active" },
    { label: "No Package", value: "no_package" },
    { label: "Overdue", value: "overdue" },
    { label: "Expiring Soon", value: "expiring" },
  ];

  return (
    <div className="space-y-4 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-stone-900">Clients</h1>
          <p className="text-sm text-stone-500">{clients.length} total members</p>
        </div>
        <Button onClick={() => setAddOpen(true)} className="flex-shrink-0">
          <UserPlus className="h-4 w-4" />
          Add Client
        </Button>
      </div>

      {/* Search + Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-stone-400" />
          <input
            type="search"
            placeholder="Search by name, email or phone…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full h-10 pl-9 pr-4 rounded-xl border border-stone-200 bg-white text-sm text-stone-800 placeholder:text-stone-400 focus:outline-none focus:border-sage-400 focus:ring-2 focus:ring-sage-100"
          />
        </div>
        <div className="flex items-center gap-2 overflow-x-auto scroll-x-hidden pb-0.5">
          <Filter className="h-4 w-4 text-stone-400 flex-shrink-0" />
          {filterOptions.map((opt) => (
            <button
              key={opt.value}
              onClick={() => setFilter(opt.value)}
              className={cn(
                "px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors",
                filter === opt.value
                  ? "bg-sage-500 text-white"
                  : "bg-white border border-stone-200 text-stone-600 hover:bg-cream-100"
              )}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Results count */}
      {search || filter !== "all" ? (
        <p className="text-xs text-stone-500">
          Showing {filtered.length} of {clients.length} clients
        </p>
      ) : null}

      {/* Table / Card list */}
      {filtered.length === 0 ? (
        <Card className="p-12 text-center">
          <p className="text-stone-400">No clients match your search.</p>
        </Card>
      ) : (
        <>
          {/* Desktop table */}
          <div className="hidden md:block">
            <Card className="overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-stone-100 bg-cream-50">
                      <th className="text-left px-4 py-3 text-xs font-semibold text-stone-500 uppercase tracking-wide">
                        Name
                      </th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-stone-500 uppercase tracking-wide">
                        Contact
                      </th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-stone-500 uppercase tracking-wide">
                        Package
                      </th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-stone-500 uppercase tracking-wide">
                        Credits
                      </th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-stone-500 uppercase tracking-wide">
                        Expiry
                      </th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-stone-500 uppercase tracking-wide">
                        Payment
                      </th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-stone-500 uppercase tracking-wide">
                        Tags
                      </th>
                      <th className="px-4 py-3" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-stone-100">
                    {filtered.map((client) => (
                      <tr
                        key={client.id}
                        className="hover:bg-cream-50 transition-colors"
                      >
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-sage-100 text-sage-700 flex items-center justify-center text-xs font-semibold flex-shrink-0">
                              {client.fullName
                                .split(" ")
                                .slice(0, 2)
                                .map((n) => n[0])
                                .join("")
                                .toUpperCase()}
                            </div>
                            <div>
                              <p className="font-medium text-stone-800">
                                {client.fullName}
                              </p>
                              {client.clientProfile?.waiverSignedAt && (
                                <p className="text-xs text-sage-600">
                                  Waiver signed
                                </p>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-stone-600">
                          <p className="truncate max-w-[180px]">{client.email}</p>
                          {client.phone && (
                            <p className="text-xs text-stone-400">{client.phone}</p>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          {client.activePackage ? (
                            <div>
                              <p className="font-medium text-stone-800 truncate max-w-[160px]">
                                {client.activePackage.package.name}
                              </p>
                              <Badge
                                variant={
                                  client.activePackage.package.type === "membership"
                                    ? "sage"
                                    : "default"
                                }
                                className="mt-0.5"
                              >
                                {client.activePackage.package.type}
                              </Badge>
                            </div>
                          ) : (
                            <span className="text-stone-400 text-xs">No package</span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          {client.activePackage ? (
                            <span
                              className={cn(
                                "font-semibold",
                                client.activePackage.remainingCredits === 0
                                  ? "text-red-500"
                                  : client.activePackage.remainingCredits <= 2
                                  ? "text-amber-600"
                                  : "text-sage-700"
                              )}
                            >
                              {client.activePackage.remainingCredits}
                              <span className="text-stone-400 font-normal text-xs">
                                {" "}
                                / {client.activePackage.totalCredits}
                              </span>
                            </span>
                          ) : (
                            <span className="text-stone-400">—</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-stone-600 text-xs">
                          {client.activePackage
                            ? formatDate(client.activePackage.expiryDate)
                            : "—"}
                        </td>
                        <td className="px-4 py-3">
                          {client.activePackage ? (
                            <Badge
                              variant={paymentBadgeVariant(
                                client.activePackage.paymentStatus
                              )}
                            >
                              {paymentStatusLabel(
                                client.activePackage.paymentStatus
                              )}
                            </Badge>
                          ) : (
                            <span className="text-stone-400">—</span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex flex-wrap gap-1">
                            {(client.clientProfile?.tags ?? [])
                              .slice(0, 2)
                              .map((tag) => (
                                <Badge key={tag} variant="outline" className="text-xs">
                                  {tag}
                                </Badge>
                              ))}
                            {(client.clientProfile?.tags ?? []).length > 2 && (
                              <Badge variant="outline" className="text-xs">
                                +{(client.clientProfile?.tags ?? []).length - 2}
                              </Badge>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <Link href={`/founder/clients/${client.id}`}>
                              <Button variant="ghost" size="icon-sm" title="View">
                                <Eye className="h-3.5 w-3.5" />
                              </Button>
                            </Link>
                            <Link href={`/founder/clients/${client.id}/edit`}>
                              <Button variant="ghost" size="icon-sm" title="Edit">
                                <Edit2 className="h-3.5 w-3.5" />
                              </Button>
                            </Link>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          </div>

          {/* Mobile cards */}
          <div className="md:hidden space-y-3">
            {filtered.map((client) => (
              <Card key={client.id} className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-10 h-10 rounded-full bg-sage-100 text-sage-700 flex items-center justify-center text-sm font-semibold flex-shrink-0">
                      {client.fullName
                        .split(" ")
                        .slice(0, 2)
                        .map((n) => n[0])
                        .join("")
                        .toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <p className="font-semibold text-stone-900 truncate">
                        {client.fullName}
                      </p>
                      <p className="text-xs text-stone-500 truncate">{client.email}</p>
                    </div>
                  </div>
                  <div className="flex gap-2 flex-shrink-0">
                    <Link href={`/founder/clients/${client.id}`}>
                      <Button variant="outline" size="sm">
                        <Eye className="h-3.5 w-3.5" />
                      </Button>
                    </Link>
                  </div>
                </div>
                {client.activePackage && (
                  <div className="mt-3 pt-3 border-t border-stone-100 flex items-center justify-between text-xs">
                    <span className="text-stone-600">
                      {client.activePackage.package.name}
                    </span>
                    <div className="flex items-center gap-2">
                      <span className="text-stone-500">
                        {client.activePackage.remainingCredits} credits
                      </span>
                      <Badge
                        variant={paymentBadgeVariant(
                          client.activePackage.paymentStatus
                        )}
                      >
                        {paymentStatusLabel(client.activePackage.paymentStatus)}
                      </Badge>
                    </div>
                  </div>
                )}
                {(client.clientProfile?.tags ?? []).length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1">
                    {client.clientProfile!.tags.map((tag) => (
                      <Badge key={tag} variant="outline" className="text-xs">
                        {tag}
                      </Badge>
                    ))}
                  </div>
                )}
              </Card>
            ))}
          </div>
        </>
      )}

      {/* Add Client Modal */}
      <Modal
        open={addOpen}
        onOpenChange={setAddOpen}
        title="Add New Client"
        description="Create a client account. They'll be able to log in with these credentials."
      >
        <form onSubmit={handleSubmit(onAddClient)} className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-stone-700">Full Name</label>
            <input
              type="text"
              placeholder="Jane Smith"
              {...register("fullName", { required: "Name is required" })}
              className="w-full h-10 px-3 rounded-xl border border-stone-200 bg-white text-sm focus:outline-none focus:border-sage-400 focus:ring-2 focus:ring-sage-100"
            />
            {errors.fullName && (
              <p className="text-xs text-red-500">{errors.fullName.message}</p>
            )}
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium text-stone-700">Email Address</label>
            <input
              type="email"
              placeholder="jane@example.com"
              {...register("email", {
                required: "Email is required",
                pattern: {
                  value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
                  message: "Invalid email address",
                },
              })}
              className="w-full h-10 px-3 rounded-xl border border-stone-200 bg-white text-sm focus:outline-none focus:border-sage-400 focus:ring-2 focus:ring-sage-100"
            />
            {errors.email && (
              <p className="text-xs text-red-500">{errors.email.message}</p>
            )}
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium text-stone-700">Phone (optional)</label>
            <input
              type="tel"
              placeholder="+971 50 123 4567"
              {...register("phone")}
              className="w-full h-10 px-3 rounded-xl border border-stone-200 bg-white text-sm focus:outline-none focus:border-sage-400 focus:ring-2 focus:ring-sage-100"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium text-stone-700">
              Temporary Password
            </label>
            <input
              type="password"
              placeholder="Min. 8 characters"
              {...register("password", {
                required: "Password is required",
                minLength: { value: 8, message: "Password must be at least 8 characters" },
              })}
              className="w-full h-10 px-3 rounded-xl border border-stone-200 bg-white text-sm focus:outline-none focus:border-sage-400 focus:ring-2 focus:ring-sage-100"
            />
            {errors.password && (
              <p className="text-xs text-red-500">{errors.password.message}</p>
            )}
          </div>

          <div className="flex gap-3 pt-2">
            <Button
              type="button"
              variant="outline"
              className="flex-1"
              onClick={() => {
                setAddOpen(false);
                reset();
              }}
            >
              Cancel
            </Button>
            <Button type="submit" className="flex-1" loading={isSubmitting}>
              <Plus className="h-4 w-4" />
              Create Client
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
