// 本地最小 ambient 声明：@types/node@20 尚无 node:sqlite 类型，但运行时 Node ≥ 22.5 内置该模块。
// 仅声明本项目实际用到的 DatabaseSync / StatementSync 子集（同步 API），避免引入依赖或升级 @types/node。
declare module "node:sqlite" {
  type SQLInputValue = string | number | bigint | Uint8Array | null;
  type SQLRow = Record<string, string | number | bigint | Uint8Array | null>;
  export class StatementSync {
    run(...params: SQLInputValue[]): { changes: number | bigint; lastInsertRowid: number | bigint };
    get(...params: SQLInputValue[]): SQLRow | undefined;
    all(...params: SQLInputValue[]): SQLRow[];
  }
  export class DatabaseSync {
    constructor(location: string, options?: { readOnly?: boolean; enableForeignKeyConstraints?: boolean });
    exec(sql: string): void;
    prepare(sql: string): StatementSync;
    close(): void;
  }
}
