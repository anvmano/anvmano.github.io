import assert from "node:assert/strict";
import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { chromium } from "playwright-core";
import axe from "axe-core";

async function testarAssistenteUi() {
    const raiz = process.cwd();
    const executavel = ["C:/Program Files/Google/Chrome/Application/chrome.exe", "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe"].find(fs.existsSync);
    assert.ok(executavel);
    const servidor = http.createServer((req, res) => {
        const nome = decodeURIComponent(new URL(req.url, "http://localhost").pathname);
        const arquivo = path.resolve(raiz, nome === "/" ? "index.html" : nome.slice(1));
        if (!arquivo.startsWith(raiz + path.sep) || !fs.existsSync(arquivo) || !fs.statSync(arquivo).isFile()) {
            res.writeHead(404).end();
            return;
        }
        const tipos = { ".html": "text/html", ".css": "text/css", ".js": "text/javascript" };
        res.setHeader("Content-Type", tipos[path.extname(arquivo)] || "application/octet-stream");
        fs.createReadStream(arquivo).pipe(res);
    });
    await new Promise(resolve => servidor.listen(0, "127.0.0.1", resolve));
    const browser = await chromium.launch({ executablePath: executavel, headless: true });
    try {
        for (const viewport of [{ width: 390, height: 844 }, { width: 720, height: 360 }, { width: 1440, height: 900 }]) {
            const page = await browser.newPage({ viewport, hasTouch: viewport.width < 1000 });
            // Isola a UI da autenticacao real; conserva o carregador e os modulos da assistente.
            await page.route("**/scripts/main.js?*", route => route.fulfill({ contentType: "text/javascript", body: "" }));
            await page.goto(`http://127.0.0.1:${servidor.address().port}/`);
            await page.evaluate(() => {
                document.getElementById("aiChat").hidden = false;
                window.ClimateChat.setup({ getContext: () => ({ activeTab: "Tab0", selectedDate: "23-09-2026", latestData: {} }) });
                const preservado = document.createElement("button");
                preservado.id = "inertPreservado";
                preservado.inert = true;
                document.body.appendChild(preservado);
            });
            await page.locator("#aiChatToggle").click();
            await page.locator(".ai-chat.is-open").waitFor();
            await page.waitForTimeout(300);
            assert.equal(await page.locator("#aiChatPanel").getAttribute("role"), "dialog");
            for (const seletor of ["#aiChatPanel", "#aiChatClose", "#aiChatForm"]) {
                const box = await page.locator(seletor).boundingBox();
                assert.ok(box && box.x >= 0 && box.y >= 0 && box.x + box.width <= viewport.width + 1 && box.y + box.height <= viewport.height + 1, `${seletor}: ${JSON.stringify(box)}`);
            }
            assert.ok((await page.locator("#aiChatMessages").boundingBox()).height >= 100);
            await page.locator("#aiChatClose").focus();
            await page.keyboard.press("Shift+Tab");
            assert.equal(await page.locator("#aiChatSubmit").evaluate(el => el === document.activeElement), true);
            await page.keyboard.press("Tab");
            assert.equal(await page.locator("#aiChatClose").evaluate(el => el === document.activeElement), true);
            for (let i = 0; i < 14; i++) {
                await page.keyboard.press("Tab");
                assert.equal(await page.locator("#aiChatPanel").evaluate(el => el.contains(document.activeElement)), true);
            }
            assert.equal(await page.locator("#aiChatToggle").evaluate(el => el.inert), true);
            if (viewport.height < 500) {
                await page.locator("#aiChatShortcuts summary").click();
                assert.ok((await page.locator("#aiChatMessages").boundingBox()).height >= 100);
                await page.locator("#aiChatShortcuts summary").click();
            }
            const pasta = path.join(raiz, "ui-ux-evidence/2026-09-23-etapa-2");
            fs.mkdirSync(pasta, { recursive: true });
            await page.screenshot({ path: path.join(pasta, `assistente-${viewport.width}.png`) });
            await page.keyboard.press("Escape");
            assert.equal(await page.locator("#aiChatToggle").evaluate(el => el === document.activeElement && !el.inert), true);
            assert.equal(await page.locator("#inertPreservado").evaluate(el => el.inert), true);
            assert.equal(await page.locator("body").evaluate(el => el.classList.contains("ai-chat-scroll-locked")), false);
            await page.waitForTimeout(250);
            await page.locator("#aiChatToggle").click();
            await page.locator("#aiChatClose").click();
            await page.waitForTimeout(250);
            assert.equal(await page.locator("#aiChatPanel").isVisible(), false);
            // Fechar durante uma resposta nao deve reabrir ou roubar o foco.
            await page.locator("#aiChatToggle").click();
            await page.evaluate(() => {
                window.ClimateAssistant.query.answerQuestionDetailed = () => new Promise(resolve => {
                    window.resolverRespostaTeste = () => resolve({ answer: "Resposta simulada.", result: {} });
                });
            });
            await page.locator("#aiChatInput").fill("Resumo");
            await page.locator("#aiChatSubmit").click();
            assert.equal(await page.locator("#aiChatClose").evaluate(el => el === document.activeElement), true);
            await page.keyboard.press("Escape");
            await page.evaluate(() => window.resolverRespostaTeste());
            await page.waitForTimeout(250);
            assert.equal(await page.locator("#aiChatToggle").evaluate(el => el === document.activeElement), true);
            if (viewport.width === 390) {
                await page.locator("#aiChatToggle").click();
                await page.waitForTimeout(300);
                await page.locator("[data-chat-question]").first().focus();
                await page.setViewportSize({ width: 720, height: 360 });
                await page.waitForTimeout(300);
                assert.equal(await page.locator("#aiChatShortcuts").evaluate(el => el.open), false);
                assert.equal(await page.locator("#aiChatClose").evaluate(el => el === document.activeElement), true);
                await page.setViewportSize({ width: 390, height: 360 });
                await page.waitForTimeout(150);
                assert.ok((await page.locator("#aiChatMessages").boundingBox()).height >= 100);
                const painel = await page.locator("#aiChatPanel").boundingBox();
                assert.ok(painel.y >= 0 && painel.y + painel.height <= 360);
                await page.setViewportSize(viewport);
                await page.waitForTimeout(150);
                assert.equal(await page.locator("#aiChatShortcuts").evaluate(el => el.open), true);
                await page.keyboard.press("Escape");
            }
            await page.close();
        }
        console.log("Assistente: geometria, atalhos, foco, Escape e resposta pendente aprovados em 3 viewports.");
    } finally {
        await browser.close();
        await new Promise(resolve => servidor.close(resolve));
    }
}

