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
assert.ok(executavel, "Chrome ou Edge não encontrado para testar tabelas.");

const navegador = await chromium.launch({ executablePath: executavel, headless: true });
try {
    const pagina = await navegador.newPage();
    await pagina.setContent('<div id="tabela"></div>');
    await pagina.addScriptTag({ content: "window.AppConfig={measurementUnits:{Temperatura:'°C'}}" });
    await pagina.addScriptTag({ path: path.join(raiz, "scripts/data/data-utils.js") });
    await pagina.addScriptTag({ path: path.join(raiz, "scripts/ui/ui.js") });
    await pagina.evaluate(() => {
        const dados = {
            "16-08-2026": {
                "12-00": { a: { Temperatura: 26 } },
                "10-00": { b: { Temperatura: 24 } },
                "11-00": { c: { Temperatura: 25 } },
            },
        };
        ClimateUI.renderTable("tabela", ClimateData.createTables(["Data", "Hora", "Temperatura"], dados));
    });
    assert.equal(await pagina.locator(".table-tools__count").innerText(), "3 de 24 horários");
    assert.equal(await pagina.locator("tbody tr").first().locator("td:nth-child(2)").innerText(), "12:00");
    await pagina.locator("[data-table-sort]").click();
    assert.equal(await pagina.locator("tbody tr").first().locator("td:nth-child(2)").innerText(), "10:00");

    const download = pagina.waitForEvent("download");
    await pagina.locator("[data-table-csv]").click();
    assert.match((await download).suggestedFilename(), /estacao-climatica-\d{2}-\d{2}-\d{4}\.csv/);
    console.log("Ordenação, contador e CSV da tabela concluídos com sucesso.");
} finally {
    await navegador.close();
}
