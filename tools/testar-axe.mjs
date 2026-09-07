import assert from "node:assert/strict";
import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { chromium } from "playwright-core";

const raiz = process.cwd();
const executavel = [
    "C:/Program Files/Google/Chrome/Application/chrome.exe",
    "C:/Program Files (x86)/Google/Chrome/Application/chrome.exe",
    "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
].find(fs.existsSync);

assert.ok(executavel, "Chrome ou Edge não encontrado para o teste axe.");

const servidor = http.createServer((requisicao, resposta) => {
    const url = new URL(requisicao.url, "http://localhost");
    const relativo = url.pathname === "/" ? "index.html" : decodeURIComponent(url.pathname.slice(1));
    const arquivo = path.resolve(raiz, relativo);
    if (!arquivo.startsWith(raiz) || !fs.existsSync(arquivo) || fs.statSync(arquivo).isDirectory()) {
        resposta.writeHead(404).end();
        return;
    }
    const tipos = { ".html": "text/html", ".css": "text/css", ".js": "text/javascript", ".svg": "image/svg+xml", ".png": "image/png" };
    resposta.setHeader("Content-Type", tipos[path.extname(arquivo)] || "application/octet-stream");
    fs.createReadStream(arquivo).pipe(resposta);
});

await new Promise(resolve => servidor.listen(0, "127.0.0.1", resolve));
const porta = servidor.address().port;
const navegador = await chromium.launch({ executablePath: executavel, headless: true });

try {
    const pagina = await navegador.newPage({ viewport: { width: 390, height: 844 } });
    await pagina.goto(`http://127.0.0.1:${porta}/`, { waitUntil: "domcontentloaded" });
    await pagina.addScriptTag({ path: path.join(raiz, "node_modules/axe-core/axe.min.js") });

    async function validarEstado(nome, preparar) {
        if (preparar) await pagina.evaluate(preparar);
        const resultado = await pagina.evaluate(async () => axe.run(document, {
            resultTypes: ["violations"],
            rules: { "color-contrast": { enabled: true } },
        }));
        const graves = resultado.violations.filter(item => ["critical", "serious"].includes(item.impact));
        assert.deepEqual(graves.map(item => `${item.id}: ${item.help}`), [], `Falhas axe em ${nome}`);
    }

    await validarEstado("estado inicial");
    await validarEstado("popover AQI", () => document.getElementById("aqiPopover")?.removeAttribute("hidden"));
    await validarEstado("chat aberto", () => {
        document.getElementById("aqiPopover")?.setAttribute("hidden", "");
        const chat = document.getElementById("aiChat");
        const painel = document.getElementById("aiChatPanel");
        chat?.classList.add("is-open");
        painel?.removeAttribute("hidden");
    });

    const canvasesSemNome = await pagina.locator("canvas:not([aria-label])").count();
    assert.equal(canvasesSemNome, 0, "Todos os canvases devem possuir nome acessível.");

    const paginaPaisagem = await navegador.newPage({ viewport: { width: 720, height: 360 } });
    await paginaPaisagem.goto(`http://127.0.0.1:${porta}/`, { waitUntil: "domcontentloaded" });
    const layoutPaisagem = await paginaPaisagem.evaluate(() => {
        document.getElementById("privateApp")?.removeAttribute("hidden");
        const abas = document.querySelector(".tab-nav")?.getBoundingClientRect();
        const toolbar = document.querySelector(".toolbar")?.getBoundingClientRect();
        const grupoToolbar = document.querySelector(".toolbar-group");
        return {
            colunas: getComputedStyle(document.querySelector(".tab-nav")).gridTemplateColumns.split(" ").length,
            larguraAbas: abas?.width ?? 0,
            larguraToolbar: toolbar?.width ?? 0,
            abasAntesDoToolbar: (abas?.bottom ?? 0) <= (toolbar?.top ?? 0),
            toolbarSemEstouro: grupoToolbar?.scrollWidth === grupoToolbar?.clientWidth,
        };
    });
    assert.equal(layoutPaisagem.colunas, 4, "Paisagem deve manter as quatro abas em colunas equivalentes.");
    assert.ok(layoutPaisagem.abasAntesDoToolbar, "Em paisagem, abas e toolbar devem ocupar linhas separadas.");
    assert.ok(Math.abs(layoutPaisagem.larguraAbas - layoutPaisagem.larguraToolbar) < 1, "Abas e toolbar devem usar toda a largura útil.");
    assert.ok(layoutPaisagem.toolbarSemEstouro, "A toolbar em paisagem não deve criar rolagem horizontal.");
    await paginaPaisagem.close();

    console.log("Testes axe, contraste e nomes acessíveis concluídos com sucesso.");
} finally {
    await navegador.close();
    await new Promise(resolve => servidor.close(resolve));
}
