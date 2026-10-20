// The project has no @types/node (tsconfig `types` is vite/client only); declare
// just the Node APIs the scaffold test uses.
declare module 'node:fs' {
  const fs: {
    mkdtempSync(prefix: string): string;
    mkdirSync(path: string): void;
    copyFileSync(from: string, to: string): void;
    existsSync(path: string): boolean;
    readFileSync(path: string, encoding: 'utf8'): string;
    rmSync(path: string, options: { recursive: boolean; force: boolean }): void;
  };
  export default fs;
}
declare module 'node:os' {
  const os: { tmpdir(): string };
  export default os;
}
declare module 'node:path' {
  const path: { join(...parts: string[]): string };
  export default path;
}
