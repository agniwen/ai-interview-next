import { BrandMark } from "@/components/brand-mark";

export { BrandMark as RecruitmentCopilotMark } from "@/components/brand-mark";
export function RecruitmentCopilotBrand({ className }: { className?: string }) {
  return (
    <div className={className}>
      <span className="flex items-center gap-2">
        <BrandMark />
        Sainoa
      </span>
    </div>
  );
}
