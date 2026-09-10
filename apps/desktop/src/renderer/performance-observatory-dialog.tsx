import { useEffect, useState, type JSX } from 'react';

import { clearPerformanceSamples, subscribePerformanceSamples, summarizePerformanceSamples, type PerformanceSample } from './shell/performance.js';

const operationLabels: Readonly<Record<string, string>> = {
  startup: 'Inicialização',
  'vault-open': 'Abrir vault',
  'editor-open': 'Abrir documento',
  preview: 'Preview',
  search: 'Busca',
  graph: 'Grafo',
  'pdf-load': 'Carregar PDF',
  'pdf-search': 'Buscar no PDF',
  'export-pdf': 'Exportar PDF (com diálogo de salvar)',
  'export-docx': 'Exportar DOCX (com diálogo de salvar)',
  'project-dashboard': 'Painel do projeto',
  home: 'Home',
};

const ms = (value: number): string => `${value.toFixed(0)} ms`;

export function PerformanceObservatoryDialog({ onClose }: { readonly onClose: () => void }): JSX.Element {
  const [samples, setSamples] = useState<readonly PerformanceSample[]>([]);
  useEffect(() => subscribePerformanceSamples(setSamples), []);
  const stats = summarizePerformanceSamples(samples);

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/40 p-5" role="presentation">
      <section role="dialog" aria-modal="true" aria-labelledby="performance-title" className="flex max-h-[82vh] w-full max-w-2xl flex-col rounded-xl border border-slate-200 bg-white p-5 shadow-2xl">
        <div className="flex items-start gap-3">
          <div>
            <h2 id="performance-title" className="text-lg font-bold text-slate-900">Performance Observatory</h2>
            <p className="mt-0.5 text-sm text-slate-500">Medido só nesta sessão, só neste processo — nunca sai da máquina, nunca é enviado a lugar nenhum.</p>
          </div>
          <button type="button" aria-label="Fechar" className="folio-control ml-auto grid h-8 w-8 place-items-center rounded-lg text-lg" onClick={onClose}>×</button>
        </div>
        <div className="mt-4 min-h-0 flex-1 overflow-auto">
          {stats.length === 0 ? (
            <p className="rounded-lg border border-dashed border-slate-300 p-6 text-center text-sm text-slate-500">
              Nenhuma medição ainda. Abra um documento, faça uma busca, abra o grafo ou exporte algo — as durações aparecem aqui.
            </p>
          ) : (
            <table className="w-full border-collapse text-left text-sm">
              <thead className="text-xs uppercase tracking-wide text-slate-400">
                <tr>
                  <th className="border-b border-slate-200 py-2 pr-3 font-semibold">Operação</th>
                  <th className="border-b border-slate-200 py-2 pr-3 font-semibold">Amostras</th>
                  <th className="border-b border-slate-200 py-2 pr-3 font-semibold">Última</th>
                  <th className="border-b border-slate-200 py-2 pr-3 font-semibold">Média</th>
                  <th className="border-b border-slate-200 py-2 pr-3 font-semibold">Mín</th>
                  <th className="border-b border-slate-200 py-2 font-semibold">Máx</th>
                </tr>
              </thead>
              <tbody>
                {stats.map((stat) => (
                  <tr key={stat.operation} className="border-b border-slate-100">
                    <td className="py-2 pr-3 font-medium text-slate-800">{operationLabels[stat.operation] ?? stat.operation}</td>
                    <td className="py-2 pr-3 text-slate-600">{stat.count}</td>
                    <td className="py-2 pr-3 text-slate-600">{ms(stat.lastMs)}</td>
                    <td className="py-2 pr-3 text-slate-600">{ms(stat.avgMs)}</td>
                    <td className="py-2 pr-3 text-slate-600">{ms(stat.minMs)}</td>
                    <td className="py-2 text-slate-600">{ms(stat.maxMs)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
        <div className="mt-4 flex justify-end">
          <button
            type="button"
            disabled={samples.length === 0}
            className="rounded-lg border border-rose-200 px-3 py-2 text-sm font-semibold text-rose-600 hover:bg-rose-50 disabled:opacity-40"
            onClick={clearPerformanceSamples}
          >
            Limpar medições
          </button>
        </div>
      </section>
    </div>
  );
}