async function testarHeatmaps() {
    const raiz = process.cwd();
    const executavel = ["C:/Program Files/Google/Chrome/Application/chrome.exe", "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe"].find(fs.existsSync);
    assert.ok(executavel);
    const browser = await chromium.launch({ executablePath: executavel, headless: true });
    try {
        for (const width of [320, 390, 1440]) {
            const page = await browser.newPage({ viewport: { width, height: 1000 }, hasTouch: true });
            await page.setContent(`<html lang="pt-BR"><head><title>Heatmaps</title></head><body><main><h1>Temperatura</h1><div class="advanced-grid">
                <section class="advanced-panel"><h2>Mensal</h2><div class="calendar-heatmap" id="monthlyClimateCalendar"></div></section>
                <section class="advanced-panel"><h2>Horário</h2><div class="hourly-heatmap" id="hourlyHeatmap"></div></section>
                <section class="advanced-panel advanced-panel--wide"><h2>Semanal</h2><div class="weekly-heatmap" id="weeklyHeatmap"></div></section>
                </div><button id="depois">Próximo</button></main></body></html>`);
            for (const file of ["tokens", "base", "advanced-views", "responsive"]) {
                await page.addStyleTag({ path: path.join(raiz, `styles/${file}.css`) });
            }
            for (const file of ["config", "data/data-utils", "data/analytics"]) {
                await page.addScriptTag({ path: path.join(raiz, `scripts/${file}.js`) });
            }
            await page.evaluate(() => {
                window.dadosTesteHeatmap = {};
                for (let dia = 1; dia <= 23; dia++) {
                    const horas = {};
                    for (let hora = 0; hora < 24; hora++) horas[`${hora}-00`] = { a: { Temperatura: 12 + dia + hora / 10 } };
                    window.dadosTesteHeatmap[`${String(dia).padStart(2, "0")}-09-2026`] = horas;
                }
                window.ClimateAnalytics.renderAdvancedClimateViews(window.dadosTesteHeatmap, "23-09-2026");
            });
            const mapa = page.locator("#weeklyHeatmap");
            assert.equal(await mapa.locator("button").count(), 168);
            assert.equal(await mapa.locator('[tabindex="0"]').count(), 1);
            await mapa.locator("button").first().tap();
            assert.match(await page.locator("#weeklyHeatmapDetalhe").innerText(), /Dom, 20\/09\/2026, 00:00: média 32.0/);
            await page.keyboard.press("ArrowRight");
            await page.keyboard.press("ArrowDown");
            assert.equal(await mapa.locator('[tabindex="0"]').getAttribute("data-indice"), "25");
            await page.keyboard.press("End");
            assert.equal(await mapa.locator('[tabindex="0"]').getAttribute("data-indice"), "47");
            const geometria = await mapa.evaluate(el => {
                const area = el.getBoundingClientRect();
                const alvo = el.querySelector('[tabindex="0"]').getBoundingClientRect();
                const dia = el.querySelector(".weekly-heatmap__day").getBoundingClientRect();
                return { visivel: alvo.left >= area.left + 48 && alvo.right <= area.right + 1, fixo: Math.abs(dia.left - area.left) < 1 };
            });
            assert.deepEqual(geometria, { visivel: true, fixo: true });
            await page.keyboard.press("Control+End");
            assert.match(await page.locator("#weeklyHeatmapDetalhe").innerText(), /Sáb, 26\/09\/2026, 23:00: sem dados/);
            await page.keyboard.press("Tab");
            assert.equal(await page.locator("#depois").evaluate(el => el === document.activeElement), true);
            await page.keyboard.press("Shift+Tab");
            await page.evaluate(() => window.ClimateAnalytics.renderAdvancedClimateViews(window.dadosTesteHeatmap, "23-09-2026"));
            assert.equal(await mapa.locator('[tabindex="0"]').evaluate(el => el === document.activeElement), true);
            assert.equal(await page.locator("#weeklyHeatmapDetalhe").count(), 1);
            await page.addScriptTag({ content: axe.source });
            const falhas = await page.evaluate(async () => (await window.axe.run(".advanced-grid", { runOnly: { type: "rule", values: ["color-contrast", "scrollable-region-focusable", "button-name", "aria-valid-attr-value"] } })).violations);
            assert.deepEqual(falhas.map(f => ({ id: f.id, nodes: f.nodes.length })), []);
            assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
            const pasta = path.join(raiz, "ui-ux-evidence/2026-09-23-etapa-3");
            fs.mkdirSync(pasta, { recursive: true });
            await page.screenshot({ path: path.join(pasta, `heatmaps-${width}.png`), fullPage: true });
            await page.evaluate(() => window.ClimateAnalytics.renderAdvancedClimateViews({}, "23-09-2026"));
            assert.match(await page.locator("#weeklyHeatmapLegenda").innerText(), /Sem leituras/);
            assert.match(await page.locator("#weeklyHeatmapDetalhe").innerText(), /sem dados/);
            await page.close();
        }
        console.log("Heatmaps: toque, teclado, foco, rolagem, contraste e ausencia de dados aprovados em 3 larguras.");
    } finally {
        await browser.close();
    }
}

