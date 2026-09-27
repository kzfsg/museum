'use client'

// Debug view: how each generation came to be. Lists recent traces; selecting
// one shows the image sent to the model next to what came back, the exact
// prompt, the history data behind it, what the phone reported, and timings.

import { useEffect, useState } from 'react'
import type { Trace } from '@/src/lib/trace'

interface Summary {
  id: string
  createdAt: string
  year: number
  lat: number | null
  lng: number | null
  status: 'ok' | 'error'
}

const imageUrl = (path: string) => `/api/scans/image?path=${encodeURIComponent(path)}`

export default function TracePage() {
  const [summaries, setSummaries] = useState<Summary[] | null>(null)
  const [trace, setTrace] = useState<Trace | null>(null)

  useEffect(() => {
    fetch('/api/traces')
      .then((r) => r.json())
      .then((d: { traces: Summary[] }) => {
        setSummaries(d.traces)
        const wanted = new URLSearchParams(window.location.search).get('id') ?? d.traces[0]?.id
        if (wanted) open(wanted)
      })
  }, [])

  function open(id: string) {
    fetch(`/api/traces?id=${encodeURIComponent(id)}`)
      .then((r) => r.json())
      .then((d: { trace?: Trace }) => setTrace(d.trace ?? null))
  }

  return (
    <main className="min-h-dvh p-4 md:p-8 space-y-6 text-sm">
      <h1 className="font-display text-2xl">Generation traces</h1>

      <section className="flex flex-wrap gap-2">
        {summaries === null && <p className="text-muted">Loading…</p>}
        {summaries?.length === 0 && <p className="text-muted">No traces yet. Generate a scan first.</p>}
        {summaries?.map((s) => (
          <button
            key={s.id}
            onClick={() => open(s.id)}
            className={`rounded-md border px-3 py-2 text-left ${trace?.id === s.id ? 'border-primary' : 'border-border'}`}
          >
            <div>{new Date(s.createdAt).toLocaleString()}</div>
            <div className="text-xs text-muted">
              {s.year} · {s.status}
              {s.lat !== null && ` · ${s.lat.toFixed(4)}, ${s.lng?.toFixed(4)}`}
            </div>
          </button>
        ))}
      </section>

      {trace && (
        <article className="space-y-6">
          <div className="grid gap-4 md:grid-cols-2">
            <figure className="space-y-1">
              <figcaption className="text-muted">
                Stitched scan (squashed to 3:2){trace.mode === 'site' ? ' — not sent in site mode' : ' — sent to the model'}
              </figcaption>
              <img src={imageUrl(trace.inputPath)} alt="Input panorama" className="w-full rounded-md border border-border" />
            </figure>
            <figure className="space-y-1">
              <figcaption className="text-muted">Returned by the model</figcaption>
              {trace.outputPath ? (
                <img src={imageUrl(trace.outputPath)} alt="Output panorama" className="w-full rounded-md border border-border" />
              ) : (
                <p className="text-muted">No output.</p>
              )}
            </figure>
          </div>

          <Block title={`Mode: ${trace.mode ?? 'follow'}${trace.note ? ` — "${trace.note}"` : ''}`}>
            {trace.mode === 'site'
              ? 'The scan was taken in a building that did not exist yet in the chosen year, so the site was generated from the prompt alone (the scan image was not sent to the model).'
              : 'The scan image was sent to the model to be repainted.'}
          </Block>
          <Block title="Building the scan was taken in">{JSON.stringify(trace.building ?? null, null, 2)}</Block>
          <Block title="Image provider attempts">{JSON.stringify(trace.imageAttempts ?? [], null, 2)}</Block>
          <Block title="Research and narration plan">{JSON.stringify(trace.research ?? null, null, 2)}</Block>
          <Block title="Outcome">{JSON.stringify(trace.outcome, null, 2)}</Block>
          <Block title="Timings (ms)">{JSON.stringify(trace.timingsMs, null, 2)}</Block>
          <Block title={`Prompt (model: ${trace.model})`}>{trace.prompt}</Block>
          <Block title="Request">{JSON.stringify(trace.request, null, 2)}</Block>
          <Block title="Capture (from the phone)">{JSON.stringify(trace.capture, null, 2)}</Block>
          <Block title="History behind the prompt">{JSON.stringify(trace.history, null, 2)}</Block>
        </article>
      )}
    </main>
  )
}

function Block({ title, children }: { title: string; children: string }) {
  return (
    <section className="space-y-1">
      <h2 className="text-[10px] uppercase tracking-[0.15em] text-muted">{title}</h2>
      <pre className="overflow-x-auto whitespace-pre-wrap rounded-md border border-border bg-surface p-3 text-xs">{children}</pre>
    </section>
  )
}
