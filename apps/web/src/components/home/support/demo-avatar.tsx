import { Avatar as BaseAvatar, AvatarFallback } from "@/components/ui/avatar";
import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";
import { PersonSilhouette } from "./person-silhouette";

export { AvatarFallback } from "@/components/ui/avatar";
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