async function testarContextoTabelas() {
    const raiz = process.cwd();
    const executavel = ["C:/Program Files/Google/Chrome/Application/chrome.exe", "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe"].find(fs.existsSync);
    const browser = await chromium.launch({ executablePath: executavel, headless: true });
    try {
        for (const width of [320, 390, 1440]) {
            const page = await browser.newPage({ viewport: { width, height: 900 } });
            await page.clock.install({ time: new Date(2026, 8, 23, 12, 30) });
            await page.setContent('<main style="padding:12px"><div id="statsSala" class="stats-grid"></div><div id="chart-container-temp-sala" class="chart-card"><div class="chart-label">Temperatura</div></div><section class="advanced-section table-section"><button class="collapsible-trigger" type="button"><span class="chart-label">Tabela</span></button><div id="tabela" class="table-wrapper"></div></section></main>');
            for (const file of ["tokens", "base", "stats", "charts", "advanced-views", "tables", "responsive"]) await page.addStyleTag({ path: path.join(raiz, `styles/${file}.css`) });
            for (const file of ["config", "data/data-utils", "ui/ui", "data/analytics"]) await page.addScriptTag({ path: path.join(raiz, `scripts/${file}.js`) });
            const resultado = await page.evaluate(() => {
                const dados = {
                    "20-09-2026": { "10-00": { a: { temperatura: 10 } }, "12-00": { a: { temperatura: 30 } } },
                    "23-09-2026": { "12-00": { a: { temperatura: 40 } } },
                };
                const dia = window.ClimateData.filterDataByDays(dados, 2, "20-09-2026");
                window.ClimateAnalytics.renderStats("sala", dia, "20-09-2026");
                const tabela = window.ClimateData.createTables(["Data", "Hora", "temperatura", "umidade", "pressao", "CO"], dia);
                window.ClimateUI.renderTable("tabela", tabela);
                const janela = window.ClimateData.getRollingWindow("20-09-2026", 24, new Date(2026, 8, 23, 12, 30));
                return { inicio: janela.inicio.getDate(), fim: janela.fim.getDate(), hora: janela.fim.getHours(), media: document.querySelector(".stats-card__value").textContent };
            });
            assert.deepEqual(resultado, { inicio: 19, fim: 20, hora: 12, media: "20.00°C" });
            assert.match(await page.locator(".stats-card__period").first().innerText(), /Média do dia · 20\/09\/2026/);
            assert.equal(await page.locator(".chart-period").count(), 0);
            await page.waitForTimeout(100);
            if (width < 640) {
                for (const scroll of [0, 180, 10000]) {
                    await page.locator("#tabela").evaluate((el, valor) => { el.scrollLeft = valor; }, scroll);
                    const medidas = await page.locator("#tabela").evaluate(el => {
                        const area = el.getBoundingClientRect();
                        const data = el.querySelector("tbody td:first-child").getBoundingClientRect();
                        const hora = el.querySelector("tbody td:nth-child(2)").getBoundingClientRect();
                        const topo = el.querySelector("th:nth-child(2)").getBoundingClientRect();
                        return { dataFixa: Math.abs(data.left - area.left) < 2, horaFixa: Math.abs(hora.left - data.right) < 2, alinhada: Math.abs(topo.left - hora.left) < 1, fixas: hora.right - area.left, restante: area.right - hora.right, largura: area.width, mascara: getComputedStyle(el).maskImage };
                    });
                    assert.equal(medidas.dataFixa, true);
                    assert.equal(medidas.horaFixa, true);
                    assert.equal(medidas.alinhada, true);
                    assert.ok(medidas.fixas <= 142, JSON.stringify(medidas));
                    assert.ok(medidas.restante >= 145, JSON.stringify(medidas));
                    assert.ok(medidas.largura >= width - 28, JSON.stringify(medidas));
                    assert.equal(medidas.mascara, "none");
                }
            }
            await page.locator("[data-table-sort]").click();
            assert.equal(await page.locator("tbody tr").first().locator("td:nth-child(2)").innerText(), "10:00");
            const download = page.waitForEvent("download");
            await page.locator("[data-table-csv]").click();
            assert.match((await download).suggestedFilename(), /estacao-climatica/);
            const pasta = path.join(raiz, "ui-ux-evidence/2026-09-23-etapa-4");
            fs.mkdirSync(pasta, { recursive: true });
            await page.screenshot({ path: path.join(pasta, `contexto-tabela-${width}.png`), fullPage: true });
            await page.evaluate(() => window.ClimateAnalytics.renderStats("sala", {}, "01-09-2026"));
            assert.match(await page.locator("#statsSala").innerText(), /Sem resumo.*01\/09\/2026/);
            assert.equal(await page.locator(".chart-period").count(), 0);
            await page.evaluate(() => {
                const stats = document.createElement("div");
                stats.id = "statsEstacao";
                document.body.appendChild(stats);
                for (const id of [window.AppConfig.ids.charts.globalTemperature, window.AppConfig.ids.charts.globalHumidity, window.AppConfig.ids.charts.rain]) {
                    const canvas = document.createElement("canvas");
                    canvas.id = id;
                    document.body.appendChild(canvas);
                }
                window.ClimateAqi = { calculate: () => null };
            });
            await page.addScriptTag({ path: path.join(raiz, "scripts/views/estacao-view.js") });
            await page.evaluate(() => window.EstacaoView.render({
                latestData: { livingRoom: { "23-09-2026": { "12-00": { a: { temperatura: 40 } } } }, room: {}, aquarium: {} },
                selectedDate: "01-09-2026", chartInstances: {}, defaults: {}, colors: window.AppConfig.colors, ui: window.ClimateUI,
            }));
            assert.match(await page.locator("#statsEstacao").innerText(), /Última leitura: 23\/09\/2026 · 12:00/);
            assert.match(await page.locator("#statsEstacao").innerText(), /40.00°C/);
            await page.close();
        }
        console.log("Contexto temporal, media, data vazia, colunas fixas, ordenacao e CSV aprovados.");
    } finally {
        await browser.close();
    }
}

