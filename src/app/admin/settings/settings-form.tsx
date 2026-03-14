"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, Save, CheckCircle } from "lucide-react";

interface Setting {
  id: string;
  key: string;
  value: string;
  description: string | null;
}

interface AdminSettingsFormProps {
  settings: Setting[];
}

export function AdminSettingsForm({ settings }: AdminSettingsFormProps) {
  const [values, setValues] = useState<Record<string, string>>(
    Object.fromEntries(settings.map((s) => [s.key, s.value]))
  );
  const [saving, setSaving] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const supabase = createClient();

  async function saveSetting(key: string) {
    setSaving(key);
    setErrors((prev) => ({ ...prev, [key]: "" }));

    const { error } = await supabase
      .from("admin_settings")
      .update({ value: values[key], updated_at: new Date().toISOString() })
      .eq("key", key);

    setSaving(null);

    if (error) {
      setErrors((prev) => ({ ...prev, [key]: error.message }));
    } else {
      setSaved(key);
      setTimeout(() => setSaved(null), 2000);
    }
  }

  return (
    <div className="space-y-4">
      {settings.map((setting) => (
        <div key={setting.key} className="space-y-1.5">
          <div className="flex items-center justify-between">
            <div>
              <label className="text-sm font-medium text-gray-800">
                {setting.key
                  .replace(/_/g, " ")
                  .replace(/\b\w/g, (l) => l.toUpperCase())}
              </label>
              {setting.description && (
                <p className="text-xs text-gray-500">{setting.description}</p>
              )}
            </div>
            <code className="text-xs text-gray-400">{setting.key}</code>
          </div>
          <div className="flex gap-2">
            <Input
              value={values[setting.key] ?? ""}
              onChange={(e) =>
                setValues((prev) => ({ ...prev, [setting.key]: e.target.value }))
              }
              className="flex-1"
            />
            <Button
              size="sm"
              variant="outline"
              onClick={() => saveSetting(setting.key)}
              disabled={saving === setting.key}
            >
              {saving === setting.key ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : saved === setting.key ? (
                <CheckCircle className="h-3.5 w-3.5 text-green-500" />
              ) : (
                <Save className="h-3.5 w-3.5" />
              )}
              {saved === setting.key ? "Saved" : "Save"}
            </Button>
          </div>
          {errors[setting.key] && (
            <p className="text-xs text-red-600">{errors[setting.key]}</p>
          )}
        </div>
      ))}
    </div>
  );
}
