import { Icon } from "./ui.js";

export function PageHeader({ breadcrumb }: { breadcrumb: string }) {
  return (
    <header className="w-full h-16 sticky top-0 z-40 bg-transparent flex items-center px-8">
      <div className="flex items-center gap-2 text-outline text-sm font-headline">
        <span>PolyPay</span>
        <Icon name="chevron_right" className="text-xs" />
        <span className="text-on-surface font-bold">{breadcrumb}</span>
      </div>
    </header>
  );
}
