import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { chromium } from "playwright-core";

const raiz = process.cwd();
const executavel = [
    "C:/Program Files/Google/Chrome/Application/chrome.exe",
    "C:/Program Files (x86)/Google/Chrome/Application/chrome.exe",
    "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
].find(fs.existsSync);
assert.ok(executavel, "Chrome ou Edge não encontrado para testar exportação.");

const navegador = await chromium.launch({ executablePath: executavel, headless: true });
try {
    const pagina = await navegador.newPage();
    await pagina.setContent(`
        <input type="radio" name="exportFormat" value="json" checked>
        <button id="btnExportData">Exportar JSON</button>
        <div id="exportFeedback" role="status" aria-live="polite" hidden>
            <span id="exportStatus"></span>
            <button id="btnRetryExport" hidden>Tentar novamente</button>
        </div>
    `);
    await pagina.addScriptTag({ content: `
        window.AppConfig = { exports: { timeoutMs: 500 } };
        window.ClimateContracts = { validarContextoRelatorio: () => true };
        window.ClimateDiagnostics = { depurar: () => {} };
        window.ClimatePdfReportModules = { exporter: {
            buildReport: async (contexto, { onProgress }) => {
                onProgress('Gerando gráficos.');
                return { fileNameJson: 'teste.json' };
            },
            exportJsonReport: () => {},
        } };
        window.ClimateAssets = {
            carregarRelatorio: async () => {},
            carregarCssRelatorio: async () => {},
            carregarChart: async () => {},
        };
    ` });
    await pagina.addScriptTag({ path: path.join(raiz, "scripts/reports/pdf-report.js") });
    await pagina.evaluate(() => ClimatePdfReport.setup({
        buttonId: "btnExportData",
        getContext: () => ({ activeTab: "Tab1", selectedDate: "16-08-2026", latestData: {} }),
    }));

    await pagina.locator("#btnExportData").click();
    await pagina.locator("#exportStatus").waitFor({ state: "visible" });
    assert.equal(await pagina.locator("#exportStatus").innerText(), "Download iniciado.");

    await pagina.evaluate(() => {
        AppConfig.exports.timeoutMs = 10;
        ClimatePdfReportModules.exporter.buildReport = () => new Promise(resolve => setTimeout(resolve, 100));
    });
    await pagina.locator("#btnExportData").click();
    await pagina.waitForTimeout(30);
    assert.match(await pagina.locator("#exportStatus").innerText(), /demorou além do esperado/);
    assert.equal(await pagina.locator("#btnRetryExport").isVisible(), true);

    await pagina.setContent(`
        <style>
            body { margin: 0; width: 100%; overflow-x: auto; }
            .tab-nav { width: 360px; height: 48px; }
        </style>
        <nav class="tab-nav">Abas</nav>
        <input type="radio" name="exportFormat" value="pdf" checked>
        <button id="btnExportData">Exportar PDF</button>
        <div id="exportFeedback" role="status" aria-live="polite" hidden>
            <span id="exportStatus"></span>
            <button id="btnRetryExport" hidden>Tentar novamente</button>
        </div>
    `);
    await pagina.addStyleTag({ path: path.join(raiz, "styles/reports/pdf-report.css") });
    await pagina.addScriptTag({ content: `
        window.AppConfig = { exports: { timeoutMs: 500 } };
        window.ClimateContracts = { validarContextoRelatorio: () => true };
        window.ClimateDiagnostics = { depurar: () => {} };
        window.__larguraAntes = document.documentElement.scrollWidth;
        window.ClimatePdfReportModules = {
            exporter: {
                buildReport: async () => {
                    const element = document.createElement('article');
                    element.className = 'pdf-report';
                    element.textContent = 'Relatório';
                    return { element, fileNamePdf: 'teste.pdf' };
                },
                carregarBibliotecasPdf: async () => {},
            },
            pdf: {
                generatePdf: async () => {
                    const root = document.querySelector('.pdf-render-root');
                    window.__raizDurantePdf = {
                        direita: root.getBoundingClientRect().right,
                        larguraPagina: document.documentElement.scrollWidth,
                    };
                },
            },
        };
        window.ClimateAssets = {
            carregarRelatorio: async () => {},
            carregarCssRelatorio: async () => {},
            carregarChart: async () => {},
        };
        window.ClimateCharts = { registerComfortBand: () => {} };
    ` });
    await pagina.addScriptTag({ path: path.join(raiz, "scripts/reports/pdf-report.js") });
    await pagina.evaluate(() => ClimatePdfReport.setup({
        buttonId: "btnExportData",
        getContext: () => ({ activeTab: "Tab1", selectedDate: "16-08-2026", latestData: {} }),
    }));
    await pagina.locator("#btnExportData").click();
    await pagina.waitForTimeout(20);
    const geometria = await pagina.evaluate(() => ({
        antes: window.__larguraAntes,
        durante: window.__raizDurantePdf,
        depois: document.documentElement.scrollWidth,
        raizesRestantes: document.querySelectorAll('.pdf-render-root').length,
    }));
    assert.ok(geometria.durante.direita < 0, "A raiz do PDF deve permanecer fora do viewport.");
    assert.equal(geometria.durante.larguraPagina, geometria.antes);
    assert.equal(geometria.depois, geometria.antes);
    assert.equal(geometria.raizesRestantes, 0);
    console.log("Progresso, timeout e nova tentativa da exportação concluídos com sucesso.");
} finally {
    await navegador.close();
}
