import verificar from "node:assert/strict";
import arquivos from "node:fs";
import maquinaVirtual from "node:vm";
import { chromium } from "playwright-core";

const codigoChuva = arquivos.readFileSync("scripts/charts/rain.js", "utf8");
const codigoSolar = arquivos.readFileSync("scripts/charts/solar.js", "utf8");
const servicoExterno = arquivos.readFileSync("scripts/external/external-weather-service.js", "utf8");
const viewPublica = arquivos.readFileSync("scripts/views/public-weather-view.js", "utf8");
const viewEstacao = arquivos.readFileSync("scripts/views/estacao-view.js", "utf8");
const estilosGraficos = arquivos.readFileSync("styles/charts.css", "utf8");
const estilosResponsivos = arquivos.readFileSync("styles/responsive.css", "utf8");

const contexto = { Date };
contexto.window = contexto;
maquinaVirtual.runInNewContext(codigoChuva, contexto);

const previsao = [];
const inicio = new Date("2026-09-21T16:00:00");
for (let indice = 0; indice < 38; indice += 1) {
    const horario = new Date(inicio.getTime() + indice * 60 * 60 * 1000);
    previsao.push({
        horario: `${horario.getFullYear()}-${String(horario.getMonth() + 1).padStart(2, "0")}-${String(horario.getDate()).padStart(2, "0")}T${String(horario.getHours()).padStart(2, "0")}:00`,
        precipitacao: indice % 5 === 0 ? 1.2 : 0,
        probabilidadeChuva: indice * 2,
    });
}

const janela = contexto.ClimateChuva.montarJanela(previsao, new Date("2026-09-22T16:00:00"));
verificar.equal(janela.tipos.filter(tipo => tipo === "observado").length, 25);
verificar.equal(janela.tipos.filter(tipo => tipo === "previsao").length, 12);
verificar.equal(janela.indiceAgora, 24);
verificar.equal(janela.horarios[janela.indiceAgora + 1], "2026-09-22T17:00");

verificar.equal(contexto.ClimateChuva.analisarAgora({ precipitacao: 0, chuva: 0, codigoTempo: 1 }).rotulo, "Sem chuva agora");
verificar.equal(contexto.ClimateChuva.analisarAgora({ precipitacao: 0.3, chuva: 0.3, codigoTempo: 61 }).rotulo, "Chovendo agora");
verificar.equal(contexto.ClimateChuva.analisarAgora({ precipitacao: 0, chuva: 0, codigoTempo: 95 }).chovendo, true);
verificar.equal(contexto.ClimateChuva.analisarAgora({}).disponivel, false);

verificar.match(codigoSolar, /interaction:\s*\{\s*mode: 'index'/);
verificar.match(codigoSolar, /itemSort: ordenarTooltipPorPosicaoVisual/);
const contextoSolar = {
    window: null,
    Chart: { Tooltip: { positioners: {} } },
    ClimateData: { formatTime: valor => String(valor) },
    matchMedia: () => ({ matches: true }),
};
contextoSolar.window = contextoSolar;
maquinaVirtual.runInNewContext(codigoSolar, contextoSolar);
const pontosSolaresMoveis = contextoSolar.ClimateSolar.getSolarEventPointOptions();
verificar.equal(pontosSolaresMoveis.pointRadius, 7);
verificar.equal(pontosSolaresMoveis.pointHitRadius, 24);
verificar.equal(pontosSolaresMoveis.pointHoverRadius, 9);
verificar.match(estilosGraficos, /@media \(max-width: 640px\)[\s\S]*?\.chart-card__meta-chip \{[\s\S]*?position: static/);
verificar.match(estilosResponsivos, /#plotRain,[\s\S]*?#publicChartRain[\s\S]*?height:\s*200px\s*!important/);
verificar.match(servicoExterno, /probabilidadeChuva: normalizarSerie\(clima\.hourly\?\.precipitation_probability\)/);
verificar.match(servicoExterno, /precipitacao: normalizarSerie\(clima\.hourly\?\.precipitation\)/);
verificar.match(viewPublica, /publicChartRain/);
verificar.match(viewPublica, /grupoSincronizacao: "publico"/);
verificar.match(viewPublica, /getSolarEventPointOptions\(\)/);
verificar.match(viewEstacao, /grupoSincronizacao: "estacao"/);
verificar.match(codigoChuva, /rain-chart-toggle/);
verificar.match(codigoChuva, /data-rain-mode="precipitacao"/);
verificar.match(codigoChuva, /data-rain-mode="probabilidade"/);
verificar.match(codigoChuva, /limiteTicks = movel \? 5 : 13/);
verificar.match(estilosGraficos, /\.rain-chart-toggle/);

const executavel = [
    "C:/Program Files/Google/Chrome/Application/chrome.exe",
    "C:/Program Files (x86)/Google/Chrome/Application/chrome.exe",
    "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
].find(arquivos.existsSync);
verificar.ok(executavel, "Chrome ou Edge não encontrado para validar o card solar móvel.");

const navegador = await chromium.launch({ executablePath: executavel, headless: true });
try {
    const pagina = await navegador.newPage({ viewport: { width: 390, height: 844 } });
    await pagina.setContent(`
        <style>
            :root { --bg-elevated: #172033; --border: #334155; --radius-lg: 8px; --space-4: 16px; --text-secondary: #94a3b8; --accent: #38bdf8; }
            ${estilosGraficos}
            .chart-card { width: 350px; }
        </style>
        <div class="chart-card chart-card--wide">
            <span class="chart-label">Ciclo Solar do Dia</span>
            <span class="chart-card__meta-chip">Duração do dia: 12h08</span>
            <canvas class="plot plot--solar-day"></canvas>
            <button class="chart-zoom-button" aria-label="Ampliar gráfico"></button>
        </div>
        <div class="chart-card chart-card--wide" id="cartaoChuvaOculto" hidden>
            <span class="chart-label">Chuva · 24h + previsão 12h</span>
            <canvas class="plot"></canvas>
        </div>
    `);
    verificar.equal(
        await pagina.locator("#cartaoChuvaOculto").evaluate(elemento => getComputedStyle(elemento).display),
        "none",
        "O card privado de chuva deve permanecer oculto antes da consulta de localização."
    );
    const caixas = await pagina.evaluate(() => {
        const caixa = seletor => {
            const retangulo = document.querySelector(seletor).getBoundingClientRect();
            return { left: retangulo.left, right: retangulo.right, top: retangulo.top, bottom: retangulo.bottom };
        };
        return { chip: caixa(".chart-card__meta-chip"), botao: caixa(".chart-zoom-button"), grafico: caixa(".plot") };
    });
    const sobrepoe = (a, b) => a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;
    verificar.equal(sobrepoe(caixas.chip, caixas.botao), false, "Chip de duração não pode cobrir o botão de ampliar.");
    verificar.ok(caixas.chip.bottom <= caixas.grafico.top, "Chip de duração deve reservar espaço antes do gráfico.");
} finally {
    await navegador.close();
}

console.log("Testes de chuva, tooltip solar e layout móvel concluídos com sucesso.");
