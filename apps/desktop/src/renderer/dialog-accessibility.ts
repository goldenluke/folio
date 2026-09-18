import { useEffect, type RefObject } from 'react';
import { focusTrapDestination } from './dialog-navigation.js';

const focusableSelector = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';
let semanticSequence = 0;

/**
 * Normaliza a semântica de diálogos legados sem exigir uma migração de markup
 * em dezenas de superfícies de uma só vez. Componentes novos ainda devem
 * declarar seus IDs explicitamente; este fallback impede modal sem nome ou
 * descrição durante a transição.
 */
export function normalizeDialogSemantics(dialog: HTMLElement): void {
  if (!dialog.hasAttribute('role')) dialog.setAttribute('role', 'dialog');
  if (!dialog.hasAttribute('aria-modal')) dialog.setAttribute('aria-modal', 'true');
  if (!dialog.hasAttribute('aria-label') && !dialog.hasAttribute('aria-labelledby')) {
    const heading = dialog.querySelector<HTMLElement>('h1, h2, h3, h4, [data-dialog-title]');
    if (heading !== null) {
      if (heading.id === '') heading.id = `folio-dialog-title-${++semanticSequence}`;
      dialog.setAttribute('aria-labelledby', heading.id);
    } else dialog.setAttribute('aria-label', 'Janela do Folio');
  }
  if (!dialog.hasAttribute('aria-describedby')) {
    const description = dialog.querySelector<HTMLElement>('p, [data-dialog-description]');
    if (description !== null) {
      if (description.id === '') description.id = `folio-dialog-description-${++semanticSequence}`;
      dialog.setAttribute('aria-describedby', description.id);
    }
  }
}

/** Atualiza botões de fechar anteriores ao sistema de ícones sem duplicar markup em cada diálogo. */
function upgradeLegacyCloseButtons(): void {
  for (const button of Array.from(document.querySelectorAll<HTMLButtonElement>('button'))) {
    if (button.dataset.folioCloseIcon === 'true' || button.textContent?.trim() !== '×') continue;
    button.dataset.folioCloseIcon = 'true';
    button.dataset.dialogClose = '';
    if ((button.getAttribute('aria-label') ?? '').trim() === '') button.setAttribute('aria-label', 'Fechar');
    const icon = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    icon.setAttribute('viewBox', '0 0 24 24');
    icon.setAttribute('fill', 'none');
    icon.setAttribute('stroke', 'currentColor');
    icon.setAttribute('stroke-width', '1.9');
    icon.setAttribute('stroke-linecap', 'round');
    icon.setAttribute('aria-hidden', 'true');
    icon.classList.add('h-4', 'w-4');
    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute('d', 'm6 6 12 12M18 6 6 18');
    icon.append(path);
    button.replaceChildren(icon);
  }
}

/** Keeps keyboard focus inside an open modal and restores it when the modal closes. */
export function useDialogAccessibility(dialog: RefObject<HTMLElement | null>, onClose: () => void): void {
  useEffect(() => {
    if (dialog.current !== null) {
      normalizeDialogSemantics(dialog.current);
      dialog.current.setAttribute('data-folio-dialog-managed', 'true');
    }
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : undefined;
    const focusFirst = (): void => {
      const target = dialog.current?.querySelector<HTMLElement>(focusableSelector);
      target?.focus();
    };
    const timer = window.setTimeout(focusFirst, 0);
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') { event.preventDefault(); onClose(); return; }
      if (event.key !== 'Tab') return;
      const root = dialog.current;
      const targets = root === null ? [] : Array.from(root.querySelectorAll<HTMLElement>(focusableSelector));
      if (targets.length === 0) return;
      const destination = focusTrapDestination(targets, document.activeElement instanceof HTMLElement ? document.activeElement : null, event.shiftKey);
      if (destination !== undefined) { event.preventDefault(); destination.focus(); }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => { window.clearTimeout(timer); document.removeEventListener('keydown', onKeyDown); dialog.current?.removeAttribute('data-folio-dialog-managed'); previous?.focus(); };
  }, [dialog, onClose]);
}

/**
 * Cobertura de transição para diálogos antigos: o shell governa qualquer
 * `role=dialog` que ainda não adotou o hook local. Janelas novas devem usar
 * `useDialogAccessibility`, que marca a raiz e preserva seu próprio callback.
 */
export function useGlobalDialogAccessibility(): void {
  useEffect(() => {
    let lastDialog: HTMLElement | undefined;
    let previous: HTMLElement | undefined;
    const unmanaged = (): HTMLElement | undefined => Array.from(document.querySelectorAll<HTMLElement>('[role="dialog"], [role="alertdialog"]')).filter((item) => !item.hasAttribute('data-folio-dialog-managed')).at(-1);
    const focusFirst = (root: HTMLElement): void => root.querySelector<HTMLElement>(focusableSelector)?.focus();
    const observe = (): void => {
      upgradeLegacyCloseButtons();
      for (const dialog of Array.from(document.querySelectorAll<HTMLElement>('[role="dialog"], [role="alertdialog"]'))) normalizeDialogSemantics(dialog);
      const current = unmanaged();
      if (current === lastDialog) return;
      if (current !== undefined) { previous = document.activeElement instanceof HTMLElement ? document.activeElement : undefined; lastDialog = current; window.setTimeout(() => focusFirst(current), 0); }
      else if (lastDialog !== undefined) { lastDialog = undefined; previous?.focus(); previous = undefined; }
    };
    const mutation = new MutationObserver(observe); mutation.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['role', 'data-folio-dialog-managed'] });
    const onKeyDown = (event: KeyboardEvent): void => {
      const root = unmanaged(); if (root === undefined) return;
      if (event.key === 'Escape') {
        const close = root.querySelector<HTMLElement>('[aria-label^="Fechar"], [data-dialog-close]');
        if (close !== undefined && close !== null) { event.preventDefault(); close.click(); }
        return;
      }
      if (event.key !== 'Tab') return;
      const targets = Array.from(root.querySelectorAll<HTMLElement>(focusableSelector));
      const destination = focusTrapDestination(targets, document.activeElement instanceof HTMLElement ? document.activeElement : null, event.shiftKey);
      if (destination !== undefined) { event.preventDefault(); destination.focus(); }
    };
    observe(); document.addEventListener('keydown', onKeyDown);
    return () => { mutation.disconnect(); document.removeEventListener('keydown', onKeyDown); };
  }, []);
}
