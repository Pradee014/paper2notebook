"use client";

import { useRef, useState, useCallback } from "react";

const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50 MB

interface PdfUploadProps {
  file: File | null;
  onFileChange: (file: File | null) => void;
}

export function PdfUpload({ file, onFileChange }: PdfUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const validateAndSet = useCallback(
    (f: File | null) => {
      setError(null);
      if (!f) {
        onFileChange(null);
        return;
      }
      if (f.type !== "application/pdf" && !f.name.endsWith(".pdf")) {
        setError("Only PDF files are accepted.");
        return;
      }
      if (f.size > MAX_FILE_SIZE) {
        setError("File exceeds 50 MB limit.");
        return;
      }
      onFileChange(f);
    },
    [onFileChange]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      const droppedFile = e.dataTransfer.files[0];
      if (droppedFile) validateAndSet(droppedFile);
    },
    [validateAndSet]
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(true);
  }, []);

  const handleDragLeave = useCallback(() => {
    setDragOver(false);
  }, []);

  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const selected = e.target.files?.[0] ?? null;
      validateAndSet(selected);
    },
    [validateAndSet]
  );

  const clearFile = useCallback(() => {
    onFileChange(null);
    setError(null);
    if (inputRef.current) inputRef.current.value = "";
  }, [onFileChange]);

  return (
    <div className="w-full">
      <label className="block text-xs uppercase tracking-wider text-accent-yellow mb-2">
        Research Paper
      </label>

      <div
        data-testid="pdf-upload-zone"
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onClick={() => inputRef.current?.click()}
        className={`
          w-full border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors
          ${
            dragOver
              ? "border-accent-yellow bg-accent-yellow/5"
              : "border-border hover:border-muted"
          }
        `}
      >
        <input
          ref={inputRef}
          data-testid="pdf-file-input"
          type="file"
          accept=".pdf,application/pdf"
          onChange={handleInputChange}
          className="hidden"
        />

        {file ? (
          <div className="flex flex-col items-center gap-2">
            <span className="text-accent-yellow text-2xl">&#x2713;</span>
            <span
              data-testid="selected-file-name"
              className="text-sm text-foreground"
            >
              {file.name}
            </span>
            <span className="text-xs text-muted">
              {(file.size / 1024 / 1024).toFixed(1)} MB
            </span>
            <button
              data-testid="clear-file-button"
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                clearFile();
              }}
              className="text-xs text-accent-magenta hover:underline mt-1"
            >
              Remove
            </button>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-2">
            <span className="text-muted text-3xl">&#x21E7;</span>
            <span className="text-sm text-foreground/70">
              Drop a PDF here or click to browse
            </span>
            <span className="text-xs text-muted">Max 50 MB</span>
          </div>
        )}
      </div>

      {error && (
        <p data-testid="upload-error" className="mt-2 text-xs text-accent-magenta">
          {error}
        </p>
      )}
    </div>
  );
}
