import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";

class Elemento {
    constructor(id = "") {
        this.id = id;
        this.dataset = {};
        this.style = {};
        this.atributos = new Map();
        this.eventos = new Map();
        const classes = new Set();
        this.classList = {
            add: nome => classes.add(nome),
            remove: nome => classes.delete(nome),
            contains: nome => classes.has(nome),
        };
    }
    addEventListener(nome, callback) { this.eventos.set(nome, callback); }
    setAttribute(nome, valor) { this.atributos.set(nome, valor); }
    removeAttribute(nome) { this.atributos.delete(nome); }
    hasAttribute(nome) { return this.atributos.has(nome); }
    focus() {}
    closest() { return null; }
}

const abas = Array.from({ length: 4 }, (_, indice) => new Elemento(`Tab${indice}`));
const botoes = abas.map(aba => {
    const botao = new Elemento();
    botao.dataset.tabTarget = aba.id;
    return botao;
});
const recipiente = new Elemento();
recipiente.classList.add("container");
const entradaData = new Elemento("selectedDate");
const elementos = new Map([...abas, entradaData].map(elemento => [elemento.id, elemento]));
const document = {
    addEventListener: () => {},
    getElementById: id => elementos.get(id) || null,
    querySelectorAll: seletor => {
        if (seletor === ".tabcontent") return abas;
        if (seletor === ".tablink" || seletor === ".tablink[data-tab-target]") return botoes;
        return [];
    },
    querySelector: seletor => {
        if (seletor === ".container") return recipiente;
        if (seletor === ".tablink.active[data-tab-target]") return botoes.find(botao => botao.classList.contains("active")) || null;
        const nomeAba = seletor.match(/^\.tablink\[data-tab-target="(Tab\d)"\]$/)?.[1];
        return botoes.find(botao => botao.dataset.tabTarget === nomeAba) || null;
    },
};
const renders = { station: [], room: [], livingRoom: [], aquarium: [] };
const aqis = [];
const frames = new Map();
const listeners = new Map();
let proximoFrame = 0;
let contextoRelatorio;
const window = {
    AppConfig: {
        colors: {}, comfortBand: {},
        firebasePaths: { room: "room", solar: "solar", aquarium: "aquarium", livingRoom: "livingRoom" },
        ids: { tables: {}, chartContainers: {} },
    },
    ClimateData: {
        dataAtual: () => "22-10-2026",
        convertFirebaseDateToInput: valor => valor,
        convertInputDateToFirebase: valor => valor,
    },
    ClimateCharts: { createDefaults: () => ({}) },
    FirebaseService: {
        initializeDatabase: async () => {},
        trackLoadStart: () => {}, trackLoadEnd: () => {},
        listenToPath: (path, callback) => { listeners.set(path, callback); return () => listeners.delete(path); },
    },
    ClimateAqi: { update: dados => aqis.push(dados) },
    ClimateAssets: { executarQuandoOcioso: () => {} },
    ClimateSeason: { update: () => {} }, ClimateMoon: { update: () => {} },
    ClimateZoom: { setup: () => {} }, ClimateChat: { setup: () => {} },
    ClimatePdfReport: { setup: opcoes => { contextoRelatorio = opcoes.getContext; } },
    PublicWeatherView: { ocultar: () => {} },
    EstacaoView: {
        render: ({ latestData, selectedDate }) => renders.station.push({ latestData: { ...latestData }, selectedDate }),
        obterDadosExternosAtuais: () => ({ origem: "externa" }),
    },
    QuartoView: { render: ({ data, selectedDate }) => renders.room.push({ data, selectedDate }) },
    SalaView: { render: ({ data, selectedDate }) => renders.livingRoom.push({ data, selectedDate }) },
    AquarioView: { render: ({ data, selectedDate }) => renders.aquarium.push({ data, selectedDate }) },
    getComputedStyle: () => ({ overflowX: "visible" }),
};
for (const nome of [
    "ClimateDataQuality", "ClimateAnalytics", "ClimateInsightsAmbientais", "ClimateSolar",
    "ClimateAqi", "ClimateSeason", "ClimateMoon", "ClimateZoom", "ClimateAssets",
    "ClimatePdfReport", "ClimateChat", "ClimateAuthService", "BrowserLocationService",
    "ExternalWeatherService", "PublicWeatherView", "QuartoView", "AquarioView", "SalaView",
    "SolarView", "EstacaoView",
]) window[nome] ||= {};

