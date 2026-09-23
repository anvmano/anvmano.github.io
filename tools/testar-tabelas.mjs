import verificar from "node:assert/strict";
import arquivos from "node:fs";
import caminho from "node:path";
import { chromium } from "playwright-core";

const raiz = process.cwd();
const estilosVisualizacoes = arquivos.readFileSync(caminho.join(raiz, "styles", "advanced-views.css"), "utf8");
const executavel = [
    "C:/Program Files/Google/Chrome/Application/chrome.exe",
    "C:/Program Files (x86)/Google/Chrome/Application/chrome.exe",
    "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
].find(arquivos.existsSync);
verificar.ok(executavel, "Chrome ou Edge não encontrado para testar tabelas.");

const navegador = await chromium.launch({ executablePath: executavel, headless: true });
try {
    const pagina = await navegador.newPage({ viewport: { width: 390, height: 844 } });
    await pagina.setContent(`
        <style>
            :root { --bg-card: #172033; --bg-panel: rgba(15, 23, 42, 0.56); --text-muted: #94a3b8; --radius-sm: 5px; }
            ${estilosVisualizacoes}
            #mapaTeste { width: 320px; }
        </style>
        <div id="tabela"></div>
        <div class="weekly-heatmap" id="mapaTeste"></div>
    `);
    await pagina.addScriptTag({ content: "window.AppConfig={measurementUnits:{Temperatura:'°C'}}" });
    await pagina.addScriptTag({ path: caminho.join(raiz, "scripts/data/data-utils.js") });
    await pagina.addScriptTag({ path: caminho.join(raiz, "scripts/ui/ui.js") });
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
    verificar.equal(await pagina.locator(".table-tools__count").innerText(), "3 de 24 horários");
    verificar.equal(await pagina.locator("tbody tr").first().locator("td:nth-child(2)").innerText(), "12:00");
    await pagina.locator("[data-table-sort]").click();
    verificar.equal(await pagina.locator("tbody tr").first().locator("td:nth-child(2)").innerText(), "10:00");

    const arquivoBaixado = pagina.waitForEvent("download");
    await pagina.locator("[data-table-csv]").click();
    verificar.match((await arquivoBaixado).suggestedFilename(), /estacao-climatica-\d{2}-\d{2}-\d{4}\.csv/);

    await pagina.evaluate(() => {
        const mapa = document.getElementById("mapaTeste");
        const canto = document.createElement("span");
        canto.className = "weekly-heatmap__axis weekly-heatmap__axis--corner";
        mapa.appendChild(canto);
        for (let hora = 0; hora < 24; hora += 1) {
            const eixo = document.createElement("span");
            eixo.className = "weekly-heatmap__axis";
            eixo.textContent = `${hora}h`;
            mapa.appendChild(eixo);
        }
        const dia = document.createElement("span");
        dia.className = "weekly-heatmap__axis weekly-heatmap__day";
        dia.textContent = "Dom";
        mapa.appendChild(dia);
        for (let hora = 0; hora < 24; hora += 1) {
            const celula = document.createElement("span");
            celula.className = "heatmap-cell weekly-heatmap__cell";
            celula.style.backgroundColor = "#0ea5e9";
            mapa.appendChild(celula);
        }
        mapa.scrollLeft = 260;
    });
    const estadoRotuloFixo = await pagina.evaluate(() => {
        const mapa = document.getElementById("mapaTeste");
        const dia = mapa.querySelector(".weekly-heatmap__day");
        const caixaMapa = mapa.getBoundingClientRect();
        const caixaDia = dia.getBoundingClientRect();
        const elementoNoCentro = document.elementFromPoint(caixaDia.left + caixaDia.width / 2, caixaDia.top + caixaDia.height / 2);
        return {
            alinhado: Math.abs(caixaDia.left - caixaMapa.left) < 1,
            largura: caixaDia.width,
            opaco: getComputedStyle(dia).backgroundColor === "rgb(23, 32, 51)",
            naFrente: elementoNoCentro === dia,
        };
    });
    verificar.equal(estadoRotuloFixo.alinhado, true, "Dia da semana deve permanecer alinhado à esquerda durante a rolagem.");
    verificar.equal(estadoRotuloFixo.largura, 48, "Coluna fixa dos dias deve manter largura estável.");
    verificar.equal(estadoRotuloFixo.opaco, true, "Dia da semana deve ocultar as células que passam por trás.");
    verificar.equal(estadoRotuloFixo.naFrente, true, "Dia da semana deve permanecer acima das células roláveis.");
    console.log("Ordenação, contador e CSV da tabela concluídos com sucesso.");
} finally {
    await navegador.close();
}
