import { BrandBackground } from "@/components/shaders/brand-background";

/**
 * 将共用品牌背景接入首页首屏，保持首屏背景配置集中在展示层。
 * Connects the shared brand background to the homepage hero, keeping hero configuration in the presentation layer.
 */
export function HeroBackground() {
  return <BrandBackground animated className="home-hero-background" />;
}
