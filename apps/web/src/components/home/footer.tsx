// 用途：页脚。左侧品牌字标，右侧产品锚点与入口链接。
// Purpose: footer — brand wordmark with product anchors and entry links.
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import * as m from "@/paraglide/messages";

const COPYRIGHT_YEAR = 2026;

const LINK_CLASS = "text-muted-foreground transition-colors hover:text-foreground";

export function HomeFooter() {
  const sectionLinks = [
    { hash: "capabilities", label: m.home_footer_capabilities() },
    { hash: "roles", label: m.home_footer_roles() },
    { hash: "trust", label: m.home_footer_trust() },
    { hash: "faq", label: m.home_footer_faq() },
  ];

  return (
    <footer className="mx-auto w-full max-w-360 px-6 pb-10 sm:px-8 lg:px-16">
      <Separator className="mb-10 bg-border" />
      <div className="flex flex-col gap-10 pb-10 md:flex-row md:items-start md:justify-between lg:pb-14">
        <p className="max-w-[10em] text-pretty font-medium text-[clamp(2rem,4vw,3.5rem)] text-foreground leading-[1.2] tracking-[-0.04em]">
          Sainoa
        </p>
        <div className="grid grid-cols-2 gap-x-16 gap-y-8 text-sm">
          <nav aria-label={m.home_footer_product()} className="flex flex-col gap-3">
            <p className="font-medium text-foreground">{m.home_footer_product()}</p>
            {sectionLinks.map(({ hash, label }) => (
              <a className={LINK_CLASS} href={`#${hash}`} key={hash}>
                {label}
              </a>
            ))}
          </nav>
          <nav aria-label={m.home_footer_start()} className="flex flex-col gap-3">
            <p className="font-medium text-foreground">{m.home_footer_start()}</p>
            <Button variant="ghost" className="h-auto justify-start p-0" disabled>
              {m.home_hero_resume_cta()}· {m.home_coming_soon()}
            </Button>
            <Button variant="ghost" className="h-auto justify-start p-0" disabled>
              {m.home_hero_workbench_cta()}· {m.home_coming_soon()}
            </Button>
            <Button variant="ghost" className="h-auto justify-start p-0" disabled>
              {m.home_footer_login()}· {m.home_coming_soon()}
            </Button>
          </nav>
        </div>
      </div>
      <p className="text-muted-foreground text-xs sm:text-sm">© {COPYRIGHT_YEAR} Sainoa</p>
    </footer>
  );
}
