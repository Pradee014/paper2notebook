interface ProgressMessageProps {
  message: string;
  isLatest: boolean;
}

export function ProgressMessage({ message, isLatest }: ProgressMessageProps) {
  return (
    <div
      data-testid="progress-message"
      className={`flex items-start gap-2 ${isLatest ? "text-foreground" : "text-foreground/40"}`}
    >
      <span className="text-accent-yellow shrink-0">{">"}</span>
      <span>{message}</span>
    </div>
  );
}
