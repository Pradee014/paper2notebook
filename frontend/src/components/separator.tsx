export function Separator() {
  return (
    <div
      data-testid="separator"
      className="w-full h-px my-8"
      style={{
        backgroundImage:
          "repeating-linear-gradient(90deg, var(--accent-yellow) 0, var(--accent-yellow) 8px, transparent 8px, transparent 16px)",
      }}
    />
  );
}
