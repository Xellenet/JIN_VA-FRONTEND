"use client"

import { useRef, useState } from "react"
import dynamic from "next/dynamic"
import { MapPin } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { LANDMARK_MAX, coordsText, pinSummary, type PinnedLocation } from "@/lib/location-pin"
import { MapPinGlyph } from "./map-pin-glyph"

// The picker (and, inside it, the map library) loads only when first opened.
const LocationPicker = dynamic(() => import("./location-picker"), { ssr: false })

export interface ExactLocationFieldProps {
  /** Prefix for element ids, unique on the page. */
  id: string
  pin: PinnedLocation | null
  onPinChange: (pin: PinnedLocation | null) => void
  landmark: string
  onLandmarkChange: (value: string) => void
  /** The typed address, so the map can open on that town without GPS. */
  address: string
  disabled?: boolean
}

/**
 * "Pin exact location" (opens the map picker), the pinned preview with Change
 * and Remove, and the optional landmark. Sits under the address field.
 */
export function ExactLocationField({ id, pin, onPinChange, landmark, onLandmarkChange, address, disabled }: ExactLocationFieldProps) {
  const [open, setOpen] = useState(false)
  const [opened, setOpened] = useState(false)
  // After confirming, the "Pin exact location" button is replaced by the
  // preview, so focus goes to its Change button instead.
  const changeRef = useRef<HTMLButtonElement | null>(null)
  const pinRef = useRef<HTMLButtonElement | null>(null)
  const show = () => {
    setOpened(true)
    setOpen(true)
  }

  return (
    <div className="space-y-4">
      {pin ? (
        <div className="flex flex-col gap-3 rounded-lg border bg-muted/30 p-3 sm:flex-row sm:items-center">
          {pin.snapshot ? (
            <div className="relative aspect-[2/1] w-full shrink-0 overflow-hidden rounded-md border bg-muted sm:w-48">
              {/* A data: URL snapshot of the map; next/image adds nothing here. */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={pin.snapshot} alt="" className="h-full w-full object-cover" />
              <MapPinGlyph className="absolute left-1/2 top-1/2 h-7 w-7 -translate-x-1/2 -translate-y-full text-primary drop-shadow" />
            </div>
          ) : (
            <span aria-hidden className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
              <MapPin className="h-5 w-5" />
            </span>
          )}
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-foreground">{pinSummary(pin)}</p>
            <p className="mt-0.5 break-words text-xs text-muted-foreground">
              {pin.label ?? coordsText(pin.latitude, pin.longitude)}
            </p>
            <p className="mt-0.5 text-xs text-muted-foreground">Only the artisan you hire sees the pin.</p>
          </div>
          <div className="flex gap-2 sm:flex-col">
            <Button ref={changeRef} type="button" variant="outline" className="h-11 flex-1 bg-transparent sm:h-9" onClick={show} disabled={disabled}>
              Change<span className="sr-only"> the pinned location</span>
            </Button>
            <Button
              type="button"
              variant="ghost"
              className="h-11 flex-1 text-muted-foreground sm:h-9"
              onClick={() => {
                onPinChange(null)
                requestAnimationFrame(() => pinRef.current?.focus())
              }}
              disabled={disabled}
            >
              Remove<span className="sr-only"> the pin</span>
            </Button>
          </div>
        </div>
      ) : (
        <div className="space-y-1.5">
          <Button ref={pinRef} type="button" variant="outline" className="h-11 gap-2 bg-transparent" onClick={show} disabled={disabled} aria-describedby={`${id}-pin-hint`}>
            <MapPin aria-hidden className="h-4 w-4" />
            Pin exact location
          </Button>
          <p id={`${id}-pin-hint`} className="text-xs text-muted-foreground">
            Opens a map to put a pin on the exact spot. Only the artisan you hire sees it.
          </p>
        </div>
      )}

      <div className="space-y-2">
        <Label htmlFor={`${id}-landmark`}>Landmark (optional)</Label>
        <Input
          id={`${id}-landmark`}
          value={landmark}
          maxLength={LANDMARK_MAX}
          placeholder="e.g. Opposite Adum Post Office, blue gate"
          onChange={(e) => onLandmarkChange(e.target.value)}
          disabled={disabled}
          aria-describedby={`${id}-landmark-hint`}
          className="h-11 sm:h-9"
        />
        <p id={`${id}-landmark-hint`} className="text-xs text-muted-foreground">
          Helps the artisan find the door. Only the artisan you hire sees it.
        </p>
      </div>

      {opened && (
        <LocationPicker
          open={open}
          onOpenChange={setOpen}
          initial={pin}
          addressHint={address}
          onConfirm={onPinChange}
          onCloseAutoFocus={(event) => {
            const el = changeRef.current ?? pinRef.current
            if (el) {
              event.preventDefault()
              el.focus()
            }
          }}
        />
      )}
    </div>
  )
}
