/** Lazy loader for `map-engine.ts`: one dynamic import, shared by every map. */
export type MapEngine = typeof import("./map-engine")

let engine: Promise<MapEngine> | null = null

export function loadMapEngine(): Promise<MapEngine> {
  engine ??= import("./map-engine").catch((err) => {
    engine = null
    throw err
  })
  return engine
}

/** Whether this browser can draw a WebGL map at all. */
export function supportsWebGL(): boolean {
  try {
    const canvas = document.createElement("canvas")
    return !!(canvas.getContext("webgl2") || canvas.getContext("webgl"))
  } catch {
    return false
  }
}

/**
 * A CSS colour token (e.g. `--primary`, defined in oklch) as `rgb()`, which
 * MapLibre's paint properties understand. Read through a 1×1 canvas.
 */
export function tokenColour(name: string, fallback: string): string {
  try {
    const value = getComputedStyle(document.documentElement).getPropertyValue(name).trim()
    if (!value) return fallback
    const ctx = document.createElement("canvas").getContext("2d", { willReadFrequently: true })
    if (!ctx) return fallback
    ctx.fillStyle = fallback
    ctx.fillStyle = value
    ctx.fillRect(0, 0, 1, 1)
    const [r, g, b] = ctx.getImageData(0, 0, 1, 1).data
    return `rgb(${r}, ${g}, ${b})`
  } catch {
    return fallback
  }
}
