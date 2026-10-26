/**
 * QA ART-08: an artisan's availability has three states, and UNAVAILABLE used
 * to be shown as "Busy" everywhere because each page only knew two.
 */
export function availabilityLabel(status: string | null | undefined): "Available" | "Busy" | "Unavailable" {
  if (status === "AVAILABLE") return "Available"
  if (status === "UNAVAILABLE") return "Unavailable"
  return "Busy"
}
