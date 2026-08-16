import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const raiz = process.cwd();
const view = fs.readFileSync(path.join(raiz, "scripts/views/public-weather-view.js"), "utf8");
const service = fs.readFileSync(path.join(raiz, "scripts/external/external-weather-service.js"), "utf8");
const zoom = fs.readFileSync(path.join(raiz, "scripts/charts/zoom.js"), "utf8");
const loader = fs.readFileSync(path.join(raiz, "scripts/runtime-loader.js"), "utf8");
const html = fs.readFileSync(path.join(raiz, "index.html"), "utf8");

assert.match(view, /const idBusca = \+\+sequenciaBusca/);
assert.match(view, /if \(idBusca !== sequenciaBusca\) return/);
assert.match(view, /definirEstadoBusca\(true\)/);
assert.match(view, /definirEstadoBusca\(false\)/);
assert.match(view, /setAttribute\("aria-busy", String\(carregando\)\)/);
assert.match(view, /ClimateAqi\?\.updateExternal\?\.\(null\)/);
assert.match(view, /ClimateZoom\?\.registrarCards/);
assert.match(view, /aria-invalid/);
assert.match(view, /function aplicarMascaraCep/);
assert.match(view, /sessionStorage\.setItem/);
assert.match(view, /\["latitude", "longitude", "precisao", "cep"\]/);
assert.match(view, /desatualizado/);
assert.match(service, /erro\.esperado = true/);
assert.match(service, /cep_invalido/);
assert.match(service, /cep_nao_encontrado/);
assert.match(zoom, /registrarCards/);
assert.match(zoom, /registrarFechamentoPorEscape\(\);\s*raiz\.querySelectorAll/);
assert.match(zoom, /ClimateAssets\?\.carregarCssZoom/);
assert.match(loader, /function carregarCssZoom\(\)/);
assert.match(html, /id="publicSearchStatus"[^>]*role="status"[^>]*aria-live="polite"/);
assert.match(html, /id="publicResults"[^>]*aria-busy="false"/);

// Simula duas respostas em ordem invertida usando o mesmo contrato de sequência da view.
let sequencia = 0;
let resultadoRenderizado = null;
async function executarSimulado(promessa, valor) {
    const id = ++sequencia;
    await promessa;
    if (id !== sequencia) return;
    resultadoRenderizado = valor;
}
let liberarAntiga;
let liberarNova;
const antiga = new Promise(resolve => { liberarAntiga = resolve; });
const nova = new Promise(resolve => { liberarNova = resolve; });
const primeira = executarSimulado(antiga, "antiga");
const segunda = executarSimulado(nova, "nova");
liberarNova();
await segunda;
liberarAntiga();
await primeira;
assert.equal(resultadoRenderizado, "nova");

console.log("Testes de estado, concorrência e acessibilidade do modo público concluídos com sucesso.");
