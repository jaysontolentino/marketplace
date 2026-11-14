import * as React from "react";
import { cn } from "@/lib/utils";
export function Input({ className, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      className={cn(
        "flex h-12 w-full rounded-lg border border-border bg-white px-3 text-sm outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50",
        className,
      )}
      {...props}
    />
  );
}
