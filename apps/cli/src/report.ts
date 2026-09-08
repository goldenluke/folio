import type { Diagnostic } from '@abnt/semantics';

/** Cores ANSI, desligadas quando a saída não é um terminal ou NO_COLOR está setado. */
const usarCor = process.stdout.isTTY === true && process.env['NO_COLOR'] === undefined;
const cor = (codigo: string, texto: string): string =>
  usarCor ? `[${codigo}m${texto}[0m` : texto;

export const vermelho = (s: string): string => cor('31', s);
export const amarelo = (s: string): string => cor('33', s);
export const azul = (s: string): string => cor('34', s);
export const cinza = (s: string): string => cor('90', s);
export const verde = (s: string): string => cor('32', s);
export const negrito = (s: string): string => cor('1', s);

const ROTULO = {
  error: (): string => vermelho('error'),
  warning: (): string => amarelo('warning'),
  info: (): string => azul('info'),
} as const;

/**
 * Formata diagnósticos no estilo `arquivo:linha:coluna`, que editores e
 * terminais transformam em link clicável.
 */
export function formatarDiagnosticos(
  diagnosticos: readonly Diagnostic[],
  arquivo: string,
): string {
  if (diagnosticos.length === 0) return '';

  const ordem = { error: 0, warning: 1, info: 2 } as const;
  const ordenados = [...diagnosticos].sort((a, b) => {
    const porSeveridade = ordem[a.severity] - ordem[b.severity];
    if (porSeveridade !== 0) return porSeveridade;
    return (a.source?.start.offset ?? 0) - (b.source?.start.offset ?? 0);
  });

  return ordenados
    .map((d) => {
      const local =
        d.source !== undefined
          ? `${arquivo}:${d.source.start.line ?? 1}:${d.source.start.column ?? 1}`
          : arquivo;
      return `${ROTULO[d.severity]()} ${cinza(d.id)}\n  ${local}\n\n  ${d.message}\n`;
    })
    .join('\n');
}

export function resumo(diagnosticos: readonly Diagnostic[]): string {
  const erros = diagnosticos.filter((d) => d.severity === 'error').length;
  const avisos = diagnosticos.filter((d) => d.severity === 'warning').length;

  if (erros === 0 && avisos === 0) return verde('Nenhum problema encontrado.');

  const partes: string[] = [];
  if (erros > 0) partes.push(vermelho(`${erros} ${erros === 1 ? 'erro' : 'erros'}`));
  if (avisos > 0) partes.push(amarelo(`${avisos} ${avisos === 1 ? 'aviso' : 'avisos'}`));
  return partes.join(', ');
}
