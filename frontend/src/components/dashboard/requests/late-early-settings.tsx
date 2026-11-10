"use client";

import { useEffect, useState } from "react";
import { AlarmClock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { ChoiceCards, FormField, FormSection, ToggleRow } from "@/components/dashboard/shared/form-section";
import { api, type LateEarlySettings } from "@/lib/api";
import { useT } from "@/lib/i18n";
import { notifyError, notifySuccess } from "@/lib/notify";

/**
 * The rules for asking to arrive late or leave early: on or off, paid or not,
 * how many a month. The switch and the paid/unpaid choice save straight away;
 * the monthly limit saves with its own button.
 */
export function LateEarlySettingsCard() {
  const t = useT();
  const [settings, setSettings] = useState<LateEarlySettings | null>(null);
  const [limit, setLimit] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api.leave
      .lateEarlySettings()
      .then((s) => {
        setSettings(s);
        setLimit(s.monthly_limit === null ? "" : String(s.monthly_limit));
      })
      .catch(notifyError);
  }, []);

  async function save(patch: Partial<Omit<LateEarlySettings, "type">>) {
    setSaving(true);
    try {
      const saved = await api.leave.updateLateEarlySettings(patch);
      setSettings(saved);
      setLimit(saved.monthly_limit === null ? "" : String(saved.monthly_limit));
      notifySuccess(t("leave.policyPage.lateEarlySaved"));
    } catch (err) {
      notifyError(err);
    } finally {
      setSaving(false);
    }
  }

  if (!settings) return <Skeleton className="h-64 w-full rounded-xl" />;

  const savedLimit = settings.monthly_limit === null ? "" : String(settings.monthly_limit);

  return (
    <FormSection icon={AlarmClock} tone="from-rose-500 to-pink-500" title={t("leave.shared.lateEarly")} hint={t("leave.policyPage.lateEarlyHint")}>
      <ToggleRow id="le-active" label={t("leave.policyPage.staffCanAsk")} checked={settings.is_active} disabled={saving} onChange={(v) => save({ is_active: v })} />

      <FormField label={t("leave.policyPage.excused")}>
        <ChoiceCards
          name="le-pay"
          value={String(settings.pay_percent)}
          onChange={(v) => !saving && save({ pay_percent: Number(v) as 0 | 100 })}
          options={[
            { value: "100", label: t("leave.policyPage.excusedPaid") },
            { value: "0", label: t("leave.policyPage.excusedUnpaid") },
          ]}
        />
      </FormField>

      <form
        className="flex flex-wrap items-end gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          save({ monthly_limit: limit.trim() === "" ? null : Number(limit) });
        }}
      >
        <div className="w-full sm:w-56">
          <FormField id="le-limit" label={t("leave.policyPage.monthlyLimit")}>
            <Input
              id="le-limit"
              type="number"
              min={1}
              max={31}
              step={1}
              value={limit}
              onChange={(e) => setLimit(e.target.value)}
              placeholder={t("leave.policyPage.rules.noLimit")}
            />
          </FormField>
        </div>
        {/* Only offered once the number differs from what's saved. */}
        {limit !== savedLimit && (
          <Button type="submit" disabled={saving}>
            {t("common.action.save")}
          </Button>
        )}
      </form>
    </FormSection>
  );
}
