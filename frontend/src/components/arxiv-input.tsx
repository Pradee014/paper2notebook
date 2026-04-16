"use client";

interface ArxivInputProps {
  value: string;
  onChange: (value: string) => void;
}

export function ArxivInput({ value, onChange }: ArxivInputProps) {
  return (
    <div className="w-full">
      <label className="block text-xs uppercase tracking-wider text-accent-yellow mb-2">
        arXiv Paper
      </label>
      <input
        data-testid="arxiv-url-input"
        type="text"
        placeholder="e.g. 1706.03762 or https://arxiv.org/abs/1706.03762"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full bg-surface border border-border rounded px-4 py-3 text-sm text-foreground placeholder:text-muted focus:outline-none focus:border-accent-yellow transition-colors font-mono"
        autoComplete="off"
        spellCheck={false}
      />
      <p className="mt-1.5 text-xs text-muted">
        Paste an arXiv URL or paper ID — the PDF will be fetched automatically.
      </p>
    </div>
  );
}
