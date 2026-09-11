import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

export interface SpinnerProps extends React.ComponentProps<"svg"> {
  size?: "xs" | "sm" | "md" | "lg" | "xl";
  variant?: "default" | "brand" | "subtle" | "white" | "emerald" | "blue";
}

const sizeClasses = {
  xs: "w-3 h-3",
  sm: "w-3.5 h-3.5",
  md: "w-4 h-4",
  lg: "w-6 h-6",
  xl: "w-8 h-8",
};

const variantClasses = {
  default: "text-slate-600",
  brand: "text-indigo-600",
  subtle: "text-slate-400",
  white: "text-white",
  emerald: "text-emerald-600",
  blue: "text-blue-600",
};

export function Spinner({
  size = "md",
  variant = "brand",
  className,
  ...props
}: SpinnerProps) {
  return (
    <Loader2
      className={cn(
        "animate-spin shrink-0",
        sizeClasses[size],
        variantClasses[variant],
        className,
      )}
      {...props}
    />
  );
}
