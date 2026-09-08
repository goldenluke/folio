declare module '@retorquere/bibtex-parser' {
  export interface ParsedName {
    readonly firstName?: string;
    readonly lastName?: string;
    readonly prefix?: string;
    readonly suffix?: string;
    readonly name?: string;
  }

  export interface ParsedEntry {
    readonly type: string;
    readonly key: string;
    readonly fields: Readonly<Record<string, unknown>>;
    readonly input?: string;
  }

  export interface ParseError {
    readonly error: string;
    readonly input?: string;
  }

  export interface ParseResult {
    readonly entries: readonly ParsedEntry[];
    readonly errors: readonly ParseError[];
  }

  export function parse(input: string): ParseResult;
}
