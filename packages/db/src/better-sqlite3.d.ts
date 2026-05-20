declare module 'better-sqlite3' {
  const Database: {
    new (filename: string, options?: Database.Options): Database.Database;
    (filename: string, options?: Database.Options): Database.Database;
  };

  namespace Database {
    interface Options {
      readonly?: boolean;
      fileMustExist?: boolean;
      timeout?: number;
      verbose?: (message?: unknown, ...additionalArgs: unknown[]) => void;
    }

    interface RunResult {
      changes: number;
      lastInsertRowid: number | bigint;
    }

    interface Statement {
      run(...params: unknown[]): RunResult;
      get(...params: unknown[]): unknown;
      all(...params: unknown[]): unknown[];
    }

    interface Database {
      prepare(source: string): Statement;
      transaction<T extends (...args: never[]) => unknown>(fn: T): T;
      pragma(source: string, options?: { simple?: boolean }): unknown;
      exec(source: string): void;
      close(): void;
    }
  }

  export = Database;
}
