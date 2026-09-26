interface SplashProps {
  onScan: () => void
  onBrowse: () => void
}

export function Splash({ onScan, onBrowse }: SplashProps) {
  return (
    <main className="min-h-dvh flex flex-col items-center justify-center gap-8 px-6 text-center">
      <div className="space-y-3">
        <h1 className="font-display text-5xl">Museum</h1>
        <p className="text-muted max-w-xs mx-auto">Turn the block you’re standing on into a museum.</p>
      </div>
      <div className="flex flex-col gap-3 w-full max-w-xs">
        <button onClick={onScan} className="rounded-md bg-primary px-4 py-3 font-medium text-foreground">
          Scan my surroundings
        </button>
        <button onClick={onBrowse} className="rounded-md border border-border px-4 py-3 text-muted">
          Browse spots
        </button>
      </div>
    </main>
  )
}
