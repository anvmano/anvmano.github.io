import verificar from "node:assert/strict";
import arquivos from "node:fs";
import caminho from "node:path";
import maquinaVirtual from "node:vm";

const raiz = process.cwd();
const visualizacao = arquivos.readFileSync(caminho.join(raiz, "scripts/views/public-weather-view.js"), "utf8");
const servico = arquivos.readFileSync(caminho.join(raiz, "scripts/external/external-weather-service.js"), "utf8");
const zoom = arquivos.readFileSync(caminho.join(raiz, "scripts/charts/zoom.js"), "utf8");
const carregador = arquivos.readFileSync(caminho.join(raiz, "scripts/runtime-loader.js"), "utf8");
const html = arquivos.readFileSync(caminho.join(raiz, "index.html"), "utf8");

verificar.match(visualizacao, /const idBusca = \+\+sequenciaBusca/);
verificar.match(visualizacao, /if \(idBusca !== sequenciaBusca\) return/);
verificar.match(visualizacao, /definirEstadoBusca\(true\)/);
verificar.match(visualizacao, /definirEstadoBusca\(false\)/);
verificar.match(visualizacao, /setAttribute\("aria-busy", String\(carregando\)\)/);
verificar.match(visualizacao, /ClimateAqi\?\.updateExternal\?\.\(null\)/);
verificar.match(visualizacao, /ClimateZoom\?\.registrarCards/);
verificar.match(visualizacao, /aria-invalid/);
verificar.match(visualizacao, /function aplicarMascaraCep/);
verificar.match(visualizacao, /function alterarModoBusca/);
verificar.match(visualizacao, /function renderizarOpcoesCidades/);
verificar.match(visualizacao, /ExternalWeatherService\.pesquisarCidades/);
verificar.match(visualizacao, /ExternalWeatherService\.buscarPorCidade/);
verificar.match(visualizacao, /sessionStorage\.setItem/);
verificar.match(visualizacao, /\["latitude", "longitude", "precisao", "cep"\]/);
verificar.match(visualizacao, /desatualizado/);
verificar.match(visualizacao, /function montarJanelaObservadaEPrevista/);
verificar.match(visualizacao, /HORAS_PREVISAO_GRAFICOS = 12/);
verificar.match(visualizacao, /tipoDado: "medido"/);
verificar.match(visualizacao, /tipoDado: "previsao"/);
verificar.match(visualizacao, /borderDash: \[6, 4\]/);
verificar.match(visualizacao, /id: "marcadorAgoraPublico"/);
verificar.match(servico, /erro\.esperado = true/);
verificar.match(servico, /cep_invalido/);
verificar.match(servico, /cep_nao_encontrado/);
verificar.match(servico, /function pesquisarCidades/);
verificar.match(servico, /function buscarPorCidade/);
verificar.match(servico, /cidade_invalida/);
verificar.match(servico, /cidade_nao_encontrada/);
verificar.match(zoom, /registrarCards/);
verificar.match(zoom, /registrarFechamentoPorEscape\(\);\s*raiz\.querySelectorAll/);
verificar.match(zoom, /ClimateAssets\?\.carregarCssZoom/);
verificar.match(zoom, /borderDash: serieGrafico\.borderDash/);
verificar.match(zoom, /graficoOrigem\.\$zoomPlugins/);
verificar.match(zoom, /graficoOrigem\.\$marcadorAgora/);
verificar.match(carregador, /function carregarCssZoom\(\)/);
verificar.match(html, /id="publicSearchStatus"[^>]*role="status"[^>]*aria-live="polite"/);
verificar.match(html, /id="publicResults"[^>]*aria-busy="false"/);
verificar.match(html, /id="publicSearchModeCep"[^>]*aria-pressed="true"/);
verificar.match(html, /id="publicSearchModeCity"[^>]*aria-pressed="false"/);
verificar.match(html, /id="publicSearchInput"[^>]*inputmode="numeric"/);
verificar.match(html, /id="publicCityResults"[^>]*hidden/);

