import type { Pane } from 'tweakpane';

export function addCopyButtons(
  pane: Pane,
  getCopyJsx: () => string,
  getCopyParams: () => string,
): void {
  const flashCopied = (button: { title: string }, original: string) => {
    button.title = 'Copied!';
    pane.refresh();
    setTimeout(() => {
      button.title = original;
      pane.refresh();
    }, 1200);
  };

  const jsxButton = pane.addButton({ title: 'Copy JSX' });

  jsxButton.on('click', () => {
    void navigator.clipboard.writeText(getCopyJsx()).then(() => flashCopied(jsxButton, 'Copy JSX'));
  });

  const paramsButton = pane.addButton({ title: 'Copy params' });

  paramsButton.on('click', () => {
    void navigator.clipboard
      .writeText(getCopyParams())
      .then(() => flashCopied(paramsButton, 'Copy params'));
  });

  pane.addBlade({ view: 'separator' });
}
