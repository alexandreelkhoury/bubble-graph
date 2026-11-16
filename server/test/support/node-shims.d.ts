// Minimal typings for the few Node built-ins the server tests use (node:sqlite for the billing tests, node:fs for the
// deploy-check test). The server tsconfig loads @cloudflare/workers-types, not @types/node, so they are declared by
// hand. node:sqlite is flag-free in Node 22.22.
declare module "node:sqlite" {
  export class StatementSync {
    all(...params: unknown[]): Record<string, unknown>[];
    run(...params: unknown[]): { changes: number | bigint; lastInsertRowid: number | bigint };
  }
  export class DatabaseSync {
    constructor(path: string);
    exec(sql: string): void;
    prepare(sql: string): StatementSync;
    close(): void;
  }
}

declare module "node:fs" {
  export function readFileSync(path: string | URL, encoding: "utf8"): string;
  export function mkdtempSync(prefix: string): string;
  export function mkdirSync(path: string): void;
  export function writeFileSync(path: string, data: string): void;
  export function rmSync(path: string, opts: { recursive: boolean; force: boolean }): void;
}

declare module "node:os" {
  export function tmpdir(): string;
}

declare module "node:path" {
  export function join(...parts: string[]): string;
}

interface ImportMeta { readonly url: string }
