"use client";

import { useEffect, useState } from "react";
import { ProgressMessage } from "@/components/progress-message";

interface ProcessingViewProps {
  messages: string[];
  error: string | null;
  onRetry: () => void;
}

export function ProcessingView({ messages, error, onRetry }: ProcessingViewProps) {
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    if (error) return;
    const start = Date.now();
    const interval = setInterval(() => {
      setElapsed(Math.floor((Date.now() - start) / 1000));
    }, 1000);
    return () => clearInterval(interval);
  }, [error]);

  const minutes = Math.floor(elapsed / 60);
  const seconds = elapsed % 60;
  const timeStr = `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;

  if (error) {
    return (
      <div data-testid="processing-view" className="w-full animate-fade-in">
        <div className="bg-surface border border-border rounded-lg p-4 sm:p-6">
          <div className="flex items-center gap-2 mb-4">
            <span className="text-accent-magenta text-lg">&#x2717;</span>
            <span className="text-xs uppercase tracking-wider text-accent-magenta">
              Error
            </span>
          </div>
          <p
            data-testid="error-message"
            className="text-sm text-foreground/80 mb-4 font-mono"
          >
            {error}
          </p>
          <button
            data-testid="retry-button"
            type="button"
            onClick={onRetry}
            className="px-6 py-2 rounded font-bold uppercase tracking-wider text-xs bg-accent-magenta text-foreground hover:brightness-110 transition-colors"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div data-testid="processing-view" className="w-full animate-fade-in">
      <div className="bg-surface border border-border rounded-lg p-4 sm:p-6">
        <div className="flex items-center justify-between mb-4">
          <span className="text-xs uppercase tracking-wider text-accent-yellow">
            Generating notebook...
          </span>
          <span
            data-testid="elapsed-timer"
            className="text-xs text-muted font-mono tabular-nums"
          >
            {timeStr}
          </span>
        </div>

        <div
          data-testid="progress-messages"
          className="space-y-1 font-mono text-sm"
        >
          {messages.map((msg, i) => (
            <ProgressMessage key={i} message={msg} isLatest={i === messages.length - 1} />
          ))}
          <span
            data-testid="blinking-cursor"
            className="cursor-blink inline-block text-accent-yellow"
          >
            &#x2588;
          </span>
        </div>
      </div>
    </div>
  );
}
