/** True when focus is in a field where Space should type a character, not trigger game shortcuts. */
export function isEditableKeyboardTarget(target: EventTarget | null): boolean {
  const el =
    target instanceof HTMLElement
      ? target
      : typeof document !== 'undefined' && document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
  if (!el) return false;
  if (el.isContentEditable) return true;
  const tag = el.tagName;
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') {
    const input = el as HTMLInputElement;
    if (tag === 'INPUT' && (input.type === 'button' || input.type === 'submit' || input.type === 'checkbox')) {
      return false;
    }
    return true;
  }
  return Boolean(el.closest('input:not([type=button]):not([type=submit]):not([type=checkbox]), textarea, select, [contenteditable="true"]'));
}
