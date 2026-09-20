"use client";

import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useMe } from "@/contexts/me-context";

const MODULE_LABELS: Record<string, string> = {
  attendance: "Attendance",
  hr: "HR",
  payroll: "Payroll",
  pos: "POS",
  inventory: "Inventory",
  crm: "CRM",
  accounting: "Accounting",
};

export default function DashboardPage() {
  const { me } = useMe();

  if (!me) return null;

  return (
    <div className="p-8">
      <div className="mx-auto flex max-w-3xl flex-col gap-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            {me.company?.name ?? "Business OS"}
          </h1>
          <p className="text-sm text-muted-foreground">
            Signed in as {me.user.name} · {me.roles.join(", ") || "no role"}
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Company</CardTitle>
            <CardDescription>Your organization&apos;s status on the platform</CardDescription>
          </CardHeader>
          <CardContent className="flex items-center gap-3">
            <Badge variant={me.company?.status === "active" ? "default" : "secondary"}>
              {me.company?.status ?? "unknown"}
            </Badge>
            <span className="text-sm text-muted-foreground">{me.company?.slug}</span>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Modules</CardTitle>
            <CardDescription>
              What your plan and any platform overrides currently grant you
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {Object.entries(me.modules).map(([key, enabled]) => (
                <div
                  key={key}
                  className={`flex items-center justify-between rounded-lg border p-3 ${
                    enabled ? "border-border bg-card" : "border-border bg-muted opacity-50"
                  }`}
                >
                  <span className="text-sm font-medium">
                    {MODULE_LABELS[key] ?? key}
                  </span>
                  {enabled ? (
                    <Badge>On</Badge>
                  ) : (
                    <Badge variant="secondary">Off</Badge>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
