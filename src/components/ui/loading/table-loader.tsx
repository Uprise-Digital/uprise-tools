import { Spinner } from "./spinner";
import { TableCell, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";

export interface TableLoaderProps {
  colSpan: number;
  label?: string;
  className?: string;
  spinnerSize?: "sm" | "md" | "lg";
  spinnerVariant?: "default" | "brand" | "subtle" | "emerald" | "blue";
  heightClassName?: string;
}

export function TableLoader({
  colSpan,
  label = "Loading records...",
  className,
  spinnerSize = "lg",
  spinnerVariant = "brand",
  heightClassName = "h-36",
}: TableLoaderProps) {
  return (
    <TableRow className={cn("hover:bg-transparent", className)}>
      <TableCell
        colSpan={colSpan}
        className={cn("text-center text-xs text-slate-500 font-sans", heightClassName)}
      >
        <div className="flex flex-col items-center justify-center gap-2.5 py-6">
          <Spinner size={spinnerSize} variant={spinnerVariant} />
          <span className="font-medium text-slate-600">{label}</span>
        </div>
      </TableCell>
    </TableRow>
  );
}
