import type {
  Contributor,
  ContributorRole,
  DocumentMetadata,
  JsonValue,
  PersonName,
  RichText,
} from '@abnt/document-model';
import { asNodeId } from '@abnt/document-model';

/**
 * Frontmatter YAML -> DocumentMetadata.
 *
 * Tolerante de propósito: campo ausente ou com forma inesperada é ignorado em
 * silêncio aqui. Exigir campo é papel do validador de normas — a NBR 6022 é
 * quem diz que artigo precisa de resumo, não o parser. Se este módulo
 * reclamasse, `abnt build` de um rascunho incompleto falharia, e rascunho
 * incompleto é o estado normal de um texto sendo escrito.
 */

const texto = (valor: unknown): string | undefined =>
  typeof valor === 'string' && valor.trim() !== '' ? valor.trim() : undefined;

const listaDeTextos = (valor: unknown): readonly string[] | undefined => {
  if (typeof valor === 'string') return [valor.trim()].filter((s) => s !== '');
  if (!Array.isArray(valor)) return undefined;
  const itens = valor.map(texto).filter((s): s is string => s !== undefined);
  return itens.length > 0 ? itens : undefined;
};

/** M0: metadado vira texto puro. Marcação em título (itálico) entra no M1. */
const comoRichText = (valor: unknown, id: string): RichText | undefined => {
  const s = texto(valor);
  if (s === undefined) return undefined;
  return [{ id: asNodeId(id), type: 'text', value: s }];
};

/**
 * "Silva, João Carlos" -> family: [Silva], given: [João, Carlos]
 * "João Carlos Silva"  -> family: [Silva], given: [João, Carlos]
 *
 * Heurística, e assumidamente frágil para nomes com partícula ("da Silva",
 * "van Dijk") ou sobrenome composto. Nome próprio é um dos problemas mais
 * chatos de bibliografia e a NBR 6023 tem regras específicas de entrada. O
 * O importador bibliográfico do M2 trata nomes de referências com um parser
 * próprio; esta função continua restrita aos autores do documento.
 */
function nomeDePessoa(bruto: string): PersonName {
  const nome = bruto.trim();

  const virgula = nome.indexOf(',');
  if (virgula !== -1) {
    const family = nome.slice(0, virgula).trim().split(/\s+/).filter(Boolean);
    const given = nome.slice(virgula + 1).trim().split(/\s+/).filter(Boolean);
    return given.length > 0 ? { family, given } : { family };
  }

  const partes = nome.split(/\s+/).filter(Boolean);
  if (partes.length === 0) return { literal: nome };
  if (partes.length === 1) return { literal: nome };

  const ultimo = partes[partes.length - 1] as string;
  return { family: [ultimo], given: partes.slice(0, -1) };
}

const PAPEIS_CONHECIDOS = new Set([
  'author',
  'editor',
  'translator',
  'advisor',
  'coadvisor',
  'reviewer',
]);

function papelDeContribuidor(valor: unknown, fallback: ContributorRole): ContributorRole {
  const role = texto(valor);
  if (role === undefined) return fallback;
  if (PAPEIS_CONHECIDOS.has(role) || role.startsWith('custom:')) return role as ContributorRole;
  return `custom:${role}`;
}

function contribuidor(
  valor: unknown,
  fallback: ContributorRole = 'author',
): Contributor | undefined {
  if (typeof valor === 'string') {
    return { role: fallback, name: nomeDePessoa(valor) };
  }
  if (valor === null || typeof valor !== 'object' || Array.isArray(valor)) return undefined;

  const obj = valor as Record<string, unknown>;
  const nome = texto(obj['name']) ?? texto(obj['nome']);
  if (nome === undefined) return undefined;

  const afiliacao = texto(obj['affiliation']) ?? texto(obj['afiliacao']);
  const email = texto(obj['email']);

  return {
    role: papelDeContribuidor(obj['role'] ?? obj['papel'], fallback),
    name: nomeDePessoa(nome),
    ...(afiliacao !== undefined ? { affiliation: afiliacao } : {}),
    ...(email !== undefined ? { email } : {}),
  };
}

