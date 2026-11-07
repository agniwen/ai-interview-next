import { Avatar as BaseAvatar, AvatarFallback } from "@/components/ui/avatar";
import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";
import { PersonSilhouette } from "./person-silhouette";

export { AvatarFallback } from "@/components/ui/avatar";
/**
 * 首页演示头像，使用确定性人物剪影代替真实用户照片，并兼容头像回退内容。
 * Homepage-demo avatar using deterministic silhouettes instead of real user photos, with avatar fallback support.
 */
export function Avatar({
  seed,
  label,
  size = "default",
  className,
  children,
  ...props
}: ComponentProps<typeof BaseAvatar> & {
  seed?: string | number;
  label?: string;
  size?: "default" | "sm" | "lg";
}) {
  return (
    <BaseAvatar
      {...props}
      aria-label={label}
      role={seed === undefined ? undefined : "img"}
      className={cn(size === "sm" && "size-6", size === "lg" && "size-10", className)}
    >
      {seed === undefined ? (
        children
      ) : (
        <AvatarFallback>
          <PersonSilhouette seed={seed} />
        </AvatarFallback>
      )}
    </BaseAvatar>
  );
}