async function testarPublicoResponsivo() {
    const raiz = process.cwd();
    const executavel = ["C:/Program Files/Google/Chrome/Application/chrome.exe", "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe"].find(fs.existsSync);
    const servidor = http.createServer((req, res) => {
        const nome = decodeURIComponent(new URL(req.url, "http://localhost").pathname);
        const arquivo = path.resolve(raiz, nome === "/" ? "index.html" : nome.slice(1));
        if (!arquivo.startsWith(raiz + path.sep) || !fs.existsSync(arquivo) || !fs.statSync(arquivo).isFile()) return res.writeHead(404).end();
        res.setHeader("Content-Type", ({ ".html": "text/html", ".css": "text/css", ".js": "text/javascript" })[path.extname(arquivo)] || "application/octet-stream");
        fs.createReadStream(arquivo).pipe(res);
    });
    await new Promise(resolve => servidor.listen(0, "127.0.0.1", resolve));
    const browser = await chromium.launch({ executablePath: executavel, headless: true });
    const pasta = path.join(raiz, "ui-ux-evidence/2026-09-23-etapa-5");
    fs.mkdirSync(pasta, { recursive: true });
    const pastaLayout = path.join(raiz, "ui-ux-evidence/2026-09-23-etapa-11");
    fs.mkdirSync(pastaLayout, { recursive: true });
    try {
        for (const width of [320, 390, 768, 900, 901, 961, 1024, 1100, 1201, 1440]) {
            const page = await browser.newPage({ viewport: { width, height: 900 } });
            await page.route("**/scripts/main.js?*", route => route.fulfill({ contentType: "text/javascript", body: "" }));
            await page.goto(`http://127.0.0.1:${servidor.address().port}/`);
            await page.evaluate(() => { document.getElementById("publicApp").hidden = false; });
            const entrada = await page.locator("#publicSearchButton").boundingBox();
            assert.ok(entrada.y + entrada.height < 900, `Busca fora da primeira tela em ${width}`);
            assert.equal(await page.locator("#publicLoginButton").isVisible(), true);
            assert.equal(await page.locator(".public-feature-list").count(), 0);
            const composicao = await page.evaluate(() => {
                const area = document.querySelector(".public-hero").getBoundingClientRect();
                const titulo = document.getElementById("publicPageTitle").getBoundingClientRect();
                const login = document.getElementById("publicLoginButton").getBoundingClientRect();
                const formulario = document.getElementById("publicSearchForm").getBoundingClientRect();
                const local = document.getElementById("publicLocationButton").getBoundingClientRect();
                return {
                    centralizado: Math.abs(area.left - (innerWidth - area.right)) < 2,
                    mesmaLinha: titulo.top < login.bottom && login.top < titulo.bottom,
                    localAoLado: local.left >= formulario.right,
                    semCorte: document.documentElement.scrollWidth <= innerWidth,
                };
            });
            assert.equal(composicao.centralizado, true);
            assert.equal(composicao.semCorte, true);
            const alturas = await page.locator("#publicLoginButton, .public-search-mode, #publicSearchInput, #publicSearchButton, #publicLocationButton").evaluateAll(els => els.map(el => el.getBoundingClientRect().height));
            assert.ok(alturas.every(h => Math.abs(h - 48) < 1), `Alturas inconsistentes em ${width}: ${alturas}`);
            if (width > 640) assert.equal(composicao.mesmaLinha, true);
            if (width > 900) assert.equal(composicao.localAoLado, true);
            await page.screenshot({ path: path.join(pastaLayout, `entrada-${width}.png`), fullPage: true });
            if ([320, 390, 768, 901, 1024, 1440].includes(width)) {
                await page.evaluate(() => {
                    window.loginsTeste = 0;
                    window.PublicWeatherView.setup({ onLogin: () => { window.loginsTeste++; } });
                    window.PublicWeatherView.mostrar();
                    const agora = new Date(2026, 8, 24, 12, 0, 0);
                    const inicioChuva = new Date(agora.getTime() - 24 * 60 * 60 * 1000);
                    const previsaoCurtoPrazo = Array.from({ length: 37 }, (_, indice) => ({
                        horario: new Date(inicioChuva.getTime() + indice * 60 * 60 * 1000).toISOString(),
                        precipitacao: indice % 4 === 0 ? 1.2 : 0,
                        probabilidadeChuva: 20 + indice,
                    }));
                    window.ExternalWeatherService.buscarPorCep = async () => ({
                        atualizadoEm: agora, origem: { tipo: "cidade", rotulo: "Campinas - São Paulo" },
                        climaAtual: { temperatura: -12.34, sensacaoTermica: -15.6, umidade: 58, pressao: 1025.55, precipitacao: 0, chuva: 0, codigoTempo: 1, indiceUv: 6, pontoOrvalho: 17, ventoVelocidade: 8 },
                        aqi: { valor: 72 }, previsaoDiaria: { indiceUvMaximo: 8 },
                        previsaoCurtoPrazo,
                        seriesHorarias: { horarios: [agora.toISOString()], temperatura: [25], sensacaoTermica: [26], umidade: [58], pressao: [1025.55] },
                        cicloSolar: { dawn: 5.5, sunrise: 6, zenith: 12, sunset: 18, dusk: 18.5 },
                    });
                });
                await page.locator("#publicSearchInput").fill("13000-000");
                await page.locator("#publicSearchButton").click();
                await page.locator("#publicApp.has-results").waitFor();
                assert.equal(await page.locator("#publicPageTitle").isVisible(), true);
                assert.equal(await page.locator("#publicLoginButton").isVisible(), true);
                await page.locator("#publicLoginButton").click();
                assert.equal(await page.evaluate(() => window.loginsTeste), 1);
                if (width === 390) {
                    await page.locator(".public-change-location").click();
                    await page.evaluate(() => {
                        window.buscaOriginalTeste = window.ExternalWeatherService.buscarPorCep;
                        window.canvasAnteriorTeste = document.getElementById("publicChartTemperature");
                        window.ExternalWeatherService.buscarPorCep = () => new Promise((resolve, reject) => { window.falharBuscaTeste = reject; });
                    });
                    await page.locator("#publicSearchInput").fill("01000-000");
                    await page.locator("#publicSearchButton").click();
                    assert.match(await page.locator(".public-query-feedback").innerText(), /consulta anterior: Campinas/);
                    assert.equal(await page.evaluate(() => document.getElementById("publicChartTemperature") === window.canvasAnteriorTeste), true);
                    await page.evaluate(() => window.falharBuscaTeste(new Error("Falha simulada")));
                    await page.locator(".public-query-feedback.state-message--error").waitFor();
                    assert.equal(await page.evaluate(() => document.getElementById("publicChartTemperature") === window.canvasAnteriorTeste), true);
                    await page.screenshot({ path: path.join(pasta, "consulta-preservada-390.png"), fullPage: true });
                    await page.evaluate(() => { window.ExternalWeatherService.buscarPorCep = window.buscaOriginalTeste; });
                    await page.locator("#publicSearchButton").click();
                    await page.locator("#publicApp.has-results").waitFor();
                    assert.equal(await page.locator(".public-query-feedback").count(), 0);
                    assert.equal(await page.evaluate(() => document.getElementById("publicChartTemperature") === window.canvasAnteriorTeste), false);
                    await page.locator(".public-change-location").click();
                    await page.evaluate(() => {
                        window.respostasPendentesTeste = [];
                        window.ExternalWeatherService.buscarPorCep = () => new Promise(resolve => window.respostasPendentesTeste.push(resolve));
                    });
                    await page.locator("#publicSearchForm").dispatchEvent("submit");
                    await page.locator("#publicSearchForm").dispatchEvent("submit");
                    await page.evaluate(async () => {
                        const dados = await window.buscaOriginalTeste();
                        window.respostasPendentesTeste[1]({ ...dados, origem: { ...dados.origem, rotulo: "Consulta mais recente" } });
                    });
                    await page.locator("#publicApp.has-results").waitFor();
                    await page.evaluate(async () => window.respostasPendentesTeste[0](await window.buscaOriginalTeste()));
                    await page.waitForTimeout(100);
                    assert.match(await page.locator(".public-location").innerText(), /Consulta mais recente/);
                }
                await page.waitForFunction(() => !!window.Chart?.getChart?.("publicChartRain"));
                const lerChuva = () => page.evaluate(() => {
                    const grafico = window.Chart.getChart("publicChartRain");
                    return {
                        total: grafico.data.labels.length,
                        seriesVisiveis: grafico.data.datasets.filter(serie => !serie.hidden).map(serie => serie.label),
                        observados: grafico.$tiposAtivos.filter(tipo => tipo === "observado").length,
                        previstos: grafico.$tiposAtivos.filter(tipo => tipo === "previsao").length,
                        indiceAgora: grafico.$indiceAgora,
                        titulo: grafico.canvas.parentElement.querySelector(".chart-label")?.textContent,
                        eixoMilimetros: grafico.options.scales.yMilimetros.display,
                        eixoProbabilidade: grafico.options.scales.yProbabilidade.display,
                    };
                });
                let chuva = await lerChuva();
                if (width <= 640) {
                    assert.equal(await page.locator('.rain-chart-toggle[data-rain-chart="publicChartRain"]').isVisible(), true);
                    assert.equal(chuva.total, 37);
                    assert.deepEqual(chuva.seriesVisiveis, ["Precipitação observada", "Precipitação prevista"]);
                    await page.locator('.rain-chart-toggle[data-rain-chart="publicChartRain"] [data-rain-mode="probabilidade"]').click();
                    chuva = await lerChuva();
                    assert.equal(chuva.total, 25);
                    assert.deepEqual(chuva.seriesVisiveis, ["Chance de chuva"]);
                    assert.deepEqual([chuva.observados, chuva.previstos, chuva.indiceAgora], [13, 12, 12]);
                    assert.match(chuva.titulo, /12h anteriores \+ próximas 12h/);
                    assert.deepEqual([chuva.eixoMilimetros, chuva.eixoProbabilidade], [false, true]);
                } else {
                    assert.equal(await page.locator('.rain-chart-toggle[data-rain-chart="publicChartRain"]').count(), 0);
                    assert.equal(chuva.total, 25);
                    assert.deepEqual(chuva.seriesVisiveis, ["Chance de chuva"]);
                    assert.deepEqual([chuva.observados, chuva.previstos, chuva.indiceAgora], [13, 12, 12]);
                    assert.match(chuva.titulo, /12h anteriores \+ próximas 12h/);
                    assert.deepEqual([chuva.eixoMilimetros, chuva.eixoProbabilidade], [false, true]);
                }
                const cortes = await page.locator(".public-card .stats-card__value, .public-moon dd").evaluateAll(els => els.filter(el => el.scrollWidth > el.clientWidth + 1).map(el => el.textContent));
                assert.deepEqual(cortes, []);
                if (width <= 640) {
                    const contextoMovel = await page.evaluate(() => {
                        const resumo = document.querySelector(".public-stats-grid").getBoundingClientRect();
                        const astronomia = document.querySelector(".public-app .station-context-row").getBoundingClientRect();
                        const pares = [...document.querySelectorAll(".public-moon .moon-summary__details div")].filter(item => item.checkVisibility()).map(item => {
                            const rotulo = item.querySelector("dt").getBoundingClientRect();
                            const data = item.querySelector("dd").getBoundingClientRect();
                            return {
                                alinhado: Math.abs(rotulo.left - data.left) < 1,
                                agrupado: data.top - rotulo.bottom <= 5,
                                rotulo: item.querySelector("dt").textContent,
                            };
                        });
                        return {
                            espaco: Math.round(astronomia.top - resumo.bottom),
                            pares,
                        };
                    });
                    assert.ok(contextoMovel.espaco <= 13, `Espaco excessivo antes do contexto astronomico: ${contextoMovel.espaco}px`);
                    assert.deepEqual(contextoMovel.pares.map(item => item.rotulo), ["Próxima cheia", "Próxima nova"]);
                    assert.ok(contextoMovel.pares.every(item => item.alinhado && item.agrupado));
                }
                if (width > 900) {
                    const proporcoes = await page.evaluate(() => {
                        const busca = document.querySelector(".public-hero").getBoundingClientRect();
                        const resultado = document.getElementById("publicResults").getBoundingClientRect();
                        const contexto = [...document.querySelectorAll(".public-app .station-context-row > section")].map(el => el.getBoundingClientRect().width);
                        return { alinhado: Math.abs(busca.left - resultado.left) < 1 && Math.abs(busca.right - resultado.right) < 1, colunas: getComputedStyle(document.querySelector(".public-metric-charts")).gridTemplateColumns.split(" ").length, contexto };
                    });
                    assert.equal(proporcoes.alinhado, true);
                    assert.equal(proporcoes.colunas, 2);
                    assert.ok(Math.abs(proporcoes.contexto[0] - proporcoes.contexto[1]) < 1);
                }
                await page.screenshot({ path: path.join(pastaLayout, `resultado-${width}.png`), fullPage: true });
                await page.addScriptTag({ content: axe.source });
                const falhas = await page.evaluate(async () => (await window.axe.run(document, { runOnly: { type: "rule", values: ["page-has-heading-one", "landmark-one-main", "region"] } })).violations.map(v => v.id));
                assert.deepEqual(falhas, []);
                await page.screenshot({ path: path.join(pasta, `publico-${width}.png`), fullPage: true });
                if (width < 640) {
                    await page.locator(".public-change-location").click();
                    assert.equal(await page.locator("#publicSearchInput").isVisible(), true);
                }
                await page.evaluate(() => window.PublicWeatherView.atualizarUsuario({ email: "teste@example.com" }, false));
                assert.equal(await page.locator("#publicLogoutButton").isVisible(), true);
                await page.evaluate(() => window.PublicWeatherView.atualizarUsuario({ email: "usuario.com.nome.extenso.para.verificacao@example.com" }, false));
                assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
            }
            await page.evaluate(() => {
                document.getElementById("publicApp").hidden = true;
                document.getElementById("privateApp").hidden = false;
            });
            const medidas = await page.evaluate(() => {
                const nav = document.querySelector(".tab-nav");
                const area = nav.getBoundingClientRect();
                const tabs = [...nav.querySelectorAll("button")].map(el => el.getBoundingClientRect());
                const toolbar = document.querySelector(".toolbar-group").getBoundingClientRect();
                const botoes = [...document.querySelectorAll(".toolbar-group > button")].map(el => el.getBoundingClientRect());
                return { abasDentro: tabs.every(r => r.left >= area.left && r.right <= area.right + 1), botoesDentro: botoes.every(r => r.left >= toolbar.left && r.right <= toolbar.right + 1), overflow: document.documentElement.scrollWidth > innerWidth };
            });
            assert.deepEqual(medidas, { abasDentro: true, botoesDentro: true, overflow: false }, `Largura ${width}`);
            if ([961, 1024, 1100, 1201].includes(width)) await page.screenshot({ path: path.join(pasta, `abas-${width}.png`) });
            await page.evaluate(async () => { await window.ClimateAssets.carregarChart(); });
            for (const id of ["Tab1", "Tab2", "Tab3"]) {
                await page.evaluate(id => {
                    document.querySelectorAll(".tabcontent").forEach(el => { el.style.display = el.id === id ? "block" : "none"; });
                    document.querySelectorAll(`#${id} > .charts-grid canvas`).forEach(canvas => {
                        new window.Chart(canvas, { type: "line", data: { labels: Array.from({ length: 24 }, (_, i) => `${i}:00`), datasets: [{ label: "Fixture", data: Array.from({ length: 24 }, (_, i) => 24 + Math.sin(i)), borderColor: "#38bdf8" }] }, options: { responsive: true, maintainAspectRatio: false, animation: false } });
                    });
                }, id);
                await page.waitForTimeout(100);
                const layout = await page.locator(`#${id} > .charts-grid`).evaluate(el => ({ colunas: getComputedStyle(el).gridTemplateColumns.split(" ").length, larguras: [...el.querySelectorAll("canvas")].map(c => c.getBoundingClientRect().width), overflow: document.documentElement.scrollWidth > innerWidth }));
                assert.equal(layout.colunas, width <= 900 ? 1 : 2);
                assert.equal(layout.overflow, false);
                assert.ok(layout.larguras.every(w => w >= (width > 900 ? 350 : 220)));
                await page.evaluate(() => window.scrollTo(0, 0));
                await page.screenshot({ path: path.join(pastaLayout, `${id}-${width}.png`), fullPage: true });
            }
            await page.close();
        }
        console.log("Layout intermediario, titulo/login publico, valores e datas aprovados.");
    } finally {
        await browser.close();
        await new Promise(resolve => servidor.close(resolve));
    }
}

