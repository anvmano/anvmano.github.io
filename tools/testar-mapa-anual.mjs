import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { chromium } from "playwright-core";

const executavel = ["C:/Program Files/Google/Chrome/Application/chrome.exe", "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe"].find(existsSync);
const navegador = await chromium.launch({ executablePath: executavel });
try {
    const pagina = await navegador.newPage({ viewport: { width: 390, height: 844 } });
    await pagina.setContent('<section class="collapsible-section is-collapsed"><div id="monthlyClimateCalendar"></div><div id="anual"></div></section>');
    await pagina.addStyleTag({ path: "styles/advanced-views.css" });
    for (const path of ["scripts/config.js", "scripts/data/data-utils.js", "scripts/data/analytics.js"]) await pagina.addScriptTag({ path });
    const renderizar = () => window.ClimateAnalytics.renderAdvancedClimateViews({
        "29-02-2024": { "10-00": { a: { Temperatura: 20 }, b: { Temperatura: 24 } }, "11-00": { c: { Temperatura: 28 } } },
    }, "01-03-2024", { containers: { mapaAnual: "anual" } });
    await pagina.evaluate(renderizar);
    const dias = pagina.locator("#anual button");
    assert.equal(await dias.count(), 0);
    await pagina.locator("section").evaluate(el => el.classList.remove("is-collapsed"));
    await pagina.evaluate(renderizar);
    assert.equal(await dias.count(), 365);
    assert.match(await dias.first().getAttribute("title"), /^03\/03\/2023/);
    assert.match(await dias.last().getAttribute("title"), /01\/03\/2024 · Sem dados/);
    assert.ok(await pagina.locator(".anual-rolagem").evaluate(el => el.scrollLeft > 0));
    await dias.last().focus();
    await pagina.keyboard.press("ArrowUp");
    assert.match(await pagina.locator("#anual output").textContent(), /29\/02\/2024 · Média: 24,0 °C · 2 de 24 horários/);
    const temperaturas = [14.9, 15, 17.5, 20, 22.5, 25, 27.5, 30, 32.5, 35, 35.1];
    const cores = await pagina.evaluate(valores => {
        const dados = Object.fromEntries(valores.map((Temperatura, i) => [
            String(i + 1).padStart(2, "0") + "-02-2024", { "10-00": { a: { Temperatura } } },
        ]));
        window.ClimateAnalytics.renderAdvancedClimateViews(dados, "29-02-2024", { containers: { mapaAnual: "anual" } });
        return [...document.querySelectorAll("#anual button")].filter(b => !b.title.includes("Sem dados")).map(b => b.style.backgroundColor);
    }, temperaturas);
    const coresMensais = await pagina.locator(".calendar-heatmap__day").evaluateAll(dias => dias.map(dia => dia.style.backgroundColor));
    assert.deepEqual(coresMensais.slice(0, temperaturas.length), cores);
    assert.equal(coresMensais.at(-1), "var(--border)");
    assert.deepEqual(cores, ["99,102,241", "67,133,220", "56,180,237", "36,198,183", "163,214,92", "242,212,80", "255,170,66", "247,122,57", "239,83,80", "239,83,80", "220,57,118"].map(rgb => "rgb(" + rgb.replaceAll(",", ", ") + ")"));
} finally {
    await navegador.close();
}
