import assert from "node:assert/strict";
import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import vm from "node:vm";
import { chromium } from "playwright-core";

const ler = arquivo => fs.readFileSync(path.resolve(arquivo), "utf8");
const carregar = (arquivo, contexto) => vm.runInNewContext(ler(arquivo), contexto, { filename: arquivo });

// COR-04: a ausência de uma métrica não pode virar zero nem liberar ventilação.
const insights = { window: {}, Date };
carregar("scripts/data/environmental-insights.js", insights);
const { resumirChuva, recomendarVentilacaoExterna } = insights.window.ClimateInsightsAmbientais;
const agora = new Date("2026-11-24T12:00:00Z");
const janela = Array.from({ length: 7 }, (_, i) => ({ horario: new Date(+agora + i * 3600000).toISOString(), precipitacao: 0, probabilidadeChuva: 0 }));
assert.equal(resumirChuva([], agora).classe, "indisponivel");
const ausente = resumirChuva(janela.map(item => ({ ...item, precipitacao: null, probabilidadeChuva: null })), agora);
assert.equal(ausente.classe, "indisponivel");
assert.equal(ausente.acumulado, null);
assert.equal(resumirChuva(janela, agora).classe, "favoravel");
assert.equal(resumirChuva(janela, agora).acumulado, 0);
for (const metrica of ["precipitacao", "probabilidadeChuva"]) {
    const parcial = resumirChuva(janela.map(item => ({ ...item, [metrica]: null })), agora);
    assert.equal(parcial.coberturaParcial, true);
    assert.notEqual(parcial.classe, "favoravel");
    assert.equal(metrica === "precipitacao" ? parcial.acumulado : parcial.probabilidade, null);
}
assert.equal(resumirChuva(janela.slice(0, 2), agora).coberturaParcial, true);
assert.equal(resumirChuva(janela.filter((_, i) => i !== 3), agora).coberturaParcial, true);
assert.equal(recomendarVentilacaoExterna({ climaAtual: { temperatura: 23, umidade: 50 }, chuva: ausente }).classe, "atencao");

// COR-05/06: respostas reais do módulo, com CEP e APIs simulados.
let coordenadasDiretas = false;
let resultados = [];
let fuso = "America/Rio_Branco";
let deslocamento = -18000;
let geocodificacoes = 0;
const servico = {
    window: { AppConfig: { externalApis: { brasilApiCepUrl: "https://teste/cep", viaCepUrl: "https://teste/via", openMeteoGeocodingUrl: "https://teste/geo", openMeteoForecastUrl: "https://teste/clima", openMeteoAirQualityUrl: "https://teste/aqi" } } }, URL, Date,
    fetch: async valor => {
        const url = new URL(valor);
        let dados;
        if (url.pathname.startsWith("/cep")) dados = { city: "São Carlos", state: "SC", location: coordenadasDiretas ? { coordinates: { latitude: -27.07, longitude: -53 } } : null };
        if (url.pathname === "/geo") { geocodificacoes++; dados = { results: resultados }; }
        if (url.pathname === "/clima") {
            assert.equal(url.searchParams.get("timeformat"), "unixtime");
            const inicio = Date.parse("2026-11-24T09:30:00Z") / 1000;
            const meiaNoite = Date.parse(`2026-11-24T00:00:00${deslocamento === -18000 ? "-05:00" : "-03:00"}`) / 1000;
            dados = { timezone: fuso, utc_offset_seconds: deslocamento, current: { time: inicio },
                hourly: { time: [inicio, inicio + 3600] }, daily: { time: [meiaNoite, meiaNoite + 86400], sunrise: [meiaNoite + 21600, meiaNoite + 108000], sunset: [meiaNoite + 64800, meiaNoite + 151200] } };
        }
        return { ok: true, json: async () => dados || {} };
    },
};
carregar("scripts/external/external-weather-service.js", servico);
const externo = servico.window.ExternalWeatherService;
resultados = [{ name: "São Carlos", admin1: "São Paulo", country_code: "BR", latitude: -22, longitude: -47 }];
await assert.rejects(externo.buscarPorCep("89885000"), /confirmar cidade e UF/);
resultados.push({ name: "São Carlos", admin1: "Santa Catarina", country_code: "BR", latitude: -27.07, longitude: -53 });
const acre = await externo.buscarPorCep("89885000");
assert.equal(acre.origem.latitude, -27.07);
assert.equal(acre.fusoHorario, "America/Rio_Branco");
assert.equal(acre.atualizadoEm.toISOString(), "2026-11-24T09:30:00.000Z");
assert.equal(acre.cicloSolar.sunrise, 6);
assert.equal(acre.dataLocal, "2026-11-24");
assert.equal(acre.previsaoCurtoPrazo[0].horario, "2026-11-24T09:30:00.000Z");
assert.ok(acre.ciclosSolares["2026-11-25"]);
const chamadasAntes = geocodificacoes;
coordenadasDiretas = true;
fuso = "America/Sao_Paulo"; deslocamento = -10800;
const sp = await externo.buscarPorCep("89885000");
assert.equal(geocodificacoes, chamadasAntes, "Coordenadas da origem dispensam geocodificação");
assert.equal(sp.cicloSolar.sunrise, 6);

