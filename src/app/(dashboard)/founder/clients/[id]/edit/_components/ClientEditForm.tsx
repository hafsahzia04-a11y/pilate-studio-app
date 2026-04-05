"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import Link from "next/link";
import { ArrowLeft, Save, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface ClientEditProps {
  client: {
    id: string;
    fullName: string;
    email: string;
    phone: string | null;
    status: string;
    emergencyContactName: string | null;
    emergencyContactPhone: string | null;
    injuryNotes: string | null;
    medicalNotes: string | null;
    staffNotes: string | null;
    tags: string[];
  };
}

const INPUT_CLASS =
  "w-full rounded-xl border border-stone-200 bg-white px-3 py-2 text-sm text-stone-800 outline-none focus:border-sage-400 focus:ring-2 focus:ring-sage-100";

const LABEL_CLASS = "block text-xs font-medium text-stone-500 mb-1";

export function ClientEditForm({ client }: ClientEditProps) {
  const router = useRouter();

  const [fullName, setFullName] = useState(client.fullName);
  const [phone, setPhone] = useState(client.phone ?? "");
  const [status, setStatus] = useState(client.status);
  const [emergencyContactName, setEmergencyContactName] = useState(
    client.emergencyContactName ?? ""
  );
  const [emergencyContactPhone, setEmergencyContactPhone] = useState(
    client.emergencyContactPhone ?? ""
  );
  const [injuryNotes, setInjuryNotes] = useState(client.injuryNotes ?? "");
  const [medicalNotes, setMedicalNotes] = useState(client.medicalNotes ?? "");
  const [staffNotes, setStaffNotes] = useState(client.staffNotes ?? "");
  const [tagsInput, setTagsInput] = useState(client.tags.join(", "));
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const parsedTags = tagsInput
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean);

  async function handleSave() {
    if (!fullName.trim()) {
      toast.error("Full name is required");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch(`/api/clients/${client.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fullName: fullName.trim(),
          phone: phone.trim() || null,
          status,
          emergencyContactName: emergencyContactName.trim() || null,
          emergencyContactPhone: emergencyContactPhone.trim() || null,
          injuryNotes: injuryNotes.trim() || null,
          medicalNotes: medicalNotes.trim() || null,
          staffNotes: staffNotes.trim() || null,
          tags: parsedTags,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to save");
      toast.success("Client updated");
      router.push(`/founder/clients/${client.id}`);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    const confirmed = window.confirm(
      `Mark ${client.fullName} as "Left"? This will set their status to "left".`
    );
    if (!confirmed) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/clients/${client.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "left" }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed");
      toast.success(`${client.fullName} marked as left`);
      router.push("/founder/clients");
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed");
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="space-y-5 max-w-2xl mx-auto animate-fade-in">
      {/* Back link */}
      <Link
        href={`/founder/clients/${client.id}`}
        className="inline-flex items-center gap-1.5 text-sm text-stone-500 hover:text-stone-800 transition-colors"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to {client.fullName}
      </Link>

      {/* Header */}
      <div>
        <h1 className="text-xl font-bold text-stone-900">Edit Client</h1>
        <p className="text-sm text-stone-500 mt-0.5">{client.email}</p>
      </div>

      {/* Basic Info */}
      <Card className="p-5 space-y-4">
        <h2 className="text-sm font-semibold text-stone-700">Basic Information</h2>

        <div>
          <label className={LABEL_CLASS}>Full Name *</label>
          <input
            type="text"
            className={INPUT_CLASS}
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            required
          />
        </div>

        <div>
          <label className={LABEL_CLASS}>Phone</label>
          <input
            type="text"
            className={INPUT_CLASS}
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="+1 234 567 8900"
          />
        </div>

        <div>
          <label className={LABEL_CLASS}>Status</label>
          <select
            className={INPUT_CLASS}
            value={status}
            onChange={(e) => setStatus(e.target.value)}
          >
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
            <option value="left">Left (client has left the studio)</option>
          </select>
        </div>
      </Card>

      {/* Emergency Contact */}
      <Card className="p-5 space-y-4">
        <h2 className="text-sm font-semibold text-stone-700">Emergency Contact</h2>

        <div>
          <label className={LABEL_CLASS}>Contact Name</label>
          <input
            type="text"
            className={INPUT_CLASS}
            value={emergencyContactName}
            onChange={(e) => setEmergencyContactName(e.target.value)}
            placeholder="Jane Doe"
          />
        </div>

        <div>
          <label className={LABEL_CLASS}>Contact Phone</label>
          <input
            type="text"
            className={INPUT_CLASS}
            value={emergencyContactPhone}
            onChange={(e) => setEmergencyContactPhone(e.target.value)}
            placeholder="+1 234 567 8900"
          />
        </div>
      </Card>

      {/* Medical & Notes */}
      <Card className="p-5 space-y-4">
        <h2 className="text-sm font-semibold text-stone-700">Medical & Notes</h2>

        <div>
          <label className={LABEL_CLASS}>Injury Notes</label>
          <textarea
            className={INPUT_CLASS}
            rows={3}
            value={injuryNotes}
            onChange={(e) => setInjuryNotes(e.target.value)}
            placeholder="Any injuries the instructor should be aware of..."
          />
        </div>

        <div>
          <label className={LABEL_CLASS}>Medical Notes</label>
          <textarea
            className={INPUT_CLASS}
            rows={3}
            value={medicalNotes}
            onChange={(e) => setMedicalNotes(e.target.value)}
            placeholder="Medical conditions, medications, etc..."
          />
        </div>

        <div>
          <label className={LABEL_CLASS}>Staff Notes</label>
          <textarea
            className={INPUT_CLASS}
            rows={3}
            value={staffNotes}
            onChange={(e) => setStaffNotes(e.target.value)}
            placeholder="Internal notes visible to staff only..."
          />
        </div>
      </Card>

      {/* Tags */}
      <Card className="p-5 space-y-3">
        <h2 className="text-sm font-semibold text-stone-700">Tags</h2>
        <div>
          <label className={LABEL_CLASS}>Tags (comma-separated)</label>
          <input
            type="text"
            className={INPUT_CLASS}
            value={tagsInput}
            onChange={(e) => setTagsInput(e.target.value)}
            placeholder="vip, founding member, prenatal"
          />
        </div>
        {parsedTags.length > 0 && (
          <div className="flex flex-wrap gap-1.5 pt-1">
            {parsedTags.map((tag) => (
              <Badge key={tag} variant="outline" className="text-xs">
                {tag}
              </Badge>
            ))}
          </div>
        )}
      </Card>

      {/* Actions */}
      <div className="flex items-center justify-between gap-3 pb-8">
        <Button
          variant="destructive"
          size="sm"
          onClick={handleDelete}
          loading={deleting}
          disabled={saving}
        >
          <Trash2 className="h-3.5 w-3.5" />
          Delete Client
        </Button>

        <div className="flex gap-2">
          <Link href={`/founder/clients/${client.id}`}>
            <Button variant="outline" size="sm" disabled={saving || deleting}>
              Cancel
            </Button>
          </Link>
          <Button
            size="sm"
            onClick={handleSave}
            loading={saving}
            disabled={deleting}
          >
            <Save className="h-3.5 w-3.5" />
            Save Changes
          </Button>
        </div>
      </div>
    </div>
  );
}