/** Quarentena objetos YAML para o subconjunto serializável aceito pela AST. */
function comoJson(valor: unknown): JsonValue | undefined {
  if (valor === null || typeof valor === 'string' || typeof valor === 'boolean') return valor;
  if (typeof valor === 'number') return Number.isFinite(valor) ? valor : undefined;
  if (Array.isArray(valor)) {
    const itens = valor.map(comoJson);
    return itens.some((item) => item === undefined) ? undefined : (itens as JsonValue[]);
  }
  if (typeof valor !== 'object') return undefined;
  const objeto: Record<string, JsonValue> = {};
  for (const [chave, item] of Object.entries(valor)) {
    const normalizado = comoJson(item);
    if (normalizado !== undefined) objeto[chave] = normalizado;
  }
  return objeto;
}

export function metadadosDeFrontmatter(dados: Record<string, unknown>): DocumentMetadata {
  const title = comoRichText(dados['title'] ?? dados['titulo'], 'meta-title');
  const subtitle = comoRichText(dados['subtitle'] ?? dados['subtitulo'], 'meta-subtitle');

  const brutoAutores = dados['authors'] ?? dados['autores'] ?? dados['author'] ?? dados['autor'];
  const listaAutores = Array.isArray(brutoAutores) ? brutoAutores : [brutoAutores];
  const contributors = listaAutores
    .map((valor) => contribuidor(valor, 'author'))
    .filter((c): c is Contributor => c !== undefined);
  const contribuintesAdicionais = (Array.isArray(dados['contributors'])
    ? dados['contributors']
    : dados['contributors'] === undefined
      ? []
      : [dados['contributors']])
    .map((valor) => contribuidor(valor))
    .filter((c): c is Contributor => c !== undefined);

  const keywords = listaDeTextos(dados['keywords'] ?? dados['palavras-chave']);
  const lang = texto(dados['lang']) ?? texto(dados['language']) ?? texto(dados['idioma']);

  // `abstract` é bloco de texto; vira BlockNode para poder conter marcação.
  const resumoBruto = texto(dados['abstract']) ?? texto(dados['resumo']);
  const bibliography = listaDeTextos(dados['bibliography'] ?? dados['bibliografia']);
  const citationConfig = dados['citations'] ?? dados['citation'] ?? dados['citacoes'];
  const citationSystem =
    citationConfig !== null && typeof citationConfig === 'object' && !Array.isArray(citationConfig)
      ? texto((citationConfig as Record<string, unknown>)['system'])
      : undefined;
  const publicationProfile = texto(dados['profile'] ?? dados['perfil']);
  const declaradas = comoJson(dados['properties'] ?? dados['propriedades']);
  const propriedadesDeclaradas: Record<string, JsonValue> =
    declaradas !== null && typeof declaradas === 'object' && !Array.isArray(declaradas)
      ? (declaradas as Record<string, JsonValue>)
      : {};
  const properties: Record<string, JsonValue> = {
    ...propriedadesDeclaradas,
    ...(bibliography !== undefined ? { 'bibliography:files': bibliography } : {}),
    ...(citationSystem !== undefined ? { 'citation:system': citationSystem } : {}),
    ...(publicationProfile !== undefined ? { 'publication:profile': publicationProfile } : {}),
  };

  return {
    ...(title !== undefined ? { title } : {}),
    ...(subtitle !== undefined ? { subtitle } : {}),
    ...(contributors.length + contribuintesAdicionais.length > 0
      ? { contributors: [...contributors, ...contribuintesAdicionais] }
      : {}),
    ...(keywords !== undefined ? { keywords } : {}),
    ...(lang !== undefined ? { languages: [lang] } : {}),
    ...(Object.keys(properties).length > 0 ? { properties } : {}),
    ...(resumoBruto !== undefined
      ? {
          abstract: [
            {
              id: asNodeId('meta-abstract'),
              type: 'paragraph' as const,
              children: [{ id: asNodeId('meta-abstract-text'), type: 'text' as const, value: resumoBruto }],
            },
          ],
        }
      : {}),
  };
}
