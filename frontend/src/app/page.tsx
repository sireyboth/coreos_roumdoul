"use client";

import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

type HealthResponse = {
  status: string;
  app: string;
  time: string;
};

export default function Home() {
  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

    fetch(`${apiUrl}/api/health`)
      .then((res) => {
        if (!res.ok) throw new Error(`API responded with ${res.status}`);
        return res.json();
      })
      .then((data: HealthResponse) => setHealth(data))
      .catch((err: Error) => setError(err.message));
  }, []);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-8 bg-zinc-50 p-8 dark:bg-black">
      <div className="flex flex-col items-center gap-2 text-center">
        <h1 className="text-3xl font-semibold tracking-tight">Business OS</h1>
        <p className="text-zinc-500">Customer web application — Stage 0 foundation</p>
      </div>

      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Laravel API connection</CardTitle>
          <CardDescription>Checking connectivity to the backend</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          {health && (
            <>
              <div className="flex items-center gap-2">
                <span className="text-sm text-zinc-500">Status</span>
                <Badge>{health.status}</Badge>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm text-zinc-500">App</span>
                <span className="text-sm font-medium">{health.app}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm text-zinc-500">Server time</span>
                <span className="text-sm font-medium">{health.time}</span>
              </div>
            </>
          )}
          {error && (
            <div className="flex flex-col gap-1">
              <Badge variant="destructive">unreachable</Badge>
              <span className="text-sm text-zinc-500">{error}</span>
            </div>
          )}
          {!health && !error && (
            <span className="text-sm text-zinc-500">Connecting…</span>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
