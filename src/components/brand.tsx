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
    <span className={cn("inline-flex items-center gap-2.5", className)}>
      <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-[#171717]">
        <Image src="/brand/team-italfit.svg" alt="" width={23} height={24} />
      </span>
      {!compact && (
        <span className="whitespace-nowrap text-[15px] font-semibold tracking-[-0.035em]">
          Team Italfit<span className="ml-0.5 text-[#d92b2b]">.</span>
        </span>
      )}
    </span>
  );
}
