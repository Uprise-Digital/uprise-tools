import { Spinner } from "./spinner";
import { cn } from "@/lib/utils";

export interface ContentLoadingOverlayProps {
  loading: boolean;
  label?: string;
  className?: string;
  spinnerSize?: "sm" | "md" | "lg";
  spinnerVariant?: "default" | "brand" | "emerald" | "blue";
  children?: React.ReactNode;
}

export function ContentLoadingOverlay({
  loading,
  label = "Updating data...",
  className,
  spinnerSize = "sm",
  spinnerVariant = "brand",
  children,
}: ContentLoadingOverlayProps) {
  return (
    <div className="relative">
      {loading && (
        <div
          className={cn(
            "absolute inset-0 z-20 flex flex-col items-center justify-start pt-16 bg-white/50 backdrop-blur-[1.5px] rounded-xl pointer-events-none transition-all duration-200",
            className,
          )}
        >
          <div className="sticky top-24 flex items-center gap-2 px-3.5 py-2 bg-slate-900/90 backdrop-blur text-white rounded-full shadow-lg border border-slate-800 text-xs font-semibold animate-in fade-in zoom-in-95 duration-150">
            <Spinner
              size={spinnerSize}
              variant={spinnerVariant === "brand" ? "brand" : spinnerVariant}
              className={
                spinnerVariant === "brand" ? "text-indigo-400" : undefined
              }
            />
            <span>{label}</span>
          </div>
        </div>
      )}
      <div
        className={cn(
          "transition-opacity duration-200",
          loading && "opacity-50 select-none pointer-events-none",
        )}
      >
        {children}
      </div>
    </div>
  );
}