const contexto = vm.createContext({
    window, document, Element: Elemento,
    localStorage: { getItem: () => "Tab0", setItem: () => {} },
    requestAnimationFrame: callback => { frames.set(++proximoFrame, callback); return proximoFrame; },
    cancelAnimationFrame: id => frames.delete(id),
});
vm.runInContext(readFileSync(new URL("../scripts/ui/ui.js", import.meta.url), "utf8"), contexto);
vm.runInContext(readFileSync(new URL("../scripts/main.js", import.meta.url), "utf8"), contexto);
vm.runInContext("inicializarDashboardInterno()", contexto);
await vm.runInContext("configurarEscutasFirebase()", contexto);
assert.equal(renders.station.length, 1, "A aba inicial deve renderizar uma vez");

for (const [path, leitura] of [["room", 1], ["solar", 2], ["aquarium", 3], ["livingRoom", 4]]) {
    listeners.get(path)({ leitura });
}
assert.deepEqual([renders.room.length, renders.livingRoom.length, renders.aquarium.length], [0, 0, 0],
    "Três renders de abas inativas foram evitados na primeira carga");
assert.equal(aqis.at(-1).leitura, 4, "AQI do cabeçalho deve acompanhar Sala inativa");
assert.equal(frames.size, 1);
const [frameId, frame] = frames.entries().next().value;
frames.delete(frameId);
frame();
assert.equal(renders.station.length, 2);

botoes[2].eventos.get("click")();
assert.equal(renders.room.at(-1).data.leitura, 1, "Primeira abertura do Quarto usa o dado em cache");
listeners.get("room")({ leitura: 5 });
assert.equal(renders.room.at(-1).data.leitura, 5, "Aba ativa recebe a leitura nova");
assert.equal(frames.size, 0, "Estação fechada não deve renderizar");
listeners.get("livingRoom")({ leitura: 6 });
assert.equal(renders.livingRoom.length, 0);
assert.equal(aqis.at(-1).leitura, 6);

botoes[2].eventos.get("keydown")({ key: "ArrowLeft", currentTarget: botoes[2], preventDefault: () => {} });
assert.equal(renders.livingRoom.at(-1).data.leitura, 6, "Teclado abre Sala com o último dado");
entradaData.value = "21-10-2026";
entradaData.eventos.get("change")();
assert.equal(renders.livingRoom.at(-1).selectedDate, "21-10-2026");
assert.equal(renders.station.length, 2, "Mudança de data não renderiza Estação fechada");

recipiente.eventos.get("touchstart")({ touches: [{ clientX: 150, clientY: 10 }], target: recipiente });
recipiente.eventos.get("touchend")({ changedTouches: [{ clientX: 20, clientY: 10 }] });
assert.equal(window.ClimateUI.getActiveTabName(), "Tab2");
assert.equal(renders.room.at(-1).data.leitura, 5, "Swipe reabre Quarto com dado atualizado");
botoes[3].eventos.get("click")();
assert.equal(renders.aquarium.at(-1).data.leitura, 3, "Primeira abertura do Aquário usa o cache");

const relatorio = contextoRelatorio();
assert.equal(relatorio.latestData.livingRoom.leitura, 6, "Exportação inclui dados da aba fechada");
assert.equal(relatorio.selectedDate, "21-10-2026");
assert.equal(relatorio.dadosClimaExterno.origem, "externa");
botoes[0].eventos.get("click")();
assert.equal(renders.station.at(-1).latestData.livingRoom.leitura, 6);

console.log("Abas inativas: três renders evitados na primeira carga; clique, teclado, swipe, data e exportação aprovados.");