async function testarLayoutEstacao() {
    const raiz = process.cwd();
    const servidor = http.createServer((req, res) => {
        const nome = decodeURIComponent(new URL(req.url, "http://localhost").pathname);
        const arquivo = path.resolve(raiz, nome === "/" ? "index.html" : nome.slice(1));
        if (!arquivo.startsWith(raiz + path.sep) || !fs.existsSync(arquivo) || !fs.statSync(arquivo).isFile()) return res.writeHead(404).end();
        res.setHeader("Content-Type", ({ ".html": "text/html", ".css": "text/css", ".js": "text/javascript" })[path.extname(arquivo)] || "application/octet-stream");
        fs.createReadStream(arquivo).pipe(res);
    });
    await new Promise(resolve => servidor.listen(0, "127.0.0.1", resolve));
    const executavel = ["C:/Program Files/Google/Chrome/Application/chrome.exe", "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe"].find(fs.existsSync);
    const browser = await chromium.launch({ executablePath: executavel, headless: true });
    const pasta = path.join(raiz, "ui-ux-evidence/2026-09-23-etapa-8");
    fs.mkdirSync(pasta, { recursive: true });
    const medidas = [];
    try {
        for (const width of [320, 390, 768, 1024, 1440]) {
            const page = await browser.newPage({ viewport: { width, height: 900 } });
            await page.route("**/scripts/main.js?*", route => route.fulfill({ contentType: "text/javascript", body: "" }));
            await page.goto(`http://127.0.0.1:${servidor.address().port}/`);
            await page.evaluate(async () => {
                await window.ClimateAssets.carregarChart();
                document.getElementById("publicApp").hidden = true;
                document.getElementById("privateApp").hidden = false;
                document.querySelectorAll(".tabcontent").forEach(el => { el.style.display = el.id === "Tab0" ? "block" : "none"; });
                window.instanciasTeste = {};
                window.renderizarTeste = (umidade = 45, vazio = false) => {
                    const dia = window.ClimateData.dataAtual();
                    const registros = {};
                    for (let hora = 0; hora < 24; hora++) registros[`${String(hora).padStart(2, "0")}-00`] = { a: { temperatura: 24 + Math.sin(hora), Temperatura: 24 + Math.sin(hora), temperaturaDS18B20: 25, Umidade: umidade, umidade, CO: 0.1 } };
                    const dados = vazio ? {} : { [dia]: registros };
                    window.EstacaoView.render({ latestData: { livingRoom: dados, room: dados, aquarium: dados }, selectedDate: dia, chartInstances: window.instanciasTeste, defaults: {}, colors: window.AppConfig.colors, ui: window.ClimateUI });
                };
                window.renderizarTeste();
            });
            await page.waitForTimeout(400);
            assert.equal(await page.locator("#statsEstacao .stats-card").count(), 6);
            assert.equal(await page.locator("#stationAstronomyDetails").getAttribute("open"), "");
            assert.equal(await page.locator("#stationAstronomyDetails .station-context-row").isVisible(), true);
            assert.deepEqual(await page.evaluate(() => {
                const astronomia = document.getElementById("stationAstronomyDetails");
                const insights = document.getElementById("environmentInsights");
                const grafico = document.getElementById("chart-container-global-temp");
                return {
                    depoisDosResumos: astronomia.previousElementSibling?.id === "statsEstacao",
                    antesDosInsights: astronomia.compareDocumentPosition(insights) === Node.DOCUMENT_POSITION_FOLLOWING,
                    antesDosGraficos: astronomia.compareDocumentPosition(grafico) === Node.DOCUMENT_POSITION_FOLLOWING,
                };
            }), { depoisDosResumos: true, antesDosInsights: true, antesDosGraficos: true });
            const legendas = await page.evaluate(() => {
                const graficos = Object.values(window.instanciasTeste).filter(grafico => grafico?.data?.datasets?.length > 1);
                return { quantidade: graficos.length, preservadas: graficos.every(grafico => grafico.options.plugins.legend.display === true) };
            });
            assert.ok(legendas.quantidade > 0);
            assert.equal(legendas.preservadas, true);
            assert.equal(await page.locator(".chart-period").count(), 0);
            assert.equal(await page.locator("#chart-container-global-temp").evaluate(card => {
                const titulo = card.querySelector(".chart-label").getBoundingClientRect();
                const canvas = card.querySelector("canvas").getBoundingClientRect();
                return Math.abs(canvas.top - titulo.bottom) <= 1;
            }), true);
            assert.ok(await page.locator("#environmentDetails .environment-insight").count() >= 2);
            assert.equal(await page.locator("#environmentInsights .environment-insight--favoravel").count(), 0);
            assert.equal(await page.locator("#environmentLocationButton").isVisible(), true);
            assert.ok(await page.locator("#environmentInsights .environment-insight--indisponivel").count() >= 2);
            const composicaoInsights = await page.locator("#environmentInsights").evaluate((recipiente, largura) => {
                const card = recipiente.querySelector(".environment-insight");
                const selo = recipiente.querySelector(".environment-insight__header > small");
                const estiloSelo = getComputedStyle(selo);
                return {
                    colunas: getComputedStyle(card).gridTemplateColumns.split(" ").length,
                    colunasEsperadas: largura <= 640 ? 1 : largura <= 900 ? 2 : 3,
                    seloCentralizado: ["flex", "inline-flex"].includes(estiloSelo.display) && estiloSelo.alignItems === "center" && estiloSelo.justifyContent === "center",
                    seloInteiro: estiloSelo.whiteSpace === "nowrap" && selo.scrollWidth <= selo.clientWidth + 1,
                    semRepeticao: !recipiente.innerText.includes("Nenhuma localização é armazenada") && ![...recipiente.querySelectorAll(".environment-insight")].some(item => item.innerText.includes("Consulte a localização")),
                    detalhesVazios: recipiente.querySelectorAll(".environment-insight__detail").length === 0,
                };
            }, width);
            assert.equal(composicaoInsights.colunas, composicaoInsights.colunasEsperadas);
            assert.equal(composicaoInsights.seloCentralizado, true);
            assert.equal(composicaoInsights.seloInteiro, true);
            assert.equal(composicaoInsights.semRepeticao, true);
            assert.equal(composicaoInsights.detalhesVazios, true);
            const medida = await page.evaluate(() => {
                const grafico = document.getElementById("chart-container-global-temp");
                const inicio = document.getElementById("Tab0").getBoundingClientRect().top;
                return { largura: innerWidth, distanciaGrafico: Math.round(grafico.getBoundingClientRect().top - inicio), alturaPagina: document.documentElement.scrollHeight, canvas: Math.round(document.getElementById("plotGlobalTemperature").getBoundingClientRect().width), overflow: document.documentElement.scrollWidth > innerWidth };
            });
            assert.equal(medida.overflow, false);
            assert.ok(medida.canvas > 200);
            medidas.push(medida);
            await page.screenshot({ path: path.join(pasta, `estacao-${width}.png`), fullPage: true });
            assert.equal(await page.locator(".station-summary-card__meta span").evaluateAll(els => els.every(el => el.scrollWidth <= el.clientWidth + 1 && getComputedStyle(el).whiteSpace === "normal")), true);
            if (width <= 640) {
                await page.evaluate(() => {
                    window.calcularAqiOriginalTeste = window.ClimateAqi.calculate;
                    window.ClimateAqi.calculate = () => ({
                        aqi: 301,
                        category: { label: "Perigoso", className: "hazardous" },
                        dominant: { label: "Álcool" },
                        timestamp: Date.now(),
                    });
                    window.renderizarTeste();
                });
                const seloAqi = page.locator("#statsEstacao .stats-card__trend").first();
                assert.equal(await seloAqi.innerText(), "Perigoso");
                assert.deepEqual(await seloAqi.evaluate(el => {
                    const selo = el.getBoundingClientRect();
                    const card = el.closest(".stats-card").getBoundingClientRect();
                    const faixa = document.createRange();
                    faixa.selectNodeContents(el);
                    return {
                        umaLinha: faixa.getClientRects().length === 1,
                        dentroDoCard: selo.left >= card.left && selo.right <= card.right,
                        semQuebra: getComputedStyle(el).whiteSpace === "nowrap",
                    };
                }), { umaLinha: true, dentroDoCard: true, semQuebra: true });
                await page.screenshot({ path: path.join(pasta, `aqi-perigoso-${width}.png`), fullPage: true });
                await page.evaluate(() => {
                    window.ClimateAqi.calculate = window.calcularAqiOriginalTeste;
                    window.renderizarTeste();
                });
            }
            // Reconstroi a ordem anterior com a mesma fixture para medir a reducao de rolagem.
            medida.distanciaComOrdemAnterior = await page.evaluate(() => {
                const contexto = document.querySelector("#Tab0 .station-context-row");
                window.contextoOriginalTeste = contexto.parentElement;
                document.getElementById("Tab0").prepend(contexto);
                const grid = document.querySelector("#environmentInsights .environment-insights__grid");
                grid.append(...document.getElementById("environmentDetails").children);
                const estilo = document.createElement("style");
                estilo.id = "layoutAnteriorTeste";
                estilo.textContent = "#environmentInsights .environment-insights__grid {grid-template-columns:repeat(auto-fit,minmax(210px,1fr));gap:12px} #environmentInsights .environment-insight {grid-template-columns:1fr;grid-template-rows:auto auto minmax(2.6rem,auto) auto;min-height:164px;padding:.9rem} #environmentInsights .environment-insight__header {grid-row:auto;display:flex}";
                document.head.appendChild(estilo);
                return Math.round(document.getElementById("chart-container-global-temp").getBoundingClientRect().top - document.getElementById("Tab0").getBoundingClientRect().top);
            });
            await page.screenshot({ path: path.join(pasta, `ordem-anterior-${width}.png`), fullPage: true });
            await page.evaluate(() => {
                window.contextoOriginalTeste.appendChild(document.querySelector("#Tab0 .station-context-row"));
                document.getElementById("layoutAnteriorTeste").remove();
                window.renderizarTeste();
            });
            assert.ok(medida.distanciaGrafico < medida.distanciaComOrdemAnterior);
            const summary = page.locator("#stationEnvironmentDetails > summary");
            await summary.focus();
            await page.keyboard.press("Enter");
            assert.equal(await page.locator("#environmentDetails").isVisible(), true);
            await page.evaluate(() => window.renderizarTeste());
            assert.equal(await page.locator("#stationEnvironmentDetails").getAttribute("open"), "");
            await page.evaluate(() => window.renderizarTeste(85));
            assert.ok(await page.locator("#environmentInsights .environment-insight--alerta").count() >= 2);
            for (const el of await page.locator("#environmentInsights .environment-insight--alerta").all()) assert.equal(await el.isVisible(), true);
            await page.evaluate(() => window.scrollTo(0, 0));
            await page.waitForTimeout(200);
            await page.screenshot({ path: path.join(pasta, `alertas-${width}.png`), fullPage: true });
            await page.evaluate(() => {
                window.BrowserLocationService.obterLocalizacaoAtual = async () => { throw new Error("Localização negada no teste"); };
            });
            await page.locator("#environmentLocationButton").click();
            await page.locator(".environment-insight__feedback--erro").waitFor();
            assert.equal(await page.locator("#environmentLocationButton").isEnabled(), true);
            await page.evaluate(() => window.renderizarTeste(45, true));
            assert.equal(await page.locator("#environmentInsights .environment-insight--indisponivel").count(), 5);
            assert.equal(await page.locator("#stationEnvironmentDetails").isVisible(), false);
            await page.close();
        }
        fs.writeFileSync(path.join(pasta, "medidas.json"), JSON.stringify(medidas, null, 2));
        console.log("Estacao: ordem, alertas, ausencia de dados, teclado e localizacao aprovados em 5 larguras.");
    } finally {
        await browser.close();
        await new Promise(resolve => servidor.close(resolve));
    }
}

await testarAssistenteUi();
await testarHeatmaps();
await testarContextoTabelas();
await testarPublicoResponsivo();
await testarLayoutEstacao();
