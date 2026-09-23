import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

const codigo = fs.readFileSync("scripts/charts/chart-sync.js", "utf8");
const utilitariosGraficos = fs.readFileSync("scripts/charts/chart-utils.js", "utf8");
const viewPublica = fs.readFileSync("scripts/views/public-weather-view.js", "utf8");
assert.match(utilitariosGraficos, /ClimateChartSync\?\.tratarInteracao/);
assert.match(utilitariosGraficos, /grupoSincronizacao/);
assert.match(viewPublica, /ClimateChartSync\?\.registrar\(grafico, "publico"\)/);
const contexto = { window: {} };
contexto.window = contexto;
vm.runInNewContext(codigo, contexto);

function criarGrafico(id, dados) {
    const chamadas = { ativos: [], tooltip: [], atualizacoes: [] };
    return {
        canvas: { id, isConnected: true },
        data: { datasets: dados.map(valores => ({ data: valores })) },
        chartArea: { left: 12, top: 8 },
        scales: { x: { getPixelForValue: indice => indice * 10 } },
        chamadas,
        setActiveElements: elementos => chamadas.ativos.push(elementos),
        tooltip: {
            setActiveElements: (elementos, posicao) => chamadas.tooltip.push({ elementos, posicao }),
        },
        getDatasetMeta: indiceSerie => ({
            data: dados[indiceSerie].map((_, indice) => ({
                tooltipPosition: () => ({ x: indice * 10, y: indiceSerie * 10 + 5 }),
            })),
        }),
        update: modo => chamadas.atualizacoes.push(modo),
    };
}

const graficoTemperatura = criarGrafico("temperatura", [[25, 26, 27]]);
const graficoUmidade = criarGrafico("umidade", [[48, null, 52]]);
const graficoOutroGrupo = criarGrafico("pressao-publica", [[1012, 1013, 1014]]);
const graficoSensor = criarGrafico("sensor-estacao", [[25, 26, 27]]);
const graficoChuva = criarGrafico("chuva-estacao", [[0, 0.3, 0]]);
graficoSensor.$chavesSincronizacao = ["2026-09-22T08:00", "2026-09-22T10:25", "2026-09-22T11:05"];
graficoChuva.$chavesSincronizacao = ["2026-09-22T09:00", "2026-09-22T10:00", "2026-09-22T11:00"];

contexto.ClimateChartSync.registrar(graficoTemperatura, "sala");
contexto.ClimateChartSync.registrar(graficoUmidade, "sala");
contexto.ClimateChartSync.registrar(graficoOutroGrupo, "publico");
contexto.ClimateChartSync.registrar(graficoSensor, "estacao");
contexto.ClimateChartSync.registrar(graficoChuva, "estacao");

contexto.ClimateChartSync.tratarInteracao(graficoTemperatura, { type: "mousemove" }, [{ datasetIndex: 0, index: 0 }]);
assert.equal(graficoTemperatura.chamadas.ativos.length, 0, "O gráfico de origem deve manter somente o ponto nativo do Chart.js.");
assert.equal(JSON.stringify(graficoUmidade.chamadas.ativos.at(-1)), JSON.stringify([{ datasetIndex: 0, index: 0 }]));
assert.equal(graficoOutroGrupo.chamadas.ativos.length, 0);

contexto.ClimateChartSync.tratarInteracao(graficoTemperatura, { type: "mousemove" }, [{ datasetIndex: 0, index: 1 }]);
assert.equal(graficoTemperatura.chamadas.ativos.length, 0, "A sincronização não deve duplicar o ponto ativo na origem.");
assert.equal(JSON.stringify(graficoUmidade.chamadas.ativos.at(-1)), JSON.stringify([]));

contexto.ClimateChartSync.tratarInteracao(graficoTemperatura, { type: "mouseout" }, []);
assert.equal(JSON.stringify(graficoTemperatura.chamadas.ativos.at(-1)), JSON.stringify([]));
assert.equal(JSON.stringify(graficoUmidade.chamadas.ativos.at(-1)), JSON.stringify([]));

contexto.ClimateChartSync.desregistrar(graficoUmidade);
contexto.ClimateChartSync.tratarInteracao(graficoTemperatura, { type: "mousemove" }, [{ datasetIndex: 0, index: 2 }]);
assert.equal(graficoUmidade.chamadas.ativos.length, 3);

contexto.ClimateChartSync.tratarInteracao(graficoSensor, { type: "mousemove" }, [{ datasetIndex: 0, index: 1 }]);
assert.equal(JSON.stringify(graficoChuva.chamadas.ativos.at(-1)), JSON.stringify([{ datasetIndex: 0, index: 1 }]));

contexto.ClimateChartSync.tratarInteracao(graficoSensor, { type: "mousemove" }, [{ datasetIndex: 0, index: 0 }]);
assert.equal(JSON.stringify(graficoChuva.chamadas.ativos.at(-1)), JSON.stringify([]));

console.log("Testes de sincronização temporal entre gráficos concluídos com sucesso.");
