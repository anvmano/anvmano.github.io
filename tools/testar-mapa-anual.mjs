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
        window.ClimateAnalytics.renderAdvancedClimateViews(dados, "29-02-2024", {
            containers: { mapaAnual: "anual" }, campoOutroAmbiente: "temp",
            dadosOutroAmbiente: {
                "10-01-2024": { "10-00": { a: { temp: 38 }, b: { temp: 42 } } },
                "01-01-2022": { "10-00": { a: { temp: 99 } } },
            },
        });
        return [...document.querySelectorAll("#anual button")].filter(b => !b.title.includes("Sem dados")).map(b => b.style.backgroundColor);
    }, temperaturas);
    const coresMensais = await pagina.locator(".calendar-heatmap__day").evaluateAll(dias => dias.map(dia => dia.style.backgroundColor));
    assert.deepEqual(coresMensais.slice(0, temperaturas.length), cores);
    assert.equal(coresMensais.at(-1), "var(--border)");
    assert.equal(cores[0], "rgb(99, 102, 241)");
    assert.equal(new Set(cores).size, temperaturas.length);
    assert.match(await pagina.locator("#anual .anual-legenda").textContent(), /14,9 °C.*40 °C/);
    const contrastes = await pagina.locator(".calendar-heatmap__day.has-value").evaluateAll(celulas => celulas.map(celula => {
        const luminancia = cor => {
            const canais = cor.match(/\d+/g).slice(0, 3).map(Number).map(valor => valor / 255)
                .map(valor => valor <= 0.04045 ? valor / 12.92 : ((valor + 0.055) / 1.055) ** 2.4);
            return canais[0] * 0.2126 + canais[1] * 0.7152 + canais[2] * 0.0722;
        };
        const estilo = getComputedStyle(celula);
        const texto = luminancia(estilo.color);
        const fundo = luminancia(estilo.backgroundColor);
        return (Math.max(texto, fundo) + 0.05) / (Math.min(texto, fundo) + 0.05);
    }));
    assert.ok(contrastes.every(contraste => contraste >= 4.5), "Todas as faixas mensais, incluindo limites e extremos, devem ter contraste AA");
    await pagina.locator("section").evaluate(el => el.classList.add("is-collapsed"));
    await pagina.evaluate(() => window.ClimateAnalytics.renderAdvancedClimateViews(null, "29-02-2024", { containers: { mapaAnual: "anual" } }));
    assert.equal(await dias.count(), 0, "Snapshot nulo apaga o DOM privado recolhido");
    await pagina.locator("section").evaluate(el => el.classList.remove("is-collapsed"));
    await pagina.evaluate(renderizar);
    assert.equal(await dias.count(), 365, "Após limpar, a expansão deve reconstruir o mapa");
} finally {
    await navegador.close();
}
