export default function Home() {
  return (
    <div className="flex flex-col flex-1 items-center justify-center">
      <main className="flex flex-1 w-full max-w-4xl flex-col items-center justify-center px-6">
        <h1
          className="text-4xl font-bold text-accent-yellow uppercase tracking-wider"
          data-testid="app-title"
        >
          Paper2Notebook
        </h1>
        <p className="mt-4 text-lg text-foreground/70">
          Convert research papers into structured Jupyter notebooks
        </p>
      </main>
    </div>
  );
}
