import { realpathSync } from "fs";
import { spawn } from "child_process";
import { resolve } from "path";

// Fix OneDrive path mismatch: process.cwd() returns display name path
// but esbuild uses the real filesystem path. This causes dep optimization to fail.
const realCwd = realpathSync(process.cwd());
process.chdir(realCwd);

const viteBin = resolve(realCwd, "node_modules", "vite", "bin", "vite.js");
const child = spawn(
  process.execPath,
  [viteBin, "--host", ...process.argv.slice(2)],
  {
    cwd: realCwd,
    stdio: "inherit",
    env: { ...process.env },
  },
);

child.on("exit", (code) => process.exit(code ?? 0));
