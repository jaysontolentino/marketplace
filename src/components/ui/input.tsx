import * as React from "react";
import { cn } from "@/lib/utils";
export function Input({ className, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      className={cn(
        "ui-input flex h-12 w-full rounded-[10px] border border-border bg-white px-3.5 text-sm outline-none transition-colors placeholder:text-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/15 disabled:opacity-50",
        className,
      )}
      {...props}
    />
  );
}
