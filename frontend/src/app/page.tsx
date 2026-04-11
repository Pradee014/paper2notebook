import { Separator } from "@/components/separator";

export default function Home() {
  return (
    <main
      data-testid="main-content"
      className="flex flex-col flex-1 items-center"
    >
      <div className="w-full max-w-5xl px-6 py-16 flex flex-col items-center">
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
      </div>
    </main>
  );
}
