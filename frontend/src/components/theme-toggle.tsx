"use client";

import { useTheme } from "./theme-provider";

export function ThemeToggle() {
  const { theme, toggle } = useTheme();
  const isDark = theme === "dark";

  return (
    <button
      data-testid="theme-toggle"
      type="button"
      onClick={toggle}
      aria-label={`Switch to ${isDark ? "light" : "dark"} theme`}
      className="relative w-12 h-6 rounded-full border border-border bg-surface transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-yellow"
    >
      <span
        className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full transition-transform flex items-center justify-center text-xs ${
          isDark
            ? "translate-x-0 bg-accent-yellow text-background"
            : "translate-x-6 bg-accent-yellow text-background"
        }`}
      >
        {isDark ? "\u263D" : "\u2600"}
      </span>
    </button>
  );
}
