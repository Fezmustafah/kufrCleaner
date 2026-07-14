export interface ReadingDeckHandle {
  destroy(): void;
}

export type ReadingDeckFactory = (dialog: HTMLDialogElement) => ReadingDeckHandle;

export function attachReadingDeck(
  root: Document = document,
  create: ReadingDeckFactory,
): ReadingDeckHandle | null {
  const dialog = root.querySelector<HTMLDialogElement>('dialog[data-reading-deck]');
  if (!dialog) return null;

  try {
    return create(dialog);
  } catch (error) {
    if (import.meta.env.DEV) console.warn('[reading-deck]', error);
    return null;
  }
}
