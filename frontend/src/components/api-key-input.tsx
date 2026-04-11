"use client";

import { useState } from "react";

interface ApiKeyInputProps {
  value: string;
  onChange: (value: string) => void;
}

export function ApiKeyInput({ value, onChange }: ApiKeyInputProps) {
  const [visible, setVisible] = useState(false);

  return (
    <div className="w-full">
      <label className="block text-xs uppercase tracking-wider text-accent-yellow mb-2">
        OpenAI API Key
      </label>
      <div className="relative">
        <input
          data-testid="api-key-input"
          type={visible ? "text" : "password"}
          placeholder="sk-..."
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-full bg-surface border border-border rounded px-4 py-3 text-sm text-foreground placeholder:text-muted focus:outline-none focus:border-accent-yellow transition-colors font-mono"
          autoComplete="off"
          spellCheck={false}
        />
        <button
          data-testid="api-key-toggle"
          type="button"
          onClick={() => setVisible(!visible)}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-muted hover:text-foreground transition-colors text-xs uppercase tracking-wider"
          aria-label={visible ? "Hide API key" : "Show API key"}
        >
          {visible ? "hide" : "show"}
        </button>
      </div>
      <p className="mt-1.5 text-xs text-muted">
        Your key stays in browser memory only — never stored or sent to our
        servers.
      </p>
    </div>
  );
}
