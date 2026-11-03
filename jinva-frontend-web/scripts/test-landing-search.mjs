#!/usr/bin/env node
/**
 * The landing page's search form and signup links (`src/lib/landing-search.ts`),
 * and the redirect a signed-out visitor takes through login.
 *
 * Run: `npm run test:landing`. Same convention as the other scripts: no test
 * runner, the shipped modules imported through Node's type stripping, exit 1
 * on failure. No network.
 */
import { pathToFileURL } from "node:url"
import { join } from "node:path"

const lib = (...parts) => pathToFileURL(join(process.cwd(), "src", "lib", ...parts)).href
const search = await import(lib("landing-search.ts"))

// `safeInternalRedirect` reads `globalThis.location.origin` at call time.
const ORIGIN = "https://app.jinva.com"
globalThis.location = { origin: ORIGIN }
const { safeInternalRedirect } = await import(lib("auth.ts"))

let failures = 0
const check = (label, actual, expected) => {
  if (actual !== expected) {
    failures++
    console.error(`FAIL ${label}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`)
  }
}

const PATH = "/dashboard/user/search"
check("search path", search.CUSTOMER_SEARCH_PATH, PATH)

// ── sanitiseLocation ─────────────────────────────────────────────────────────
const loc = search.sanitiseLocation
check("plain place", loc("Osu, Accra"), "Osu, Accra")
check("trims and single-spaces", loc("  East   Legon \n Accra  "), "East Legon Accra")
check("keeps apostrophes, dots, hyphens, slashes", loc("St. John's - Block 3/4"), "St. John's - Block 3/4")
check("keeps accented letters", loc("Kpémé"), "Kpémé")
check("drops markup", loc('<script>alert("x")</script>Tema'), "scriptalert(x)/scriptTema")
check("drops URL-ish punctuation", loc("Tema?x=1&y=2#z%20"), "Temax1y2z20")
check("drops control characters", loc("Ho\u0000\u0007\u001Fe"), "Hoe")
check("non-string", loc(42), "")
check("null", loc(null), "")
check("only junk", loc("<<>>&&"), "")
check("max length", loc("a".repeat(500)).length, search.LOCATION_MAX_LENGTH)
check("max length then trims", loc(`${"a".repeat(79)} b`), "a".repeat(79))

// ── sanitiseServiceId ────────────────────────────────────────────────────────
const sid = search.sanitiseServiceId
check("numeric id", sid("147"), "147")
check("number", sid(147), "147")
check("uuid", sid("3f2a9c1e-0b4d-4e8a-9f1c-2d3e4f5a6b7c"), "3f2a9c1e-0b4d-4e8a-9f1c-2d3e4f5a6b7c")
check("rejects a path", sid("../admin"), "")
check("rejects spaces", sid("1 2"), "")
check("rejects a query", sid("1&role=ADMIN"), "")
check("rejects too long", sid("1".repeat(65)), "")
check("rejects empty", sid(""), "")
check("rejects object", sid({}), "")

// ── buildCustomerSearchHref ──────────────────────────────────────────────────
const href = search.buildCustomerSearchHref
check("no filters", href({}), PATH)
check("service only", href({ serviceId: "147" }), `${PATH}?serviceId=147`)
check("location only", href({ location: "Osu, Accra" }), `${PATH}?location=Osu%2C+Accra`)
check("both", href({ serviceId: "151", location: "Tema" }), `${PATH}?serviceId=151&location=Tema`)
check("bad id dropped", href({ serviceId: "x&y", location: "Tema" }), `${PATH}?location=Tema`)
check("junk location dropped", href({ serviceId: "1", location: "<>" }), `${PATH}?serviceId=1`)
check("extra keys ignored", href({ serviceId: "1", role: "ADMIN", redirect: "//evil" }), `${PATH}?serviceId=1`)

// Only ever the two params, whatever comes in.
{
  const url = new URL(href({ serviceId: "9", location: "Kumasi" }), ORIGIN)
  check("only two params", [...url.searchParams.keys()].join(","), "serviceId,location")
  check("stays on the search path", url.pathname, PATH)
  check("same origin", url.origin, ORIGIN)
}

// ── readCustomerSearchSeed: the search page's half ───────────────────────────
const read = search.readCustomerSearchSeed
{
  const seed = read("?serviceId=147&location=Osu%2C+Accra&page=4")
  check("reads service", seed.serviceId, "147")
  check("reads location", seed.location, "Osu, Accra")
}
{
  const seed = read(new URLSearchParams({ serviceId: "<x>", location: "<b>Ho</b>" }))
  check("sanitises service", seed.serviceId, "")
  check("sanitises location", seed.location, "bHo/b")
}
check("empty search", read("").serviceId, "")
check("null search", read(null).location, "")
{
  const built = href({ serviceId: "150", location: "Adabraka, Accra" })
  const seed = read(new URL(built, ORIGIN).searchParams)
  check("round trip service", seed.serviceId, "150")
  check("round trip location", seed.location, "Adabraka, Accra")
}

// ── The signed-out path: middleware → /login?redirect=<href> → login form ───
// The middleware writes `${pathname}${search}` into `redirect`; the login form
// reads it back with searchParams.get() and passes it to safeInternalRedirect.
for (const input of [
  { serviceId: "147", location: "Osu, Accra" },
  { location: "St. John's - Block 3/4" },
  { serviceId: "151" },
  {},
  { location: "Kpémé" },
]) {
  const target = href(input)
  const loginUrl = new URL("/login", ORIGIN)
  loginUrl.searchParams.set("redirect", target)
  const received = new URL(loginUrl.href).searchParams.get("redirect")
  check(`redirect survives (${JSON.stringify(input)})`, safeInternalRedirect(received, "/dashboard/user"), target)
}

// ── signupHref: whitelisted role values only ─────────────────────────────────
check("client signup", search.signupHref("client"), "/signup?role=CUSTOMER")
check("artisan signup", search.signupHref("artisan"), "/signup?role=ARTISAN")
check("unknown audience", search.signupHref("admin"), "/signup")
check("prototype key", search.signupHref("toString"), "/signup")

// ── toCatalogueOptions: GET /services → select options ──────────────────────
const opts = search.toCatalogueOptions
{
  const out = opts([
    { id: 151, name: "Landscaping", isActive: true },
    { id: "150", name: "  Cleaning  " },
    { id: 149, name: "Hidden", isActive: false },
    { id: "bad id", name: "Bad" },
    { id: 148, name: "" },
    { id: 151, name: "Duplicate" },
    null,
    "junk",
  ])
  check("options count", out.length, 2)
  check("first option", JSON.stringify(out[0]), JSON.stringify({ id: "151", name: "Landscaping" }))
  check("trims names", out[1].name, "Cleaning")
}
check("items envelope", opts({ items: [{ id: 1, name: "Tiling" }] }).length, 1)
check("non-list", opts({ data: 1 }).length, 0)
check("null", opts(null).length, 0)
check("long name capped", opts([{ id: 1, name: "x".repeat(200) }])[0].name.length, 60)

if (failures) {
  console.error(`\n✗ landing search: ${failures} failure(s)`)
  process.exit(1)
}
console.log("✓ landing search: sanitising, URL building, signed-out redirect, signup links, catalogue options")
