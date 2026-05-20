declare module 'better-sqlite3' {
  class Database implements Database.Database {
    constructor(path: string);
    pragma(source: string, options?: { simple?: boolean }): unknown;
    exec(source: string): void;
    prepare(source: string): Database.Statement;
    transaction<T extends (...args: never[]) => unknown>(fn: T): T;
    close(): void;
  }

  namespace Database {
    interface Database {
      pragma(source: string, options?: { simple?: boolean }): unknown;
      exec(source: string): void;
      prepare(source: string): Statement;
      transaction<T extends (...args: never[]) => unknown>(fn: T): T;
      close(): void;
    }

    interface Statement {
      run(...params: unknown[]): { lastInsertRowid: number | bigint; changes: number };
      get(...params: unknown[]): unknown;
      all(...params: unknown[]): unknown[];
    }
  }

  export = Database;
}
