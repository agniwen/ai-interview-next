import { cn } from "@/lib/utils";

export function BrandMark({ className }: { className?: string }) {
  return (
    <img
      alt=""
      className={cn("size-7 shrink-0", className)}
      height={28}
      src="/logo.png"
      width={28}
    />
  );
}
