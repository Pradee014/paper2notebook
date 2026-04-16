"use client";

import { useState } from "react";

export type Provider = "openai" | "gemini";

const PROVIDER_CONFIG: Record<Provider, { label: string; placeholder: string }> = {
  openai: { label: "OpenAI API Key", placeholder: "sk-..." },
  gemini: { label: "Gemini API Key", placeholder: "AIza..." },
};

interface ApiKeyInputProps {
  value: string;
  onChange: (value: string) => void;
  provider: Provider;
  onProviderChange: (provider: Provider) => void;
}

export function ApiKeyInput({ value, onChange, provider, onProviderChange }: ApiKeyInputProps) {
  const [visible, setVisible] = useState(false);
  const config = PROVIDER_CONFIG[provider];

  return (
    <div className="w-full">
      <div className="flex items-center gap-2 mb-2">
        <label className="text-xs uppercase tracking-wider text-accent-yellow">
          {config.label}
        </label>
        <div className="ml-auto flex rounded border border-border overflow-hidden">
          {(Object.keys(PROVIDER_CONFIG) as Provider[]).map((p) => (
            <button
              key={p}
              type="button"
              data-testid={`provider-tab-${p}`}
              onClick={() => onProviderChange(p)}
              className={`px-3 py-1 text-xs uppercase tracking-wider transition-colors ${
                provider === p
                  ? "bg-accent-yellow text-background font-bold"
                  : "text-muted hover:text-foreground"
              }`}
            >
              {p === "openai" ? "OpenAI" : "Gemini"}
            </button>
          ))}
        </div>
      </div>
      <div className="relative">
        <input
          data-testid="api-key-input"
          type={visible ? "text" : "password"}
          placeholder={config.placeholder}
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
