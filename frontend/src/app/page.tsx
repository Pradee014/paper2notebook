"use client";

import { useState, useEffect, useCallback } from "react";
import { Separator } from "@/components/separator";
import { ApiKeyInput, Provider } from "@/components/api-key-input";
import { PdfUpload } from "@/components/pdf-upload";
import { ProcessingView } from "@/components/processing-view";
import { ResultView } from "@/components/result-view";
import { HistoryPanel } from "@/components/history-panel";
import { useGenerationStream } from "@/hooks/use-generation-stream";
import { saveToHistory, loadHistory, type HistoryEntry } from "@/lib/history";

export default function Home() {
  const [apiKey, setApiKey] = useState("");
  const [provider, setProvider] = useState<Provider>("openai");
  const [file, setFile] = useState<File | null>(null);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const { status, messages, notebook, error, generate, reset } =
    useGenerationStream();

  // Load history from localStorage on mount
  useEffect(() => {
    setHistory(loadHistory());
  }, []);

  // Save to history when generation completes
  useEffect(() => {
    if (status === "complete" && notebook) {
      saveToHistory(notebook as { cells: Array<{ cell_type: string; source: string }>; ipynb_base64?: string });
      setHistory(loadHistory());
    }
  }, [status, notebook]);

  const refreshHistory = useCallback(() => {
    setHistory(loadHistory());
  }, []);

  const canGenerate = apiKey.trim().length > 0 && file !== null;
  const showInput = status === "idle";
  const showProcessing =
    status === "uploading" || status === "processing" || status === "error";
  const showResult = status === "complete" && notebook !== null;

  const handleGenerate = () => {
    if (canGenerate && file) {
      generate(apiKey, file, provider);
    }
  };

  const handleRetry = () => {
    reset();
  };

  return (
    <main
      data-testid="main-content"
      className="flex flex-col flex-1 items-center"
    >
      <div className="w-full max-w-2xl px-6 py-12 md:py-16 flex flex-col items-center">
        <h1
          className="text-3xl sm:text-4xl md:text-5xl font-bold text-accent-yellow uppercase tracking-wider text-center"
          data-testid="app-title"
        >
          Paper2Notebook
        </h1>
        <p
          className="mt-3 md:mt-4 text-sm sm:text-base md:text-lg text-foreground/60 text-center max-w-xl"
          data-testid="hero-tagline"
        >
          Convert any research paper into a structured, runnable Jupyter notebook
          — powered by AI
        </p>

        <Separator />

        {showInput && (
          <div
            data-testid="input-form"
            className="w-full flex flex-col gap-5 md:gap-6 animate-fade-in"
          >
            <ApiKeyInput value={apiKey} onChange={setApiKey} provider={provider} onProviderChange={setProvider} />
            <PdfUpload file={file} onFileChange={setFile} />

            <button
              data-testid="generate-button"
              type="button"
              disabled={!canGenerate}
              onClick={handleGenerate}
              className="w-full py-3 rounded font-bold uppercase tracking-wider text-sm transition-all bg-accent-magenta text-foreground hover:brightness-110 disabled:opacity-30 disabled:cursor-not-allowed active:scale-[0.98]"
            >
              Generate Notebook
            </button>

            {history.length > 0 && (
              <div className="mt-4">
                <Separator />
                <HistoryPanel entries={history} onClear={refreshHistory} />
              </div>
            )}
          </div>
        )}

        {showProcessing && (
          <div className="w-full animate-fade-in">
            <ProcessingView
              messages={messages}
              error={error}
              onRetry={handleRetry}
            />
          </div>
        )}

        {showResult && (
          <div className="w-full animate-fade-in">
            <ResultView
              notebook={
                notebook as {
                  cells: Array<{ cell_type: string; source: string }>;
                  ipynb_base64?: string;
                }
              }
              onNewNotebook={handleRetry}
            />
          </div>
        )}
      </div>

      <footer
        data-testid="site-footer"
        className="w-full border-t border-border mt-auto"
      >
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between">
          <span className="text-xs text-muted">
            Paper2Notebook — research paper replication accelerator
          </span>
          <span className="text-xs text-foreground/20">
            GPT-5.4 / Gemini
          </span>
        </div>
      </footer>
    </main>
  );
}
