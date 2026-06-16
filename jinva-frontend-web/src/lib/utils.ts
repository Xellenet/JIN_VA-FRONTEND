import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function naviiAvatar(seed: string, size = 96): string {
  return `https://api.navii.dev/avatar/${encodeURIComponent(seed)}?size=${size}&packs=command-center&style=neutral&mood=serious&tileBg=auto`
}
