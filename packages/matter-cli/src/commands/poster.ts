export interface PosterOptions {
  from: string
  out: string
  exportName: string
  timeSeconds: number
  width: number
  height: number
}

export interface PosterIO {
  cwd: string
  log: (line: string) => void
}

export async function runPoster(
  opts: PosterOptions,
  _io: PosterIO = { cwd: process.cwd(), log: console.log },
): Promise<void> {
  if (!Number.isInteger(opts.width) || opts.width <= 0 || opts.width > 4096) {
    throw new Error(`--width must be a positive integer ≤ 4096 (got ${opts.width})`)
  }
  if (!Number.isInteger(opts.height) || opts.height <= 0 || opts.height > 4096) {
    throw new Error(`--height must be a positive integer ≤ 4096 (got ${opts.height})`)
  }
  if (!Number.isFinite(opts.timeSeconds) || opts.timeSeconds < 0) {
    throw new Error(`--time must be ≥ 0 (got ${opts.timeSeconds})`)
  }
  throw new Error('poster command not yet implemented')
}
