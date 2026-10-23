import assert from "node:assert/strict";
import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { performance } from "node:perf_hooks";
import { chromium } from "playwright-core";

const arquivoExport = process.argv[2];
if (!arquivoExport) throw new Error("Uso: node tools/medir-carga-local.mjs <export-rtdb.json>");
const historico = JSON.parse(fs.readFileSync(arquivoExport, "utf8")).historico;
const nomes = ["Temperatura", "NascePorDoSol", "Aquario", "AirQuality"];
for (const nome of nomes) assert.ok(historico?.[nome], `Histórico ausente: ${nome}`);

const raiz = process.cwd();
const chrome = ["C:/Program Files/Google/Chrome/Application/chrome.exe", "C:/Program Files (x86)/Google/Chrome/Application/chrome.exe"]
    .find(fs.existsSync);
assert.ok(chrome, "Chrome não encontrado.");

const cenarios = {
    completo: Object.fromEntries(nomes.map(nome => [nome, historico[nome]])),
    // shortcut: recorte fixo do export de 22/10/2026; atualize a data ao medir outro snapshot.
    aquarioDoisDias: Object.fromEntries(nomes.map(nome => [nome, nome === "Aquario"
        ? Object.fromEntries(["21-10-2026", "22-10-2026"].filter(data => historico[nome][data]).map(data => [data, historico[nome][data]]))
        : historico[nome]])),
};
let cenarioAtual = "completo";
const servidor = http.createServer((requisicao, resposta) => {
    const url = new URL(requisicao.url, "http://localhost");
    if (url.pathname.startsWith("/__fixture/")) {
        const nome = url.pathname.slice("/__fixture/".length);
        if (!nomes.includes(nome)) return resposta.writeHead(404).end();
        resposta.setHeader("Content-Type", "application/json");
        resposta.setHeader("Cache-Control", "no-store");
        return resposta.end(JSON.stringify(cenarios[cenarioAtual][nome]));
    }
    const relativo = url.pathname === "/" ? "index.html" : decodeURIComponent(url.pathname.slice(1));
    const arquivo = path.resolve(raiz, relativo);
    if (!arquivo.startsWith(`${raiz}${path.sep}`) || !fs.existsSync(arquivo) || fs.statSync(arquivo).isDirectory()) {
        return resposta.writeHead(404).end();
    }
    const tipos = { ".html": "text/html", ".css": "text/css", ".js": "text/javascript", ".svg": "image/svg+xml", ".png": "image/png" };
    resposta.setHeader("Content-Type", tipos[path.extname(arquivo)] || "application/octet-stream");
    fs.createReadStream(arquivo).pipe(resposta);
});
await new Promise(resolver => servidor.listen(0, "127.0.0.1", resolver));
const navegador = await chromium.launch({ executablePath: chrome, headless: true });
const origem = `http://127.0.0.1:${servidor.address().port}`;

const authMock = `window.ClimateAuthService = {
    observarEstado: async callback => { callback({ email: "fixture@local" }); },
    ehUsuarioInterno: () => true,
    obterUsuarioAtual: () => ({ email: "fixture@local" }),
    sair: async () => {},
};`;
const firebaseMock = `window.FirebaseService = {
    trackLoadStart() {}, trackLoadEnd() {}, setLoading() {}, handleError() {},
    initializeDatabase: async () => {},
    listenToPath(caminho, callback, aoErro) {
        let ativo = true;
        fetch("/__fixture/" + caminho.split("/").at(-1))
            .then(resposta => resposta.json())
            .then(dados => { if (ativo) { callback(dados); window.__fixtureCount++; } })
            .catch(erro => aoErro?.(erro));
        return () => { ativo = false; };
    },
};`;

function metricas(medicoes) {
    return Object.fromEntries(medicoes.metrics.map(metrica => [metrica.name, metrica.value]));
}

async function medir(cenario) {
    cenarioAtual = cenario;
    const contexto = await navegador.newContext({ viewport: { width: 1440, height: 900 } });
    const pagina = await contexto.newPage();
    await pagina.addInitScript(() => {
        const DataReal = Date;
        window.Date = class extends DataReal {
            constructor(...args) { super(...(args.length ? args : [2026, 9, 22, 20])); }
            static now() { return new DataReal(2026, 9, 22, 20).getTime(); }
        };
        window.__fixtureCount = 0;
    });
    await pagina.route("**/scripts/auth/auth-service.js*", rota => rota.fulfill({ contentType: "text/javascript", body: authMock }));
    await pagina.route("**/scripts/firebase-service.js*", rota => rota.fulfill({ contentType: "text/javascript", body: firebaseMock }));
    const cliente = await contexto.newCDPSession(pagina);
    await cliente.send("Performance.enable");
    await cliente.send("Network.enable");
    let bytesFixture = 0;
    const requisicoesFixture = new Set();
    cliente.on("Network.responseReceived", evento => {
        if (evento.response.url.startsWith(`${origem}/__fixture/`)) requisicoesFixture.add(evento.requestId);
    });
    cliente.on("Network.loadingFinished", evento => {
        if (requisicoesFixture.has(evento.requestId)) bytesFixture += evento.encodedDataLength;
    });
    const inicio = performance.now();
    await pagina.goto(origem, { waitUntil: "domcontentloaded" });
    await pagina.waitForFunction(() => window.__fixtureCount === 4, null, { timeout: 30000 });
    const ateDados = performance.now() - inicio;
    await pagina.waitForFunction(() => !!window.Chart, null, { timeout: 30000 });
    await pagina.evaluate(() => new Promise(resolver => requestAnimationFrame(() => requestAnimationFrame(resolver))));
    const ateGraficos = performance.now() - inicio;
    const browser = await pagina.evaluate(() => ({
        charts: Object.keys(window.Chart.instances).length,
    }));
    assert.equal(browser.charts, 4, "O perfil requer os quatro gráficos da estação renderizados.");
    const m = metricas(await cliente.send("Performance.getMetrics"));
    await contexto.close();
    return {
        cenario,
        ateDadosMs: Math.round(ateDados),
        ateGraficosMs: Math.round(ateGraficos),
        taskMs: Math.round((m.TaskDuration || 0) * 1000),
        scriptMs: Math.round((m.ScriptDuration || 0) * 1000),
        layoutMs: Math.round((m.LayoutDuration || 0) * 1000),
        heapMiB: Math.round((m.JSHeapUsedSize || 0) / 1048576 * 10) / 10,
        domNodes: m.Nodes,
        httpFixtureEncodedBytes: bytesFixture,
        charts: browser.charts,
    };
}

try {
    for (const cenario of ["completo", "aquarioDoisDias", "aquarioDoisDias", "completo", "completo", "aquarioDoisDias"]) {
        console.log(JSON.stringify(await medir(cenario)));
    }
} finally {
    await navegador.close();
    await new Promise(resolver => servidor.close(resolver));
}
