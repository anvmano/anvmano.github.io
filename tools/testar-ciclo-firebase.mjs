import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";

let resolverInicializacao;
const inicializacao = new Promise(resolve => { resolverInicializacao = resolve; });
const listeners = new Map();
const frames = new Map();
const renders = [];
const aviso = { hidden: true, textContent: "" };
let proximoFrame = 0;
let cancelamentos = 0;

const window = {
    AppConfig: {
        colors: {}, comfortBand: {},
        firebasePaths: { room: "room", solar: "solar", aquarium: "aquarium", livingRoom: "livingRoom" },
        ids: { tables: {}, chartContainers: {} },
    },
    ClimateData: { dataAtual: () => "22-10-2026" },
    ClimateCharts: { createDefaults: () => ({}) },
    FirebaseService: {
        initializeDatabase: () => inicializacao,
        trackLoadStart: () => {}, trackLoadEnd: () => {},
        listenToPath: (path, callback, onError) => {
            assert.equal(listeners.has(path), false, `Listener duplicado: ${path}`);
            listeners.set(path, { callback, onError });
            return () => { listeners.delete(path); cancelamentos++; };
        },
    },
    EstacaoView: { render: ({ latestData }) => renders.push({ ...latestData }) },
    QuartoView: { render: () => {} }, AquarioView: { render: () => {} }, SalaView: { render: () => {} },
    ClimateAqi: { update: () => {} },
    ClimateUI: { getActiveTabName: () => "Tab0", renderEmptyState: () => {} }, PublicWeatherView: { atualizarUsuario: () => {}, mostrar: () => {} },
};
for (const nome of [
    "ClimateDataQuality", "ClimateAnalytics", "ClimateInsightsAmbientais", "ClimateSolar",
    "ClimateAqi", "ClimateSeason", "ClimateMoon", "ClimateUI", "ClimateZoom",
    "ClimateAssets", "ClimatePdfReport", "ClimateChat", "ClimateAuthService",
    "BrowserLocationService", "ExternalWeatherService", "PublicWeatherView",
    "QuartoView", "AquarioView", "SalaView", "SolarView", "EstacaoView",
]) window[nome] ||= {};

const contexto = vm.createContext({
    window,
    document: { addEventListener: () => {}, getElementById: id => id === "sensorConnectionAlert" ? aviso : null },
    requestAnimationFrame: callback => { frames.set(++proximoFrame, callback); return proximoFrame; },
    cancelAnimationFrame: id => { frames.delete(id); },
});
vm.runInContext(readFileSync(new URL("../scripts/main.js", import.meta.url), "utf8"), contexto);

const primeira = vm.runInContext("configurarEscutasFirebase()", contexto);
vm.runInContext("inicializarModoPublico(null, false)", contexto);
vm.runInContext("modoPublicoAtivo = false", contexto);
const segunda = vm.runInContext("configurarEscutasFirebase()", contexto);
resolverInicializacao();
await Promise.all([primeira, segunda]);
assert.equal(listeners.size, 4, "Só a sessão interna atual deve registrar os quatro caminhos");
await vm.runInContext("configurarEscutasFirebase()", contexto);
assert.equal(listeners.size, 4, "Inicialização repetida não pode duplicar listeners");

listeners.get("room").callback({ leitura: 1 });
listeners.get("solar").callback({ leitura: 2 });
listeners.get("aquarium").callback({ leitura: 3 });
listeners.get("livingRoom").callback({ leitura: 4 });
assert.equal(frames.size, 1, "As quatro leituras devem agendar um único render");
assert.equal(renders.length, 0);
const [id, frame] = frames.entries().next().value;
frames.delete(id);
frame();
assert.equal(renders.length, 1);
assert.deepEqual(Object.keys(renders[0]).map(chave => renders[0][chave]?.leitura), [1, 2, 3, 4]);

listeners.get("room").onError(new Error("Falha simulada"));
assert.equal(aviso.hidden, false, "Falha precisa aparecer junto aos resumos");
assert.match(aviso.textContent, /Quarto.*desatualizadas/);
listeners.get("room").callback({ leitura: 5 });
assert.equal(aviso.hidden, true, "Leitura recuperada remove o alerta");
vm.runInContext("inicializarModoPublico(null, false)", contexto);
assert.equal(listeners.size, 0);
assert.equal(cancelamentos, 4);
assert.equal(frames.size, 0, "Logout deve cancelar render agendado");
assert.equal(renders.length, 1, "Nenhum dado interno deve renderizar após logout");

vm.runInContext("modoPublicoAtivo = false", contexto);
await vm.runInContext("configurarEscutasFirebase()", contexto);
assert.equal(listeners.size, 4, "Relogin deve restaurar os quatro listeners");
listeners.get("room").callback({ leitura: 6 });
const [idRelogin, frameRelogin] = frames.entries().next().value;
frames.delete(idRelogin);
frameRelogin();
assert.equal(renders.at(-1).room.leitura, 6, "Relogin deve exibir leitura nova");

console.log("Ciclo Firebase e agrupamento de render aprovados.");
