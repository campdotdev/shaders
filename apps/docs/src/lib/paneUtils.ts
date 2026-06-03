import type { Pane } from 'tweakpane'

export function addCopyButtons(
  pane: Pane,
  getCopyJsx: () => string,
  getCopyParams: () => string,
): void {
  const flashCopied = (btn: { title: string }, original: string) => {
    btn.title = 'Copied!'
    pane.refresh()
    setTimeout(() => {
      btn.title = original
      pane.refresh()
    }, 1200)
  }

  const jsxBtn = pane.addButton({ title: 'Copy JSX' })

  jsxBtn.on('click', () => {
    void navigator.clipboard.writeText(getCopyJsx()).then(() => flashCopied(jsxBtn, 'Copy JSX'))
  })

  const paramsBtn = pane.addButton({ title: 'Copy params' })

  paramsBtn.on('click', () => {
    void navigator.clipboard
      .writeText(getCopyParams())
      .then(() => flashCopied(paramsBtn, 'Copy params'))
  })

  pane.addBlade({ view: 'separator' })
}
