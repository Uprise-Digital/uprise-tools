import { cn } from "@/lib/utils";

export interface TopProgressBarProps {
  loading: boolean;
  className?: string;
  barClassName?: string;
  color?: "indigo" | "blue" | "emerald";
}

const trackColors = {
  indigo: "bg-indigo-100 dark:bg-indigo-950/40",
  blue: "bg-blue-100 dark:bg-blue-950/40",
  emerald: "bg-emerald-100 dark:bg-emerald-950/40",
};

const barColors = {
  indigo: "bg-indigo-600 dark:bg-indigo-400",
  blue: "bg-blue-600 dark:bg-blue-400",
  emerald: "bg-emerald-600 dark:bg-emerald-400",
};

export function TopProgressBar({
  loading,
  className,
  barClassName,
  color = "indigo",
}: TopProgressBarProps) {
  if (!loading) return null;

  return (
    <div
      aria-hidden="true"
      className={cn(
        "fixed top-0 left-0 right-0 z-50 h-1 overflow-hidden pointer-events-none transition-opacity duration-200",
        trackColors[color],
        className
      )}
    >
      <div
        className={cn(
          "h-full w-1/3 relative rounded-full animate-indeterminate-slide",
          barColors[color],
          barClassName
        )}
      />
    </div>
  );
}
