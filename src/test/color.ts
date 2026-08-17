// Color math for the palette test (src/lib/categories.test.ts).
//
// A port of the checks in the dataviz skill's `validate_palette.js`, kept in the
// repo so CI can run them: the skill is an authoring tool that isn't installed
// on the CI runner, and the invariant it verified needs to hold on every commit,
// not only on the commit where someone remembered to re-run it.
//
// Everything here is the standard sRGB → linear → OKLab pipeline plus the
// Machado, Oliveira & Fernandes (2009) CVD transforms at severity 1.0. Changing
// the simulation model would move borderline pairs and invalidate the
// thresholds calibrated against it, so don't swap it out casually.

/** Machado, Oliveira & Fernandes (2009), severity 1.0, applied in linear RGB. */
const MACHADO = {
  protan: [
    [0.152286, 1.052583, -0.204868],
    [0.114503, 0.786281, 0.099216],
    [-0.003882, -0.048116, 1.051998],
  ],
  deutan: [
    [0.367322, 0.860646, -0.227968],
    [0.28008, 0.672501, 0.047413],
    [-0.01182, 0.04294, 0.968881],
  ],
  tritan: [
    [1.255528, -0.076749, -0.178779],
    [-0.078411, 0.930809, 0.147602],
    [0.004733, 0.691367, 0.3039],
  ],
} as const

export type CvdKind = keyof typeof MACHADO

type Rgb = [number, number, number]

function hexToSrgb(hex: string): Rgb {
  const h = hex.trim().replace(/^#/, '')
  if (!/^[0-9a-fA-F]{6}$/.test(h)) throw new Error(`not a #rrggbb color: ${hex}`)
  return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16) / 255) as Rgb
}

const toLinear = (c: number) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4)

const linearRgb = (hex: string): Rgb => hexToSrgb(hex).map(toLinear) as Rgb

/** WCAG 2.x contrast ratio between two colors, 1–21. */
export function contrast(a: string, b: string): number {
  const luminance = (hex: string) => {
    const [r, g, bl] = linearRgb(hex)
    return 0.2126 * r + 0.7152 * g + 0.0722 * bl
  }
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x)
  return (hi + 0.05) / (lo + 0.05)
}

function oklabFromLinear([r, g, b]: Rgb): Rgb {
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b)
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b)
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b)
  return [
    0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
  ]
}

/** OKLCH lightness (0–1) of a color. */
export function lightness(hex: string): number {
  return oklabFromLinear(linearRgb(hex))[0]
}

/** OKLCH chroma of a color; below ~0.10 a hue reads as gray. */
export function chroma(hex: string): number {
  const [, a, b] = oklabFromLinear(linearRgb(hex))
  return Math.hypot(a, b)
}

function simulate(hex: string, kind: CvdKind): Rgb {
  const [r, g, b] = linearRgb(hex)
  const m = MACHADO[kind]
  const clamp = (c: number) => Math.max(0, Math.min(1, c))
  return [
    clamp(m[0][0] * r + m[0][1] * g + m[0][2] * b),
    clamp(m[1][0] * r + m[1][1] * g + m[1][2] * b),
    clamp(m[2][0] * r + m[2][1] * g + m[2][2] * b),
  ]
}

/**
 * Euclidean distance between two colors in OKLab, ×100. Omit `kind` for normal
 * vision; pass one to compare them as a dichromat sees them.
 */
export function deltaE(a: string, b: string, kind?: CvdKind): number {
  const x = oklabFromLinear(kind ? simulate(a, kind) : linearRgb(a))
  const y = oklabFromLinear(kind ? simulate(b, kind) : linearRgb(b))
  return 100 * Math.hypot(x[0] - y[0], x[1] - y[1], x[2] - y[2])
}

/** Every unordered pair of a list, as `[a, b]` value pairs. */
export function allPairs<T>(items: T[]): [T, T][] {
  return items.flatMap((a, i) => items.slice(i + 1).map((b): [T, T] => [a, b]))
}
