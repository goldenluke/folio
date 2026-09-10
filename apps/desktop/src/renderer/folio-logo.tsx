import type { JSX } from 'react';

/** Marca do Folio: páginas sobrepostas formam um F e sugerem um caderno de pesquisa. */
export function FolioLogo({ size = 40, label = true }: { readonly size?: number; readonly label?: boolean }): JSX.Element {
  return <span className="inline-flex items-center gap-2.5" aria-label="Folio">
    <svg width={size} height={size} viewBox="0 0 48 48" fill="none" aria-hidden="true" className="shrink-0 drop-shadow-sm">
      <defs><linearGradient id="folio-logo-gradient" x1="7" y1="5" x2="42" y2="43" gradientUnits="userSpaceOnUse"><stop stopColor="#6366f1" /><stop offset="1" stopColor="#4338ca" /></linearGradient></defs>
      <rect x="5" y="4" width="31" height="37" rx="9" fill="url(#folio-logo-gradient)" />
      <path d="M17 14.5h13.5M17 20h10M17 25.5h13.5M17 31h8" stroke="white" strokeWidth="3" strokeLinecap="round" />
      <path d="M36 12h2.5A4.5 4.5 0 0 1 43 16.5v22A4.5 4.5 0 0 1 38.5 43H17" stroke="#a5b4fc" strokeWidth="2.5" strokeLinecap="round" />
    </svg>
    {label && <span className="min-w-0"><span className="block text-base font-extrabold tracking-tight text-slate-900">Folio</span><span className="block text-[10px] font-bold tracking-[0.14em] text-indigo-500">AMBIENTE ACADÊMICO</span></span>}
  </span>;
}
