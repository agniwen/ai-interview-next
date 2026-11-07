import { BrandMark } from "@/components/brand-mark";

export { BrandMark as RecruitmentCopilotMark } from "@/components/brand-mark";
/**
 * 首页演示的品牌字标组合，并将共用品牌图形导出为演示使用的名称。
 * Brand wordmark composition for homepage demos, aliasing the shared brand mark for demo consumers.
 */
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