// COR-07: scripts e CSS compartilham tentativas; somente a falha sai do cache.
const recursos = [];
const documento = {
    querySelector: seletor => recursos.find(item => seletor.includes(`"${item.src || item.href}"`)) || null,
    createElement: tipo => ({ tipo, dataset: {}, remove() { recursos.splice(recursos.indexOf(this), 1); } }),
    head: { appendChild: item => recursos.push(item) },
};
const runtime = { window: {}, document: documento };
carregar("scripts/runtime-loader.js", runtime);
for (const tipo of ["carregarChart", "carregarCssZoom"]) {
    const primeira = runtime.window.ClimateAssets[tipo]();
    const simultanea = runtime.window.ClimateAssets[tipo]();
    const resultado = Promise.allSettled([primeira, simultanea]);
    assert.equal(recursos.length, 1);
    recursos[0].onerror();
    assert.ok((await resultado).every(item => item.status === "rejected"));
    assert.equal(recursos.length, 0);
    const segunda = runtime.window.ClimateAssets[tipo]();
    const reutilizada = runtime.window.ClimateAssets[tipo]();
    assert.equal(recursos.length, 1);
    if (tipo === "carregarChart") runtime.window.Chart = {};
    recursos[0].onload();
    await Promise.all([segunda, reutilizada]);
    await runtime.window.ClimateAssets[tipo]();
    assert.equal(recursos.length, 1);
    recursos.length = 0;
}

