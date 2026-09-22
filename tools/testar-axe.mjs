import verificar from "node:assert/strict";
import arquivos from "node:fs";
import servidorHttp from "node:http";
import caminho from "node:path";
import { chromium } from "playwright-core";

const raiz = process.cwd();
const executavel = [
    "C:/Program Files/Google/Chrome/Application/chrome.exe",
    "C:/Program Files (x86)/Google/Chrome/Application/chrome.exe",
    "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
].find(arquivos.existsSync);

verificar.ok(executavel, "Chrome ou Edge não encontrado para o teste axe.");

const servidor = servidorHttp.createServer((requisicao, resposta) => {
    const url = new URL(requisicao.url, "http://localhost");
    const relativo = url.pathname === "/" ? "index.html" : decodeURIComponent(url.pathname.slice(1));
    const arquivo = caminho.resolve(raiz, relativo);
    if (!arquivo.startsWith(raiz) || !arquivos.existsSync(arquivo) || arquivos.statSync(arquivo).isDirectory()) {
        resposta.writeHead(404).end();
        return;
    }
    const tipos = { ".html": "text/html", ".css": "text/css", ".js": "text/javascript", ".svg": "image/svg+xml", ".png": "image/png" };
    resposta.setHeader("Content-Type", tipos[caminho.extname(arquivo)] || "application/octet-stream");
    arquivos.createReadStream(arquivo).pipe(resposta);
});

await new Promise(resolver => servidor.listen(0, "127.0.0.1", resolver));
const porta = servidor.address().port;
const navegador = await chromium.launch({ executablePath: executavel, headless: true });

try {
    const pagina = await navegador.newPage({ viewport: { width: 390, height: 844 } });
    await pagina.goto(`http://127.0.0.1:${porta}/`, { waitUntil: "domcontentloaded" });
    await pagina.addScriptTag({ path: caminho.join(raiz, "node_modules/axe-core/axe.min.js") });

    async function validarEstado(nome, preparar) {
        if (preparar) await pagina.evaluate(preparar);
        const resultado = await pagina.evaluate(async () => axe.run(document, {
            resultTypes: ["violations"],
            rules: { "color-contrast": { enabled: true } },
        }));
        const graves = resultado.violations.filter(item => ["critical", "serious"].includes(item.impact));
        verificar.deepEqual(graves.map(item => `${item.id}: ${item.help}`), [], `Falhas axe em ${nome}`);
    }

    await validarEstado("modo público inicial", () => {
        document.getElementById("publicApp")?.removeAttribute("hidden");
        document.getElementById("privateApp")?.setAttribute("hidden", "");
    });
    await validarEstado("popover AQI", () => document.getElementById("aqiPopover")?.removeAttribute("hidden"));
    await validarEstado("chat aberto", () => {
        document.getElementById("aqiPopover")?.setAttribute("hidden", "");
        const chat = document.getElementById("aiChat");
        const painel = document.getElementById("aiChatPanel");
        chat?.classList.add("is-open");
        painel?.removeAttribute("hidden");
    });

    const canvasesSemNome = await pagina.locator("canvas:not([aria-label])").count();
    verificar.equal(canvasesSemNome, 0, "Todos os canvases devem possuir nome acessível.");

    const estruturaPublica = await pagina.evaluate(() => ({
        mainVisivel: !!document.querySelector("main#publicApp:not([hidden])"),
        h1Visivel: !!document.querySelector("main#publicApp:not([hidden]) h1"),
        controlesPequenos: Array.from(document.querySelectorAll("#publicApp button:not([hidden])"))
            .filter(botao => botao.getBoundingClientRect().height < 44)
            .map(botao => botao.textContent.trim()),
    }));
    verificar.equal(estruturaPublica.mainVisivel, true, "Modo público deve usar landmark main.");
    verificar.equal(estruturaPublica.h1Visivel, true, "Modo público deve possuir h1.");
    verificar.deepEqual(estruturaPublica.controlesPequenos, [], "Controles públicos móveis devem ter ao menos 44px.");

    const paginaTablet = await navegador.newPage({ viewport: { width: 768, height: 1024 } });
    await paginaTablet.goto(`http://127.0.0.1:${porta}/`, { waitUntil: "domcontentloaded" });
    const layoutTablet = await paginaTablet.evaluate(() => {
        document.getElementById("publicApp")?.setAttribute("hidden", "");
        document.getElementById("privateApp")?.removeAttribute("hidden");
        const abas = document.querySelector(".tab-nav");
        const caixaAbas = abas?.getBoundingClientRect();
        const caixaToolbar = document.querySelector(".toolbar")?.getBoundingClientRect();
        return {
            colunas: getComputedStyle(abas).gridTemplateColumns.split(" ").length,
            semCorte: abas?.scrollWidth === abas?.clientWidth,
            abasAntesDoToolbar: (caixaAbas?.bottom ?? 0) <= (caixaToolbar?.top ?? 0),
        };
    });
    verificar.equal(layoutTablet.colunas, 4, "Tablet deve manter quatro abas equivalentes.");
    verificar.equal(layoutTablet.semCorte, true, "Abas não podem ser cortadas no tablet.");
    verificar.equal(layoutTablet.abasAntesDoToolbar, true, "Tablet deve posicionar toolbar abaixo das abas.");
    await paginaTablet.close();

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
    verificar.equal(layoutPaisagem.colunas, 4, "Paisagem deve manter as quatro abas em colunas equivalentes.");
    verificar.ok(layoutPaisagem.abasAntesDoToolbar, "Em paisagem, abas e toolbar devem ocupar linhas separadas.");
    verificar.ok(Math.abs(layoutPaisagem.larguraAbas - layoutPaisagem.larguraToolbar) < 1, "Abas e toolbar devem usar toda a largura útil.");
    verificar.ok(layoutPaisagem.toolbarSemEstouro, "A toolbar em paisagem não deve criar rolagem horizontal.");
    await paginaPaisagem.close();

    console.log("Testes axe, contraste e nomes acessíveis concluídos com sucesso.");
} finally {
    await navegador.close();
    await new Promise(resolver => servidor.close(resolver));
}
