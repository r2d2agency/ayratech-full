import { useState, useEffect, lazy, Suspense } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { MainLayout } from "@/components/layout/MainLayout";
import { Loader2 } from "lucide-react";
import { BrandingProvider } from "@sm/context/BrandingContext";
import { ThemeProvider } from "@sm/context/ThemeContext";
import type { ViewType } from "@sm/types";

// Lazy load all supermarket views
const DashboardView = lazy(() => import("@sm/views/DashboardView"));
const RHDashboardView = lazy(() => import("@sm/views/RHDashboardView"));
const ClientDashboardView = lazy(() => import("@sm/views/ClientDashboardView"));
const ClientsView = lazy(() => import("@sm/views/ClientsView"));
const ProductsView = lazy(() => import("@sm/views/ProductsView"));
const CategoriesView = lazy(() => import("@sm/views/CategoriesView"));
const BrandsView = lazy(() => import("@sm/views/BrandsView"));
const CompetitorsView = lazy(() => import("@sm/views/CompetitorsView"));
const LiveMapView = lazy(() => import("@sm/views/LiveMapView"));
const RoutesView = lazy(() => import("@sm/views/RoutesView"));
const ChecklistTemplatesView = lazy(() => import("@sm/views/ChecklistTemplatesView"));
const SupermarketsListView = lazy(() => import("@sm/views/SupermarketsListView"));
const SupermarketFormView = lazy(() => import("@sm/views/SupermarketFormView"));
const SupermarketGroupsView = lazy(() => import("@sm/views/SupermarketGroupsView"));
const SupermarketGroupFormView = lazy(() => import("@sm/views/SupermarketGroupFormView"));
const EmployeesView = lazy(() => import("@sm/views/EmployeesView"));
const SupervisorsView = lazy(() => import("@sm/views/SupervisorsView"));
const AppAccessView = lazy(() => import("@sm/views/AppAccessView"));
const DocumentsView = lazy(() => import("@sm/views/DocumentsView"));
const SystemLogsView = lazy(() => import("@sm/views/SystemLogsView"));
const RoutesReportView = lazy(() => import("@sm/views/RoutesReportView"));
const EvidenceReportView = lazy(() => import("@sm/views/EvidenceReportView"));
const PhotoGalleryView = lazy(() => import("@sm/views/PhotoGalleryView"));
const PhotoProcessingView = lazy(() => import("@sm/views/PhotoProcessingView"));
const AiConfigView = lazy(() => import("@sm/views/AiConfigView"));
const AiPromptsView = lazy(() => import("@sm/views/AiPromptsView"));
const TimeClockManagementView = lazy(() => import("@sm/views/TimeClockManagementView"));
const StockApprovalsView = lazy(() => import("@sm/views/StockApprovalsView"));
const StockValidationView = lazy(() => import("@sm/views/StockValidationView"));
const BreakagesReportView = lazy(() => import("@sm/views/BreakagesReportView"));
const AdminView = lazy(() => import("@sm/views/AdminView"));

const Loading = () => (
  <div className="flex items-center justify-center h-64">
    <Loader2 className="h-8 w-8 animate-spin text-primary" />
  </div>
);

const validViews = new Set<string>([
  "dashboard", "rh_dashboard", "client_dashboard", "clients", "products",
  "categories", "brands", "competitors", "live_map", "routes",
  "checklist_templates", "supermarkets_list", "supermarket_form",
  "supermarket_groups_list", "supermarket_group_form", "employees",
  "supervisors", "app_access", "documents", "logs", "reports_routes",
  "reports_evidence", "gallery", "photo_processing", "ai_config",
  "ai_prompts", "time_clock", "stock_approvals", "breakages_report", "admin",
]);

export default function SupermarketModule() {
  const { view } = useParams();
  const navigate = useNavigate();
  const [activeView, setActiveView] = useState<ViewType>(
    (view && validViews.has(view) ? view : "dashboard") as ViewType
  );

  useEffect(() => {
    if (view && validViews.has(view)) {
      setActiveView(view as ViewType);
    }
  }, [view]);

  const handleNavigate = (newView: ViewType) => {
    setActiveView(newView);
    navigate(`/supermarket/${newView}`, { replace: true });
  };

  const renderView = () => {
    switch (activeView) {
      case "dashboard": return <DashboardView onNavigate={handleNavigate} />;
      case "rh_dashboard": return <RHDashboardView />;
      case "client_dashboard": return <ClientDashboardView />;
      case "clients": return <ClientsView />;
      case "products": return <ProductsView />;
      case "categories": return <CategoriesView />;
      case "brands": return <BrandsView />;
      case "competitors": return <CompetitorsView />;
      case "live_map": return <LiveMapView onNavigate={handleNavigate} />;
      case "routes": return <RoutesView />;
      case "checklist_templates": return <ChecklistTemplatesView />;
      case "supermarkets_list": return <SupermarketsListView onNavigate={handleNavigate} />;
      case "supermarket_form": return <SupermarketFormView onNavigate={handleNavigate} />;
      case "supermarket_groups_list": return <SupermarketGroupsView onNavigate={handleNavigate} />;
      case "supermarket_group_form": return <SupermarketGroupFormView onNavigate={handleNavigate} />;
      case "employees": return <EmployeesView />;
      case "supervisors": return <SupervisorsView />;
      case "app_access": return <AppAccessView />;
      case "documents": return <DocumentsView />;
      case "logs": return <SystemLogsView />;
      case "reports_routes": return <RoutesReportView />;
      case "reports_evidence": return <EvidenceReportView />;
      case "gallery": return <PhotoGalleryView />;
      case "photo_processing": return <PhotoProcessingView />;
      case "ai_config": return <AiConfigView />;
      case "ai_prompts": return <AiPromptsView />;
      case "time_clock": return <TimeClockManagementView />;
      case "stock_approvals": return <StockApprovalsView />;
      case "breakages_report": return <BreakagesReportView />;
      case "admin": return <AdminView />;
      default: return <DashboardView onNavigate={handleNavigate} />;
    }
  };

  return (
    <MainLayout>
      <ThemeProvider>
        <BrandingProvider>
          <Suspense fallback={<Loading />}>
            {renderView()}
          </Suspense>
        </BrandingProvider>
      </ThemeProvider>
    </MainLayout>
  );
}
