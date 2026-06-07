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
  _opts: PosterOptions,
  _io: PosterIO = { cwd: process.cwd(), log: console.log },
): Promise<void> {
  throw new Error('poster command not yet implemented')
}