// COR-01/02/03/06/07: integração no navegador, sem login ou dispositivos reais.
const raiz = process.cwd();
const executavel = ["C:/Program Files/Google/Chrome/Application/chrome.exe", "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe"].find(fs.existsSync);
assert.ok(executavel);
const servidor = http.createServer((req, res) => {
    const arquivo = path.resolve(raiz, decodeURIComponent(new URL(req.url, "http://localhost").pathname).slice(1) || "index.html");
    if (!arquivo.startsWith(raiz + path.sep) || !fs.existsSync(arquivo) || !fs.statSync(arquivo).isFile()) return res.writeHead(404).end();
    res.setHeader("Content-Type", ({ ".js": "text/javascript", ".css": "text/css", ".html": "text/html" })[path.extname(arquivo)] || "application/octet-stream");
    fs.createReadStream(arquivo).pipe(res);
});
await new Promise(resolve => servidor.listen(0, "127.0.0.1", resolve));
const browser = await chromium.launch({ executablePath: executavel, headless: true });
try {
    const page = await browser.newPage({ timezoneId: "America/Sao_Paulo" });
    const erros = [];
    page.on("pageerror", erro => erros.push(erro.message));
    await page.route("**/scripts/auth/auth-service.js?*", route => route.fulfill({ contentType: "text/javascript", body: `
        window.ClimateAuthService = {
            obterUsuarioAtual: () => ({}), ehUsuarioInterno: usuario => !!usuario,
            observarEstado: async callback => { window.alterarUsuarioTeste = callback; callback({ email: 'teste@local' }); },
            sair: async () => window.alterarUsuarioTeste(null),
        };` }));
    await page.route("**/scripts/firebase-service.js?*", route => route.fulfill({ contentType: "text/javascript", body: `
        window.escutasTeste = new Map(); window.totalEscutasTeste = 0;
        window.FirebaseService = { initializeDatabase: async () => {}, trackLoadStart() {}, trackLoadEnd() {},
            listenToPath: (path, callback, onError) => { totalEscutasTeste++; window.escutasTeste.set(path, { callback, onError }); return () => window.escutasTeste.delete(path); }
        };` }));
    await page.goto(`http://127.0.0.1:${servidor.address().port}/`);
    await page.waitForFunction(() => window.escutasTeste.size === 4);
    await page.evaluate(() => {
        window.dadosTeste = {};
        for (const ambiente of ["room", "livingRoom", "aquarium"]) {
            const campos = AppConfig.fields[ambiente];
            const valores = Object.fromEntries(Object.values(campos).map(campo => [campo, 24.17]));
            window.dadosTeste[ambiente] = { [ClimateData.dataAtual()]: { "12-00": { leitura: valores } } };
            window.escutasTeste.get(AppConfig.firebasePaths[ambiente]).callback(window.dadosTeste[ambiente]);
        }
    });
    await page.waitForFunction(() => !!window.Chart);
    for (const [ambiente, tab, stats] of [["livingRoom", "Tab1", "statsSala"], ["room", "Tab2", "statsQuarto"], ["aquarium", "Tab3", "statsAquario"]]) {
        await page.locator(`[data-tab-target="${tab}"]`).click();
        if (ambiente !== "aquarium") await page.locator(`#${tab} .advanced-section:not(.table-section) .collapsible-trigger`).click();
        assert.match(await page.locator(`#${stats}`).innerText(), /24[.,]17/);
        await page.evaluate(ambiente => window.escutasTeste.get(AppConfig.firebasePaths[ambiente]).onError(), ambiente);
        assert.match(await page.locator(`#${stats}`).innerText(), /24[.,]17/, "Erro temporário preserva leituras");
        await page.evaluate(ambiente => window.escutasTeste.get(AppConfig.firebasePaths[ambiente]).callback(null), ambiente);
        assert.doesNotMatch(await page.locator(`#${stats}`).innerText(), /24[.,]17/);
        assert.equal(await page.locator(`#${tab} .heatmap-cell.has-value`).count(), 0);
        assert.equal(await page.evaluate(ambiente => Object.keys(AppConfig.ids.charts).filter(chave => chave.startsWith(ambiente)).some(chave => window.Chart.getChart(AppConfig.ids.charts[chave])), ambiente), false);
        await page.evaluate(() => window.renderizarPainelDaDataSelecionada());
        assert.doesNotMatch(await page.locator(`#${stats}`).innerText(), /24[.,]17/);
        await page.evaluate(ambiente => window.escutasTeste.get(AppConfig.firebasePaths[ambiente]).callback(window.dadosTeste[ambiente]), ambiente);
        assert.match(await page.locator(`#${stats}`).innerText(), /24[.,]17/);
    }
    await page.locator('[data-tab-target="Tab0"]').click();
    await page.evaluate(() => {
        for (const ambiente of ["room", "livingRoom", "aquarium"]) window.escutasTeste.get(AppConfig.firebasePaths[ambiente]).callback(null);
    });
    await page.waitForFunction(() => !/24[.,]17/.test(document.getElementById("statsEstacao").innerText));
    assert.doesNotMatch(await page.locator("#statsEstacao").innerText(), /24[.,]17/);
    await page.evaluate(() => {
        for (const ambiente of ["room", "livingRoom", "aquarium"]) window.escutasTeste.get(AppConfig.firebasePaths[ambiente]).callback(window.dadosTeste[ambiente]);
    });
    await page.locator('[data-tab-target="Tab1"]').click();
    await page.locator("#Tab1 .chart-zoom-button").first().click();
    await page.locator(".plot-zoom-overlay").waitFor();
    await page.evaluate(() => window.alterarUsuarioTeste(null));
    assert.equal(await page.locator(".plot-zoom-overlay").count(), 0);
    assert.equal(await page.evaluate(() => window.escutasTeste.size), 0);
    assert.equal(await page.evaluate("Object.values(dadosMaisRecentes).every(valor => valor === null)"), true);
    await page.locator("#publicSearchInput").fill("89885-000");
    await page.evaluate(() => window.alterarUsuarioTeste({ email: "teste@local" }));
    await page.waitForFunction(() => window.escutasTeste.size === 4);

    await page.locator('[data-tab-target="Tab0"]').click();
    await page.evaluate(() => {
        window.BrowserLocationService.obterLocalizacaoAtual = async () => ({ latitude: -23, longitude: -46 });
        window.ExternalWeatherService.buscarPorCoordenadas = () => new Promise(resolve => { window.resolverClimaTeste = resolve; });
    });
    await page.locator("#environmentLocationButton").click();
    await page.waitForFunction(() => !!window.resolverClimaTeste);
    await page.evaluate(() => { window.alterarUsuarioTeste(null); window.resolverClimaTeste({ origem: { rotulo: "Origem privada tardia" } }); });
    assert.equal(await page.evaluate(() => window.EstacaoView.obterDadosExternosAtuais()), null);
    assert.doesNotMatch(await page.locator("#environmentInsights").innerText(), /Origem privada tardia/);
    await page.evaluate(() => window.alterarUsuarioTeste({ email: "teste@local" }));
    await page.waitForFunction(() => window.escutasTeste.size === 4);

    // A primeira abertura falha; o mesmo botão deve recuperar sem recarregar.
    await page.evaluate(() => {
        const carregar = window.ClimateAssets.carregarAssistente;
        let falhou = false;
        window.ClimateAssets.carregarAssistente = () => {
            if (!falhou) { falhou = true; return Promise.reject(new Error('Falha simulada')); }
            return carregar().then(() => new Promise(resolve => { window.resolverCarregamentoTeste = resolve; }));
        };
    });
    page.on("dialog", dialog => dialog.dismiss());
    await page.locator("#aiChatToggle").click();
    await page.waitForFunction(() => !document.getElementById("aiChatToggle").disabled);
    await page.locator("#aiChatToggle").click();
    await page.waitForFunction(() => !!window.resolverCarregamentoTeste);
    await page.evaluate(() => { window.alterarUsuarioTeste(null); window.resolverCarregamentoTeste(); });
    await page.waitForFunction(() => !document.getElementById("aiChatToggle").disabled);
    assert.equal(await page.locator(".ai-chat.is-open").count(), 0, "Carregamento antigo não pode abrir a assistente");
    await page.evaluate(() => window.alterarUsuarioTeste({ email: "teste@local" }));
    await page.locator("#aiChatToggle").click();
    await page.locator(".ai-chat.is-open").waitFor();
    await page.evaluate(() => {
        const preservado = document.createElement("button"); preservado.id = "inertTeste"; preservado.inert = true; document.body.append(preservado);
        window.ClimateAssistant.query.answerQuestionDetailed = () => new Promise(resolve => { window.resolverRespostaTeste = () => resolve({ answer: 'Dado privado tardio', result: {} }); });
    });
    await page.locator("#aiChatInput").fill("Resumo privado");
    await page.locator("#aiChatSubmit").click();
    await page.evaluate(() => { window.alterarUsuarioTeste(null); window.resolverRespostaTeste(); });
    assert.equal(await page.locator("#aiChatMessages").innerText(), "");
    assert.equal(await page.locator("#aiChatPanel").isVisible(), false);
    assert.equal(await page.locator("body").evaluate(el => el.classList.contains("ai-chat-scroll-locked")), false);
    assert.equal(await page.locator("#inertTeste").evaluate(el => el.inert), true);
    await page.locator("#publicSearchInput").fill("89885-000");
    await page.locator("#publicSearchInput").focus();
    assert.equal(await page.locator("#publicSearchInput").evaluate(el => el === document.activeElement), true);

    // Dia/noite usa o relógio do local e escolhe os eventos da data local.
    for (const [snapshot, instante, modo] of [[acre, "2026-11-24T09:30:00Z", "night"], [sp, "2026-11-24T09:30:00Z", "day"], [acre, "2026-11-25T04:30:00Z", "night"], [acre, "2026-11-25T05:30:00Z", "night"], [acre, "2026-11-24T10:30:00Z", "twilight"], [acre, "2026-11-24T11:00:00Z", "day"], [acre, "2026-11-24T23:30:00Z", "twilight"]]) {
        assert.equal(await page.evaluate(({ snapshot, instante }) => {
            window.dispatchEvent(new CustomEvent("public-solar-events-updated", { detail: { events: snapshot.cicloSolar, fusoHorario: snapshot.fusoHorario, ciclosSolares: snapshot.ciclosSolares } }));
            return window.obterEstadoAstronomico(new Date(instante)).mode;
        }, { snapshot, instante }), modo);
    }

    // Exportador real: inspeciona o Blob serializado para todas as abas.
    await page.evaluate(() => window.ClimateAssets.carregarRelatorio());
    const jsons = await page.evaluate(async () => {
        const blobs = [];
        URL.createObjectURL = blob => { blobs.push(blob); return 'blob:teste'; };
        URL.revokeObjectURL = () => {};
        HTMLAnchorElement.prototype.click = () => {};
        for (const tab of ['Estação', 'Sala', 'Quarto', 'Aquário']) {
            ClimatePdfReportModules.exporter.exportJsonReport({
                tabLabel: tab, selectedDate: '24-11-2026', generatedAt: new Date(), summaryCards: [], tableRows: [], tableMetrics: [], rows: [], selectedData: {}, fileNameJson: 'teste.json',
                dadosClimaExterno: { origem: { tipo: 'localizacao', rotulo: 'Local permitido', latitude: -23.12345, longitude: -46.54321, precisao: 4 },
                    climaAtual: { temperatura: 23, latitude: 999 }, previsaoCurtoPrazo: [{ precipitacao: 2, probabilidadeChuva: 80, extra: { longitude: 999, precisao: 1 } }] },
            });
        }
        return Promise.all(blobs.map(blob => blob.text()));
    });
    for (const json of jsons) {
        assert.doesNotMatch(json, /latitude|longitude|precisao/);
        const dados = JSON.parse(json).climaExterno;
        assert.equal(dados.origem.rotulo, "Local permitido");
        assert.equal(dados.climaAtual.temperatura, 23);
        assert.equal(dados.previsaoCurtoPrazo[0].precipitacao, 2);
    }

    // Exportação suspensa não pode baixar nem remontar a tela depois da saída.
    await page.evaluate(() => {
        window.alterarUsuarioTeste({ email: "teste@local" });
        ClimatePdfReportModules.exporter.buildReport = () => new Promise(resolve => { window.resolverExportacaoTeste = resolve; });
        window.downloadsTeste = 0;
        ClimatePdfReportModules.exporter.exportJsonReport = () => window.downloadsTeste++;
    });
    await page.locator('label[for="exportFormatJson"]').click();
    await page.locator("#btnExportData").click();
    await page.waitForFunction(() => !!window.resolverExportacaoTeste);
    await page.evaluate(() => { window.alterarUsuarioTeste(null); window.resolverExportacaoTeste({}); });
    assert.equal(await page.evaluate(() => window.downloadsTeste), 0);
    assert.equal(await page.locator(".pdf-render-root").count(), 0);
    assert.equal(await page.locator("#exportFeedback").isVisible(), false);
    assert.deepEqual(erros, []);
    console.log("Auditoria: privacidade, sessão, snapshots nulos, chuva ausente, UF, fusos e recuperação de recursos aprovados.");
} finally {
    await browser.close();
    await new Promise(resolve => servidor.close(resolve));
}
