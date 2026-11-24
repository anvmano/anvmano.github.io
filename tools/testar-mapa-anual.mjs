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
} finally {
    await navegador.close();
}
