import Image from "next/image";
import { cn } from "@/lib/utils";
export function Brand({
  compact = false,
  className,
}: {
  compact?: boolean;
  className?: string;
}) {
  return (
    <span className={cn("inline-flex items-center gap-2", className)}>
      <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-[#0f0f10] dark:ring-1 dark:ring-white/15">
        <Image
          src="/brand/team-italfit.svg"
          alt=""
          width={19}
          height={20}
          className="h-5 w-[19px]"
        />
      </span>
      {!compact && (
        <span className="text-[15px] font-semibold whitespace-nowrap tracking-[-0.03em]">
          Team Italfit
        </span>
      )}
    </span>
  );
}
