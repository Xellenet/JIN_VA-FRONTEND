#!/usr/bin/env node
/**
 * Colour-token discipline check — DT5.
 *
 * PRD §6 "Key Frontend Patterns": *"Design tokens used exclusively for colours —
 * no hardcoded Tailwind colour classes (e.g. `bg-primary/10` not
 * `bg-blue-100`)."*
 *
 * This has been reported by three consecutive PRD audits and grew from ~27 files
 * to 37 between two of them, so the rule now has teeth: run
 * `npm run check:colors` (it is part of `npm run verify`) and the build of a PR
 * that reintroduces a palette literal or a hex fails.
 *
 * What it flags:
 *   1. Tailwind palette classes with a numeric shade — `bg-blue-100`,
 *      `text-gray-600`, `border-yellow-200`, `from-red-500`, …
 *   2. Hex colour literals — `#1c4532`, `bg-[#2d5a42]`, `stroke="#f0f0f0"`.
 *
 * What it deliberately does NOT flag:
 *   • `bg-black/50`, `text-white` and friends. They carry no numeric shade, so
 *     they are outside the rule's stated scope, and they are usually right:
 *     a modal scrim should be black in both themes, and white type over a photo
 *     scrim is theme-independent. `src/components/ui/{dialog,sheet,drawer,
 *     alert-dialog}.tsx` and `button.tsx`/`badge.tsx`'s destructive variants are
 *     unmodified shadcn/ui and use them on purpose.
 *   • Anything inside a comment. Migration notes legitimately quote the literals
 *     they replaced ("used to be bg-yellow-100"), and a check that punished that
 *     would just delete the explanation.
 *
 * THE ALLOWLIST BELOW IS THE WHOLE ALLOWLIST. Four files, each with a reason
 * that is about the CSS cascade rather than about convenience. Adding a fifth
 * entry should require the same standard of argument.
 */
import { readFileSync } from "node:fs"
import { readdir } from "node:fs/promises"
import { join, relative, sep } from "node:path"

const ROOT = process.cwd()
const SRC = join(ROOT, "src")

/** file path (posix, relative to the package root) -> why it is exempt */
const ALLOWLIST = new Map([
  [
    "src/app/opengraph-image.tsx",
    "next/og's ImageResponse renders in a Satori runtime OUTSIDE the CSS cascade: " +
      "it cannot read var(--brand) or see the Tailwind theme at all, so the two brand " +
      "colours must be inlined. The file carries a comment beside each literal " +
      "pointing back at globals.css.",
  ],
  [
    "src/app/globals.css",
    "This is where the tokens are DEFINED. The only hexes present are inside comments " +
      "recording the sRGB values the oklch/oklab tokens were derived from.",
  ],
  [
    "src/app/global-error.tsx",
    "A root error boundary that renders its own <html> with a standalone <style> block. " +
      "It has to be self-contained precisely because it may run when the app's stylesheet " +
      "or theme has failed to load, so it cannot depend on tokens.",
  ],
  [
    "src/components/ui/chart.tsx",
    "Unmodified shadcn/ui. Its hexes are inside ATTRIBUTE SELECTORS matching Recharts' " +
      "own hardcoded defaults — [&_.recharts-cartesian-grid_line[stroke='#ccc']] — in " +
      "order to override them with stroke-border. They select colours, they don't apply any.",
  ],
])

const PALETTE_FAMILIES = [
  "red", "green", "blue", "yellow", "orange", "purple", "pink", "indigo", "amber",
  "emerald", "teal", "cyan", "sky", "violet", "fuchsia", "rose", "lime",
  "slate", "gray", "zinc", "neutral", "stone",
]
const PALETTE_RE = new RegExp(
  String.raw`\b(?:bg|text|border|ring|outline|divide|fill|stroke|shadow|from|to|via|accent|caret|decoration|placeholder)-(?:${PALETTE_FAMILIES.join("|")})-\d{2,3}\b`,
  "g",
)
const HEX_RE = /#[0-9a-fA-F]{6}\b|#[0-9a-fA-F]{3}\b/g

/**
 * Blank out comments so a migration note quoting an old class name doesn't trip
 * the check. Replaces with spaces rather than deleting, to keep line numbers and
 * column offsets honest.
 */
function stripComments(source) {
  let out = source.replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, " "))
  // Line comments, but not the "//" in a URL such as https://…
  out = out.replace(/(^|[^:\\])\/\/[^\n]*/g, (m, lead) => lead + " ".repeat(m.length - lead.length))
  return out
}

async function* walk(dir) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name)
    if (entry.isDirectory()) yield* walk(full)
    else if (/\.(tsx?|css)$/.test(entry.name)) yield full
  }
}

const findings = []
let scanned = 0

for await (const file of walk(SRC)) {
  const rel = relative(ROOT, file).split(sep).join("/")
  if (ALLOWLIST.has(rel)) continue
  scanned++

  const code = stripComments(readFileSync(file, "utf8"))
  code.split("\n").forEach((line, i) => {
    for (const re of [PALETTE_RE, HEX_RE]) {
      re.lastIndex = 0
      let m
      while ((m = re.exec(line)) !== null) {
        findings.push({ file: rel, line: i + 1, match: m[0], text: line.trim().slice(0, 110) })
      }
    }
  })
}

if (findings.length === 0) {
  console.log(
    `✓ colour tokens: ${scanned} files scanned, 0 hardcoded palette classes or hex literals.\n` +
      `  ${ALLOWLIST.size} allowlisted files (see the ALLOWLIST in scripts/check-color-tokens.mjs).`,
  )
  process.exit(0)
}

console.error(`✗ colour tokens: ${findings.length} hardcoded colour(s) in ${new Set(findings.map((f) => f.file)).size} file(s).\n`)
for (const f of findings) {
  console.error(`  ${f.file}:${f.line}  ${f.match}`)
  console.error(`    ${f.text}`)
}
console.error(
  "\nUse a design token instead (PRD §6). The semantic ones live in src/app/globals.css:\n" +
    "  --primary  --destructive  --success  --warning  --attention  --info  --muted  --border\n" +
    "  --brand / --brand-accent / --brand-foreground  for the deep-green marketing surface\n" +
    "  --rating   for the gold star\n" +
    "Tinted pill idiom: bg-<token>/10 text-<token> border-<token>/20\n" +
    "If a file genuinely cannot read CSS custom properties, add it to the ALLOWLIST in\n" +
    "this script with the reason — not because it is inconvenient to fix.\n",
)
process.exit(1)
