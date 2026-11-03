"use client"

import type React from "react"
import { useRef, useState } from "react"
import Image from "next/image"
import { ChevronsLeftRight } from "lucide-react"
import { PHOTOS, PHOTO_SIZE } from "./landing-content"

/**
 * Before/after comparison. The control is a real `<input type="range">` with
 * a visible label, so arrows, Page Up/Down, Home and End all work. Dragging on
 * the photo (mouse, pen or touch) moves the same value; `touch-action: pan-y`
 * keeps vertical page scrolling on phones.
 *
 * The before photo is revealed with `clip-path` from one CSS variable, so a
 * drag repaints without touching layout.
 */
export function BeforeAfter() {
  const [split, setSplit] = useState(52)
  const frame = useRef<HTMLDivElement>(null)
  const dragging = useRef(false)

  const fromPointer = (clientX: number) => {
    const box = frame.current?.getBoundingClientRect()
    if (!box || box.width === 0) return
    const pct = Math.round(((clientX - box.left) / box.width) * 100)
    setSplit(Math.min(100, Math.max(0, pct)))
  }

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    dragging.current = true
    e.currentTarget.setPointerCapture(e.pointerId)
    fromPointer(e.clientX)
  }
  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (dragging.current) fromPointer(e.clientX)
  }
  const stop = () => {
    dragging.current = false
  }

  const { width, height } = PHOTO_SIZE.leak

  return (
    <figure className="m-0 min-w-0">
      <div
        ref={frame}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={stop}
        onPointerCancel={stop}
        style={{ "--split": `${split}%` } as React.CSSProperties}
        className="relative aspect-[5/6] cursor-ew-resize touch-pan-y overflow-hidden rounded-3xl bg-muted shadow-2xl shadow-brand/30 select-none"
      >
        <Image
          src={PHOTOS.after}
          alt="After: a new chrome waste pipe fitted under the sink"
          width={width}
          height={height}
          sizes="(min-width: 1024px) 560px, 100vw"
          draggable={false}
          className="absolute inset-0 size-full object-cover"
        />
        <Image
          src={PHOTOS.before}
          alt="Before: a corroded brass waste pipe under the sink"
          width={width}
          height={height}
          sizes="(min-width: 1024px) 560px, 100vw"
          draggable={false}
          className="absolute inset-0 size-full object-cover [clip-path:inset(0_calc(100%-var(--split))_0_0)]"
        />
        <span
          aria-hidden="true"
          className="absolute inset-y-0 left-(--split) -ml-px w-0.75 bg-card shadow-[0_0_12px] shadow-black/40"
        />
        <span
          aria-hidden="true"
          className="absolute top-1/2 left-(--split) -mt-6 -ml-6 grid size-12 place-items-center rounded-full bg-card text-primary shadow-lg shadow-black/30"
        >
          <ChevronsLeftRight className="size-5.5" strokeWidth={2.4} />
        </span>
        <span className="absolute top-3.5 left-3.5 rounded-full bg-brand/85 px-3 py-1 text-[0.8125rem] font-semibold text-brand-foreground">
          Before
        </span>
        <span className="absolute top-3.5 right-3.5 rounded-full bg-card px-3 py-1 text-[0.8125rem] font-semibold text-primary">
          After
        </span>
      </div>
      <label htmlFor="lp-compare" className="mt-3.5 mb-1 block text-sm font-semibold">
        Compare before and after
      </label>
      <input
        id="lp-compare"
        type="range"
        min={0}
        max={100}
        step={1}
        value={split}
        onChange={(e) => setSplit(Number(e.target.value))}
        aria-valuetext={`${split}% before, ${100 - split}% after`}
        className="block min-h-11 w-full cursor-pointer accent-primary"
      />
      <figcaption className="text-[0.8125rem] text-muted-foreground">
        Waste pipe replaced · Kwame A., Plumbing · sample
      </figcaption>
    </figure>
  )
}
