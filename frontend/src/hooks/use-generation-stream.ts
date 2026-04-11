"use client";

import { useState, useCallback, useRef } from "react";
import { API_URL } from "@/lib/config";

export type GenerationStatus = "idle" | "uploading" | "processing" | "complete" | "error";

export interface GenerationState {
  status: GenerationStatus;
  messages: string[];
  notebook: Record<string, unknown> | null;
  error: string | null;
}

export function useGenerationStream() {
  const [state, setState] = useState<GenerationState>({
    status: "idle",
    messages: [],
    notebook: null,
    error: null,
  });
  const abortRef = useRef<AbortController | null>(null);

  const generate = useCallback(async (apiKey: string, file: File, provider: string = "openai") => {
    // Reset state
    setState({ status: "uploading", messages: [], notebook: null, error: null });

    const formData = new FormData();
    formData.append("file", file);
    formData.append("provider", provider);

    abortRef.current = new AbortController();

    try {
      const response = await fetch(`${API_URL}/api/generate`, {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}` },
        body: formData,
        signal: abortRef.current.signal,
      });

      if (!response.ok) {
        const errBody = await response.json().catch(() => ({ detail: "Request failed" }));
        setState((prev) => ({
          ...prev,
          status: "error",
          error: errBody.detail || `HTTP ${response.status}`,
        }));
        return;
      }

      setState((prev) => ({ ...prev, status: "processing" }));

      const reader = response.body?.getReader();
      if (!reader) {
        setState((prev) => ({ ...prev, status: "error", error: "No response stream" }));
        return;
      }

      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        let currentEvent = "";
        for (const line of lines) {
          if (line.startsWith("event:")) {
            currentEvent = line.slice(6).trim();
          } else if (line.startsWith("data:")) {
            const data = line.slice(5).trim();
            handleEvent(currentEvent, data, setState);
          }
        }
      }

      // Process remaining buffer
      if (buffer.trim()) {
        const lines = buffer.split("\n");
        let currentEvent = "";
        for (const line of lines) {
          if (line.startsWith("event:")) {
            currentEvent = line.slice(6).trim();
          } else if (line.startsWith("data:")) {
            const data = line.slice(5).trim();
            handleEvent(currentEvent, data, setState);
          }
        }
      }
    } catch (err) {
      if ((err as Error).name === "AbortError") return;
      setState((prev) => ({
        ...prev,
        status: "error",
        error: (err as Error).message || "Unknown error",
      }));
    }
  }, []);

  const reset = useCallback(() => {
    abortRef.current?.abort();
    setState({ status: "idle", messages: [], notebook: null, error: null });
  }, []);

  return { ...state, generate, reset };
}

function handleEvent(
  event: string,
  data: string,
  setState: React.Dispatch<React.SetStateAction<GenerationState>>
) {
  if (event === "progress") {
    setState((prev) => ({
      ...prev,
      messages: [...prev.messages, data],
    }));
  } else if (event === "complete") {
    try {
      const notebook = JSON.parse(data);
      setState((prev) => ({
        ...prev,
        status: "complete",
        notebook,
        messages: [...prev.messages, "Notebook ready!"],
      }));
    } catch {
      setState((prev) => ({
        ...prev,
        status: "error",
        error: "Failed to parse notebook data",
      }));
    }
  } else if (event === "error") {
    try {
      const errData = JSON.parse(data);
      setState((prev) => ({
        ...prev,
        status: "error",
        error: errData.message || "Generation failed",
      }));
    } catch {
      setState((prev) => ({
        ...prev,
        status: "error",
        error: data || "Generation failed",
      }));
    }
  }
}
