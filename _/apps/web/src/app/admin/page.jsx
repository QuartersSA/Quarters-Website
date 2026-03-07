"use client";

import { useState, useMemo } from "react";
import { Sidebar } from "@/components/Admin/Sidebar";
import { StatisticsCards } from "@/components/Dashboard/StatisticsCards";
import { WelcomeBanner } from "@/components/Dashboard/WelcomeBanner";
import { SmartAlerts } from "@/components/Dashboard/SmartAlerts";
import { OperationsTimeline } from "@/components/Dashboard/OperationsTimeline";
import { BranchPerformanceCard } from "@/components/Dashboard/BranchPerformanceCard";
import { HealthScoreCard } from "@/components/Dashboard/HealthScoreCard";
import { MonthlyMovementReport } from "@/components/Dashboard/MonthlyMovementReport";
import { MonthlySummaryExport } from "@/components/Dashboard/MonthlySummaryExport";
import { AdminInfoBanner } from "@/components/Dashboard/AdminInfoBanner";
import { ItemHistoryChart } from "@/components/Dashboard/ItemHistoryChart";
import { ItemAnalysisChart } from "@/components/Dashboard/ItemAnalysisChart";
import { VarianceChart } from "@/components/Dashboard/VarianceChart";
import { AdditionalInfoCards } from "@/components/Dashboard/AdditionalInfoCards";
import { useAdminDashboardAuth } from "@/hooks/useAdminDashboardAuth";
import { useAdminDashboardData } from "@/hooks/useAdminDashboardData";
import { useDashboardAnalytics } from "@/hooks/useDashboardAnalytics";
import { useItemHistory } from "@/hooks/useItemHistory";
import { useItemAnalysis } from "@/hooks/useItemAnalysis";
import { useVarianceData } from "@/hooks/useVarianceData";
import {
  calculateDashboardStats,
  getActiveItems,
  getSelectedItemName,
} from "@/utils/dashboardCalculations";
import {
  processItemHistoryChartData,
  processItemAnalysisChartData,
  processVarianceChartData,
  checkVarianceHasOpening,
} from "@/utils/chartDataProcessing";
import { ws } from "@/components/Workspace/ui";