let respostaGeocodificacao = {
    results: [
        { id: 3, name: "Campinas Velha", admin1: "São Paulo", admin2: "Campinas", country: "Brasil", country_code: "BR", latitude: -22.91, longitude: -47.07, timezone: "America/Sao_Paulo" },
        { id: 1, name: "Campinas", admin1: "São Paulo", admin2: "Campinas", country: "Brasil", country_code: "BR", latitude: -22.90, longitude: -47.06, timezone: "America/Sao_Paulo" },
        { id: 2, name: "Campinas", admin1: "Santa Catarina", admin2: "São José", country: "Brasil", country_code: "BR", latitude: -27.01, longitude: -51.10, timezone: "America/Sao_Paulo" },
    ],
};
const chamadasGeocodificacao = [];
const contextoServico = {
    URL,
    AppConfig: {
        externalApis: {
            openMeteoGeocodingUrl: "https://geocoding-api.open-meteo.com/v1/search",
        },
    },
    fetch: async url => {
        chamadasGeocodificacao.push(String(url));
        return { ok: true, json: async () => respostaGeocodificacao };
    },
};
contextoServico.window = contextoServico;
maquinaVirtual.runInNewContext(servico, contextoServico);

const cidades = await contextoServico.ExternalWeatherService.pesquisarCidades("  Campinas, SP  ");
verificar.equal(cidades.length, 3);
verificar.equal(cidades[0].rotulo, "Campinas - São Paulo");
verificar.equal(cidades[1].rotulo, "Campinas (São José) - Santa Catarina");
verificar.equal(cidades[2].rotulo, "Campinas Velha (Campinas) - São Paulo");
const urlGeocodificacao = new URL(chamadasGeocodificacao.at(-1));
verificar.equal(urlGeocodificacao.searchParams.get("name"), "Campinas, SP");
verificar.equal(urlGeocodificacao.searchParams.get("count"), "10");
verificar.equal(urlGeocodificacao.searchParams.get("countryCode"), "BR");
verificar.equal(urlGeocodificacao.searchParams.get("language"), "pt");

await verificar.rejects(
    contextoServico.ExternalWeatherService.pesquisarCidades("A"),
    erro => erro.codigo === "cidade_invalida"
);
respostaGeocodificacao = { results: [] };
await verificar.rejects(
    contextoServico.ExternalWeatherService.pesquisarCidades("Cidade inexistente"),
    erro => erro.codigo === "cidade_nao_encontrada"
);

const contextoView = { window: {}, Date };
contextoView.window = contextoView;
maquinaVirtual.runInNewContext(visualizacao, contextoView);

const horarios = [];
const temperatura = [];
const inicioSerie = new Date("2026-08-15T16:00:00");
for (let indice = 0; indice < 38; indice += 1) {
    const horario = new Date(inicioSerie.getTime() + indice * 60 * 60 * 1000);
    horarios.push(`${horario.getFullYear()}-${String(horario.getMonth() + 1).padStart(2, "0")}-${String(horario.getDate()).padStart(2, "0")}T${String(horario.getHours()).padStart(2, "0")}:00`);
    temperatura.push(20 + indice / 10);
}

const janela = contextoView.PublicWeatherView.montarJanelaObservadaEPrevista({
    horarios,
    temperatura,
    sensacaoTermica: temperatura,
    umidade: temperatura,
    pressao: temperatura,
}, new Date("2026-08-16T16:00:00"));

verificar.equal(janela.tipos.filter(tipo => tipo === "medido").length, 25);
verificar.equal(janela.tipos.filter(tipo => tipo === "previsao").length, 12);
verificar.equal(janela.indiceAgora, 24);
verificar.equal(janela.horarios[janela.indiceAgora], "2026-08-16T16:00");
verificar.equal(janela.horarios[janela.indiceAgora + 1], "2026-08-16T17:00");
verificar.equal(janela.horarios.at(-1), "2026-08-17T04:00");

// Simula duas respostas em ordem invertida usando o mesmo contrato de sequência da view.
let sequencia = 0;
let resultadoRenderizado = null;
async function executarSimulado(promessa, valor) {
    const id = ++sequencia;
    await promessa;
    if (id !== sequencia) return;
    resultadoRenderizado = valor;
}
let liberarAntiga;
let liberarNova;
const antiga = new Promise(resolver => { liberarAntiga = resolver; });
const nova = new Promise(resolver => { liberarNova = resolver; });
const primeira = executarSimulado(antiga, "antiga");
const segunda = executarSimulado(nova, "nova");
liberarNova();
await segunda;
liberarAntiga();
await primeira;
verificar.equal(resultadoRenderizado, "nova");

console.log("Testes de estado, concorrência e acessibilidade do modo público concluídos com sucesso.");
