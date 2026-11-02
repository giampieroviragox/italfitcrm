import * as React from "react";
import { cn } from "cn";

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        "h-10 w-full min-w-0 rounded-[10px] border border-input bg-background px-3 py-2 text-base transition-[border-color,box-shadow] outline-none placeholder:text-muted-foreground hover:border-(--border-hover) focus-visible:border-(--border-focus) focus-visible:ring-[3px] focus-visible:ring-foreground/5 disabled:pointer-events-none disabled:cursor-not-allowed disabled:bg-muted disabled:opacity-60 aria-invalid:border-destructive md:text-sm",
        className,
      )}
      {...props}
    />
  );
}

export { Input };
