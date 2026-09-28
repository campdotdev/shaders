/**
 * The opening half of the docs search: whether the panel is open, the Cmd+k
 * shortcut that toggles it, and where focus goes when it closes. search.tsx
 * hands the open state to the Base UI Dialog and wires rememberFocus and
 * finalFocus onto the trigger and the panel.
 */
import { useEffect, useRef, useState } from 'react';

// The control that had focus, or null when nothing did. The browser parks
// focus on the body when no control holds it, and that is no place to
// send focus back to.
function focusedControl(): HTMLElement | null {
  const focusedElement = document.activeElement;

  return focusedElement instanceof HTMLElement && focusedElement !== document.body
    ? focusedElement
    : null;
}

// Whether an element can take focus back: still in the document and laid
// out, which rules out a control CSS hid while the panel was open.
function isShown(element: HTMLElement | null): element is HTMLElement {
  return element !== null && element.isConnected && element.getClientRects().length > 0;
}

// Both modifiers on purpose, with no platform detection: the hint on the
// trigger reads the one literal "Cmd+k" either way.
function isToggleShortcut(event: KeyboardEvent): boolean {
  return (event.metaKey || event.ctrlKey) && event.key === 'k';
}

export function usePanelOpen() {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const focusBeforeOpenRef = useRef<HTMLElement | null>(null);

  // ---------------------------------------------
  // Opening
  // ---------------------------------------------

  // Cmd+k and Ctrl+k toggle the panel from anywhere on the page, so the
  // shortcut both opens and, when the panel is already up, closes. Escape,
  // the backdrop press, and the esc hint all go through Base UI's
  // onOpenChange in search.tsx.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (!isToggleShortcut(event)) return;
      event.preventDefault();
      if (!open) focusBeforeOpenRef.current = focusedControl();
      setOpen(!open);
    };

    window.addEventListener('keydown', onKey);

    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  // The trigger's pointerdown lands before the trigger takes focus, so this
  // records the control the reader was on rather than the trigger itself.
  const rememberFocus = () => {
    focusBeforeOpenRef.current = focusedControl();
  };

  // ---------------------------------------------
  // Closing
  // ---------------------------------------------

  // On close, the visible desktop trigger wins. If it became hidden while
  // the panel was open, focus returns to the visible control that had it
  // before the trigger or shortcut opened, and failing that, Base UI's
  // default.
  const finalFocus = () => {
    const triggerElement = triggerRef.current;

    if (isShown(triggerElement)) return triggerElement;
    const focusBeforeOpen = focusBeforeOpenRef.current;

    return isShown(focusBeforeOpen) ? focusBeforeOpen : null;
  };

  return { finalFocus, open, rememberFocus, setOpen, triggerRef };
}
