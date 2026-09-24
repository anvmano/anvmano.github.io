import assert from "node:assert/strict";
import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { chromium } from "playwright-core";

const raiz = process.cwd();
const executavel = [
    "C:/Program Files/Google/Chrome/Application/chrome.exe",
    "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
].find(fs.existsSync);
assert.ok(executavel, "Chrome ou Edge necessario.");
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
        const page = await browser.newPage({ viewport });
        await page.goto(`http://127.0.0.1:${servidor.address().port}/`);
        await page.evaluate(async () => {
            await window.ClimateAssets.carregarChart();
            const card = document.createElement("div");
            card.className = "chart-card";
            card.id = "testeZoom";
            card.innerHTML = '<div class="chart-label">Temperatura por ambiente<span class="chart-period">24h: 22/09/2026, 12:30 a 23/09/2026, 12:30</span></div><canvas id="testeCanvas" class="plot"></canvas>';
            document.body.appendChild(card);
            const options = { responsive: true, maintainAspectRatio: false, animation: false };
            const chart = new window.Chart(card.querySelector("canvas"), {
                type: "line", data: { labels: ["10:00", "11:00", "12:00"], datasets: [{ label: "Sala", data: [20, 24, 21] }] }, options,
            });
            window.ClimateZoom.registrarCards(document, { chartInstances: { testeCanvas: chart }, getZoomOptions: () => options });
        });
        await page.locator("#testeZoom .chart-zoom-button").click();
        await page.locator(".plot-zoom-overlay").waitFor();
        await page.waitForTimeout(350);
        for (const seletor of [".plot-zoom-overlay .chart-card", ".plot--zoom", ".plot-zoom-close"]) {
            const box = await page.locator(seletor).boundingBox();
            assert.ok(box && box.x >= 0 && box.y >= 0 && box.x + box.width <= viewport.width + 1 && box.y + box.height <= viewport.height + 1, `${seletor} fora da tela em ${viewport.width}x${viewport.height}: ${JSON.stringify(box)}`);
            if (seletor === ".plot-zoom-close") assert.ok(box.width >= 44 && box.height >= 44);
        }
        const destino = path.join(raiz, "ui-ux-evidence/2026-09-23-etapa-1");
        fs.mkdirSync(destino, { recursive: true });
        await page.screenshot({ path: path.join(destino, `zoom-${viewport.width}.png`) });
        await page.keyboard.press("Escape");
        await page.waitForTimeout(50);
        assert.equal(await page.locator(".plot-zoom-overlay").count(), 0);
        assert.equal(await page.locator("#testeZoom .chart-zoom-button").evaluate(el => el === document.activeElement), true);
        await page.locator("#testeZoom .chart-zoom-button").click();
        await page.locator(".plot-zoom-close").click();
        assert.equal(await page.locator(".plot-zoom-overlay").count(), 0);
        await page.close();
    }
    console.log("Zoom: geometria, fechamento e retorno de foco aprovados em 3 viewports.");
} finally {
    await browser.close();
    await new Promise(resolve => servidor.close(resolve));
}
