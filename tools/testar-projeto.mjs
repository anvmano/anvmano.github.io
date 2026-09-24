import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";

const npmCli = process.env.npm_execpath;
if (!npmCli) throw new Error("Execute este verificador com npm test.");

const { scripts } = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8"));
const nomes = ["validate", "lint", ...Object.keys(scripts).filter(nome => nome.startsWith("test:"))];
const falhas = [];
for (const nome of nomes) {
    console.log(`\nValidando ${nome}...`);
    const resultado = spawnSync(process.execPath, [npmCli, "run", nome], {
        stdio: "inherit",
        cwd: new URL("../", import.meta.url),
    });
    if (resultado.error || resultado.status !== 0) falhas.push(nome);
}
console.log(`\n${nomes.length - falhas.length}/${nomes.length} comandos aprovados.`);
if (falhas.length) {
    console.error(`Falhas: ${falhas.join(", ")}`);
    process.exitCode = 1;
}
