import "./interview-entry-background.css";

// 固定网格分为四组，使用确定性纹样保证 SSR 与浏览器一致。
// Split the fixed grid into four deterministic patterns shared by SSR and the browser.
const dotMasks = Array.from({ length: 4 }, (_, group) => {
  const squares = Array.from({ length: 28 * 28 }, (_cell, index) => {
    const x = index % 28;
    const y = Math.floor(index / 28);
    const noise = Math.sin(x * 12.9898 + y * 78.233) * 43_758.5453;
    const selected = Math.floor((noise - Math.floor(noise)) * 4);
    return selected === group ? `M${x * 7} ${y * 7}h2v2h-2z` : "";
  }).join("");
  return `url("data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="196" height="196"><path fill="white" d="${squares}"/></svg>`)}")`;
});

/**
 * 候选人面试入口的装饰性点阵背景，以固定纹样配合 CSS 明暗动画并支持减少动态效果。
 * Decorative candidate-entry dot background using fixed patterns and CSS opacity animation with reduced-motion support.
 */
export function InterviewEntryBackground() {
  return (
    <div
      aria-hidden="true"
      className="interview-entry-grain pointer-events-none fixed inset-0 text-foreground"
    >
      <div className="interview-entry-grain-field absolute inset-0">
        {dotMasks.map((maskImage, index) => (
          <span
            key={maskImage}
            className="interview-entry-grain-dots absolute inset-0 bg-current"
            style={{ animationDelay: `${index * -5}s`, maskImage }}
          />
        ))}
      </div>
    </div>
  );
}
