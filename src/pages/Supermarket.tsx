import { useEffect, useMemo } from "react";
import { useParams } from "react-router-dom";
import { MainLayout } from "@/components/layout/MainLayout";
import { getAuthToken } from "@/lib/api";

const allowedViews = new Set([
  "dashboard",
  "live_map",
  "routes",
  "supermarkets_list",
  "stock_approvals",
  "breakages_report",
  "reports_routes",
  "reports_evidence",
  "employees",
  "supervisors",
  "app_access",
  "documents",
  "logs",
  "time_clock",
]);

export default function Supermarket() {
  const { view } = useParams();

  useEffect(() => {
    const authToken = getAuthToken();
    if (authToken) localStorage.setItem("token", authToken);
  }, []);

  const safeView = useMemo(() => {
    if (!view) return "dashboard";
    return allowedViews.has(view) ? view : "dashboard";
  }, [view]);

  const iframeSrc = useMemo(() => {
    const url = new URL(window.location.origin);
    url.pathname = `/manager/view/${safeView}`;
    url.searchParams.set("embedded", "1");
    return url.toString();
  }, [safeView]);

  return (
    <MainLayout>
      <div className="w-full h-[calc(100vh-7rem)] rounded-lg overflow-hidden border border-border bg-background">
        <iframe
          title="Supermarket Manager"
          src={iframeSrc}
          className="w-full h-full"
        />
      </div>
    </MainLayout>
  );
}

