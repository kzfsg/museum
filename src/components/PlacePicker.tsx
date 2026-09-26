import type { Place } from '@/src/data/places'

interface PlacePickerProps {
  places: Place[]
  notice?: string
  onPick: (place: Place) => void
  onBack: () => void
}

export function PlacePicker({ places, notice, onPick, onBack }: PlacePickerProps) {
  return (
    <main className="min-h-dvh px-6 py-8 max-w-md mx-auto">
      <button onClick={onBack} className="text-sm text-muted mb-6">← Back</button>
      <h2 className="font-display text-2xl mb-2">Pick a spot</h2>
      {notice && <p className="text-sm text-muted mb-4">{notice}</p>}
      <ul className="space-y-2 mt-4">
        {places.map((place) => (
          <li key={place.id}>
            <button
              onClick={() => onPick(place)}
              className="w-full text-left rounded-md border border-border bg-surface px-4 py-3"
            >
              <div className="font-medium">{place.name}</div>
              <div className="text-sm text-muted">
                {place.neighborhood} · {place.year}
                {place.placeholder && ' · placeholder panorama'}
              </div>
            </button>
          </li>
        ))}
      </ul>
    </main>
  )
}