export default function AdminDashboard() {
  const { isAuthenticated, handleLogout } = useAdminDashboardAuth();

  const [selectedItemId, setSelectedItemId] = useState("");
  const [selectedBranchId, setSelectedBranchId] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  // Item Analysis chart state
  const [analysisItemId, setAnalysisItemId] = useState("");
  const [analysisBranchIds, setAnalysisBranchIds] = useState([]);
  const [analysisFrom, setAnalysisFrom] = useState("");
  const [analysisTo, setAnalysisTo] = useState("");

  const [varianceItemId, setVarianceItemId] = useState("");
  const [varianceBranchId, setVarianceBranchId] = useState("");
  const [varianceFrom, setVarianceFrom] = useState("");
  const [varianceTo, setVarianceTo] = useState("");

  const { operations, branches, items, employees } =
    useAdminDashboardData(isAuthenticated);

  const { analytics } = useDashboardAnalytics(isAuthenticated);

  const { itemHistory, isHistoryLoading, historyError } = useItemHistory(
    isAuthenticated,
    selectedItemId,
    selectedBranchId,
    dateFrom,
    dateTo,
  );

  const { analysisData, isAnalysisLoading, analysisError } = useItemAnalysis(
    isAuthenticated,
    analysisItemId,
    analysisBranchIds,
    analysisFrom,
    analysisTo,
  );

  const { variance, varianceLoading, varianceError } = useVarianceData(
    isAuthenticated,
    varianceBranchId,
    varianceItemId,
    varianceFrom,
    varianceTo,
  );

  const activeItems = useMemo(() => getActiveItems(items), [items]);

  const selectedItemName = useMemo(
    () => getSelectedItemName(selectedItemId, activeItems),
    [selectedItemId, activeItems],
  );

  const stats = useMemo(
    () => calculateDashboardStats(operations, branches, items, employees),
    [operations, branches, items, employees],
  );

  const rows = itemHistory?.rows || [];
  const { chartData, branchSeries } = useMemo(
    () => processItemHistoryChartData(rows),
    [rows],
  );
  const chartHasData = chartData.length > 0;

  // Item Analysis chart data
  const analysisChartData = useMemo(
    () => processItemAnalysisChartData(analysisData),
    [analysisData],
  );
  const analysisHasData = analysisChartData.length > 0;

  const varianceRows = variance?.rows || [];
  const varianceChartData = useMemo(
    () => processVarianceChartData(varianceRows),
    [varianceRows],
  );
  const varianceHasData = varianceChartData.length > 0;
  const varianceHasOpening = useMemo(
    () => checkVarianceHasOpening(varianceChartData),
    [varianceChartData],
  );

  if (!isAuthenticated) {
    return null;
  }

  return (
    <div className="min-h-[100svh]" dir="rtl">
      <Sidebar onLogout={handleLogout} activePage="dashboard" />

      <main className="mr-0 lg:mr-72 p-4 sm:p-6 lg:p-8">
        <div className="mb-6 mt-6 lg:mt-0">
          <h1 className={`text-3xl sm:text-4xl ${ws.title} mb-2`}>
            إدارة المخزون
          </h1>
          <p className={ws.muted}>متابعة المخزون والإحصائيات عبر جميع الفروع</p>
        </div>

        {/* Welcome Banner with quick summary */}
        <WelcomeBanner stats={stats} analytics={analytics} />

        {/* Smart Alerts */}
        <SmartAlerts alerts={analytics?.alerts} />

        {/* Statistics Cards */}
        <StatisticsCards stats={stats} />

        {/* Health Score + Inventory Cost + Depletion Predictions */}
        <HealthScoreCard
          healthScore={analytics?.healthScore}
          inventoryCost={analytics?.inventoryCost}
          depletionPredictions={analytics?.depletionPredictions}
        />

        {/* Week comparison + Branch Performance */}
        <BranchPerformanceCard
          branchPerformance={analytics?.branchPerformance}
          weekComparison={analytics?.weekComparison}
        />

        {/* Monthly Summary Export */}
        <MonthlySummaryExport analytics={analytics} stats={stats} />

        <AdminInfoBanner
          adminCount={stats.adminCount}
          totalEmployees={stats.totalEmployees}
        />

        {/* Operations Timeline (replaces the old table) */}
        <OperationsTimeline timeline={analytics?.timeline} />

        {/* Monthly Movement Report */}
        <MonthlyMovementReport
          monthlyMovement={analytics?.monthlyMovement}
          branches={branches}
        />

        <ItemHistoryChart
          selectedItemId={selectedItemId}
          selectedItemName={selectedItemName}
          selectedBranchId={selectedBranchId}
          setSelectedItemId={setSelectedItemId}
          setSelectedBranchId={setSelectedBranchId}
          dateFrom={dateFrom}
          setDateFrom={setDateFrom}
          dateTo={dateTo}
          setDateTo={setDateTo}
          activeItems={activeItems}
          branches={branches}
          isHistoryLoading={isHistoryLoading}
          historyError={historyError}
          chartData={chartData}
          branchSeries={branchSeries}
          chartHasData={chartHasData}
        />

        <ItemAnalysisChart
          analysisItemId={analysisItemId}
          setAnalysisItemId={setAnalysisItemId}
          analysisBranchIds={analysisBranchIds}
          setAnalysisBranchIds={setAnalysisBranchIds}
          analysisFrom={analysisFrom}
          setAnalysisFrom={setAnalysisFrom}
          analysisTo={analysisTo}
          setAnalysisTo={setAnalysisTo}
          activeItems={activeItems}
          branches={branches}
          isAnalysisLoading={isAnalysisLoading}
          analysisError={analysisError}
          analysisChartData={analysisChartData}
          analysisHasData={analysisHasData}
        />

        <VarianceChart
          varianceBranchId={varianceBranchId}
          setVarianceBranchId={setVarianceBranchId}
          varianceItemId={varianceItemId}
          setVarianceItemId={setVarianceItemId}
          varianceFrom={varianceFrom}
          setVarianceFrom={setVarianceFrom}
          varianceTo={varianceTo}
          setVarianceTo={setVarianceTo}
          branches={branches}
          activeItems={activeItems}
          varianceLoading={varianceLoading}
          varianceError={varianceError}
          varianceChartData={varianceChartData}
          varianceHasData={varianceHasData}
          varianceHasOpening={varianceHasOpening}
        />

        <AdditionalInfoCards items={items} branches={branches} />
      </main>
    </div>
  );
}
