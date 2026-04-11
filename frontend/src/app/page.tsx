"use client";

import { useState } from "react";
import { Separator } from "@/components/separator";
import { ApiKeyInput } from "@/components/api-key-input";
import { PdfUpload } from "@/components/pdf-upload";
import { ProcessingView } from "@/components/processing-view";
import { ResultView } from "@/components/result-view";
import { useGenerationStream } from "@/hooks/use-generation-stream";

export default function Home() {
  const [apiKey, setApiKey] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const { status, messages, notebook, error, generate, reset } =
    useGenerationStream();

  const canGenerate = apiKey.trim().length > 0 && file !== null;
  const showInput = status === "idle";
  const showProcessing =
    status === "uploading" || status === "processing" || status === "error";
  const showResult = status === "complete" && notebook !== null;

  const handleGenerate = () => {
    if (canGenerate && file) {
      generate(apiKey, file);
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
      <div className="w-full max-w-2xl px-6 py-16 flex flex-col items-center">
        <h1
          className="text-4xl md:text-5xl font-bold text-accent-yellow uppercase tracking-wider text-center"
          data-testid="app-title"
        >
          Paper2Notebook
        </h1>
        <p
          className="mt-4 text-base md:text-lg text-foreground/60 text-center max-w-xl"
          data-testid="hero-tagline"
        >
          Convert any research paper into a structured, runnable Jupyter notebook
          — powered by GPT-5.4
        </p>

        <Separator />

        {showInput && (
          <div data-testid="input-form" className="w-full flex flex-col gap-6">
            <ApiKeyInput value={apiKey} onChange={setApiKey} />
            <PdfUpload file={file} onFileChange={setFile} />

            <button
              data-testid="generate-button"
              type="button"
              disabled={!canGenerate}
              onClick={handleGenerate}
              className="w-full py-3 rounded font-bold uppercase tracking-wider text-sm transition-colors bg-accent-magenta text-foreground hover:brightness-110 disabled:opacity-30 disabled:cursor-not-allowed"
            >
              Generate Notebook
            </button>
          </div>
        )}

        {showProcessing && (
          <ProcessingView
            messages={messages}
            error={error}
            onRetry={handleRetry}
          />
        )}

        {showResult && (
          <ResultView
            notebook={notebook as { cells: Array<{ cell_type: string; source: string }>; ipynb_base64?: string }}
            onNewNotebook={handleRetry}
          />
        )}
      </div>
    </main>
  );
}
