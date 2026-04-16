import { ThemeToggle } from "./theme-toggle";

export function Header() {
  return (
    <header
      data-testid="site-header"
      className="w-full border-b border-border"
    >
      <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between">
        <span
          data-testid="header-brand"
          className="text-accent-yellow font-bold text-lg uppercase tracking-widest"
        >
          Paper2Notebook
        </span>
        <div className="flex items-center gap-3">
          <ThemeToggle />
          <span className="text-foreground/40 text-xs uppercase tracking-wider">
            v1
          </span>
        </div>
      </div>
    </header>
  );
}
