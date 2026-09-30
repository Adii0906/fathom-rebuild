// Copies src/lib + src/app/api + tests to a temp dir and rewrites imports so Node can run them:
//   "@/x" -> relative path, extensionless relative imports -> ".ts".
// Also swaps the two LangGraph wrappers for shims (they need installed packages).
import fs from "node:fs";
import path from "node:path";

const [root, out] = process.argv.slice(2);
const copy = (from, to) => fs.cpSync(path.join(root, from), path.join(out, to), { recursive: true });
copy("src/lib", "src/lib");
copy("src/app/api", "src/app/api");
copy("tests", "tests");
for (const f of ["analysis-graph.ts", "ask-graph.ts"]) fs.copyFileSync(path.join(root, "tests/shims", f), path.join(out, "src/lib/ai", f));
fs.rmSync(path.join(out, "src/lib/ai/model.ts"), { force: true });
fs.rmSync(path.join(out, "tests/shims"), { recursive: true, force: true });

function walk(d) {
  return fs.readdirSync(d, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(path.join(d, e.name)) : [path.join(d, e.name)]));
}
for (const file of walk(out).filter((f) => f.endsWith(".ts"))) {
  let s = fs.readFileSync(file, "utf8");
  s = s.replace(/(from\s+|import\s*\(\s*)"(@\/[^"]+|\.{1,2}\/[^"]*)"/g, (m, pre, spec) => {
    let target = spec;
    if (spec.startsWith("@/")) {
      target = path.relative(path.dirname(file), path.join(out, "src", spec.slice(2)));
      if (!target.startsWith(".")) target = "./" + target;
    }
    if (!/\.(ts|mjs|js|json)$/.test(target)) target += ".ts";
    return `${pre}"${target}"`;
  });
  fs.writeFileSync(file, s);
}
