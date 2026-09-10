import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "./spinner";
import { cn } from "@/lib/utils";

export interface DashboardSkeletonProps {
  kpiCount?: number;
  chartsCount?: number;
  tableRows?: number;
  loadingMessage?: string;
  className?: string;
}

export function PageHeaderSkeleton({ className }: { className?: string }) {
  return (
    <div className={cn("flex flex-col md:flex-row md:items-end justify-between gap-4 animate-pulse", className)}>
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <Skeleton className="w-8 h-8 rounded-lg" />
          <Skeleton className="h-8 w-56 rounded-lg" />
        </div>
        <Skeleton className="h-4 w-80 md:w-96 rounded" />
        <div className="flex items-center gap-2 pt-2">
          <Skeleton className="h-8 w-44 rounded-lg" />
          <Skeleton className="h-8 w-28 rounded-lg" />
          <Skeleton className="h-8 w-28 rounded-lg" />
        </div>
      </div>
      <div className="flex items-center gap-3">
        <Skeleton className="h-9 w-28 rounded-lg" />
        <Skeleton className="h-9 w-48 rounded-lg" />
      </div>
    </div>
  );
}

export function MetricGridSkeleton({
  count = 6,
  columnsClassName = "grid-cols-2 md:grid-cols-3 xl:grid-cols-6",
}: {
  count?: number;
  columnsClassName?: string;
}) {
  return (
    <div className={cn("grid gap-4", columnsClassName)}>
      {Array.from({ length: count }).map((_, i) => (
        <Card key={i} className="py-0 m-0 shadow-sm border-slate-200">
          <CardContent className="p-4 flex items-center justify-between">
            <div className="space-y-2 w-full">
              <Skeleton className="h-3 w-16" />
              <Skeleton className="h-6 w-24" />
              <Skeleton className="h-2.5 w-14" />
            </div>
            <Skeleton className="w-7 h-7 rounded-lg shrink-0 self-start" />
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

export function ChartGridSkeleton({ count = 2 }: { count?: number }) {
  return (
    <div className={cn("grid grid-cols-1 gap-6", count > 1 ? "lg:grid-cols-2" : "")}>
      {Array.from({ length: count }).map((_, i) => (
        <Card key={i} className="border-slate-200 shadow-sm bg-white h-80 flex flex-col p-5 space-y-4">
          <Skeleton className="h-5 w-48" />
          <div className="flex-1 bg-slate-50 border border-slate-100 rounded-lg flex items-center justify-center">
            <Spinner size="lg" variant="subtle" />
          </div>
        </Card>
      ))}
    </div>
  );
}

export function TableSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <Card className="shadow-sm border-slate-200 p-6 space-y-4">
      <div className="flex justify-between items-center">
        <Skeleton className="h-5 w-36" />
        <Skeleton className="h-8 w-64" />
      </div>
      <div className="space-y-3">
        {Array.from({ length: rows }).map((_, i) => (
          <div
            key={i}
            className="h-12 bg-slate-50 border border-slate-100 rounded-lg flex items-center px-4 justify-between"
          >
            <Skeleton className="h-4 w-40" />
            <div className="flex gap-4">
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-4 w-16" />
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}

export function FullDashboardSkeleton({
  kpiCount = 6,
  chartsCount = 2,
  tableRows = 6,
  loadingMessage = "Aggregating performance data & synchronizing accounts...",
  className,
}: DashboardSkeletonProps) {
  return (
    <div className={cn("space-y-8 p-4 md:p-8 max-w-[1600px] mx-auto", className)}>
      <PageHeaderSkeleton />

      {loadingMessage ? (
        <div className="flex items-center justify-center gap-3 p-4 bg-indigo-50/70 border border-indigo-100 rounded-xl text-indigo-700 text-sm font-medium">
          <Spinner size="md" variant="brand" />
          <span>{loadingMessage}</span>
        </div>
      ) : null}

      <MetricGridSkeleton count={kpiCount} />
      <ChartGridSkeleton count={chartsCount} />
      <TableSkeleton rows={tableRows} />
    </div>
  );
}
