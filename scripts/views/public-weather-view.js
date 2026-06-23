'use strict';

(function () {
    const CORES_AQI = [
        { min: 0, max: 50, texto: "Boa", classe: "good" },
        { min: 51, max: 100, texto: "Moderado", classe: "moderate" },
        { min: 101, max: 150, texto: "Sensível", classe: "sensitive" },
        { min: 151, max: 200, texto: "Insalubre", classe: "unhealthy" },
        { min: 201, max: 300, texto: "Muito insalubre", classe: "very-unhealthy" },
        { min: 301, max: 500, texto: "Perigoso", classe: "hazardous" },
    ];

    const graficos = {};
    let elementos = {};
    let callbacks = {};

    function setup({ onLogin, onLogout, getUsuario, isOwner } = {}) {
        elementos = obterElementos();
        callbacks = { onLogin, onLogout };
        if (!elementos.publicApp) return;

        elementos.btnEntrar?.addEventListener("click", () => onLogin?.());
        elementos.btnSair?.addEventListener("click", () => onLogout?.());
        elementos.formCep?.addEventListener("submit", async evento => {
            evento.preventDefault();
            await buscarPorCep();
        });
        elementos.btnLocalizacao?.addEventListener("click", buscarPorLocalizacao);

        atualizarUsuario(getUsuario?.(), isOwner?.());
        renderizarEstadoInicial();
    }

    function atualizarUsuario(usuario, usuarioInterno) {
        if (!elementos.publicUserStatus) return;

        if (!usuario) {
            elementos.publicUserStatus.innerHTML = `
                <span>Modo público</span>
                <button type="button" id="publicLoginButton">Entrar com Google</button>
            `;
            elementos.btnEntrar = document.getElementById("publicLoginButton");
            elementos.btnEntrar?.addEventListener("click", () => callbacks.onLogin?.());
            return;
        }

        elementos.publicUserStatus.innerHTML = `
            <span>${usuarioInterno ? "Acesso interno" : "Modo público"} · ${usuario.email || "usuário Google"}</span>
            <button type="button" id="publicLogoutButton">Sair</button>
        `;
        elementos.btnSair = document.getElementById("publicLogoutButton");
        elementos.btnSair?.addEventListener("click", () => callbacks.onLogout?.());
    }

    function mostrar() {
        elementos.publicApp?.removeAttribute("hidden");
        elementos.privateApp?.setAttribute("hidden", "");
        elementos.chat?.setAttribute("hidden", "");
        elementos.chat?.classList.add("is-disabled");
        window.ClimateAqi?.updateExternal?.(null);
        publicarEventosSolares(null);
    }

    function ocultar() {
        elementos.publicApp?.setAttribute("hidden", "");
        elementos.privateApp?.removeAttribute("hidden");
        elementos.chat?.removeAttribute("hidden");
        elementos.chat?.classList.remove("is-disabled");
    }

    async function buscarPorCep() {
        const cep = elementos.cepInput?.value;
        await executarBusca(() => window.ExternalWeatherService.buscarPorCep(cep));
    }

    async function buscarPorLocalizacao() {
        await executarBusca(async () => {
            const localizacao = await window.BrowserLocationService.obterLocalizacaoAtual();
            return window.ExternalWeatherService.buscarPorCoordenadas({
                latitude: localizacao.latitude,
                longitude: localizacao.longitude,
                origem: {
                    tipo: "localizacao",
                    rotulo: "Localização atual",
                    precisao: localizacao.precisao,
                },
            });
        });
    }

    async function executarBusca(busca) {
        renderizarMensagem("Consultando clima da localização...", "loading");
        try {
            const dados = await busca();
            await renderizarDados(dados);
        } catch (erro) {
            window.ClimateDiagnostics?.erro("Falha na consulta pública.", erro);
            renderizarMensagem(erro.message || "Não foi possível carregar os dados públicos.", "error");
        }
    }

    function renderizarEstadoInicial() {
        renderizarMensagem("Informe um CEP ou permita a localização para ver clima, AQI, ciclo solar, estação do ano e fase da lua.", "empty");
        renderizarContextoAstronomico(null);
    }

    function renderizarMensagem(mensagem, tipo = "empty") {
        if (!elementos.publicResults) return;
        elementos.publicResults.innerHTML = `<p class="state-message state-message--${tipo}">${mensagem}</p>`;
        limparGraficos();
        publicarEventosSolares(null);
    }

    async function renderizarDados(dados) {
        await window.ClimateAssets.carregarChart();
        window.ClimateCharts.registerComfortBand();

        elementos.publicResults.innerHTML = `
            <div class="public-location">
                <span>${dados.origem.rotulo}</span>
                <strong>Atualizado ${formatarDataHora(dados.atualizadoEm)}</strong>
            </div>
            <div class="stats-grid public-stats-grid">
                ${card("Temperatura", dados.climaAtual.temperatura, "°C")}
                ${card("Sensação", dados.climaAtual.sensacaoTermica, "°C")}
                ${card("Umidade", dados.climaAtual.umidade, "%")}
                ${card("Pressão", dados.climaAtual.pressao, "hPa")}
                ${cardAqi(dados.aqi.valor)}
            </div>
            <div class="station-context-row">
                <section class="season-timeline public-season" id="publicSeasonTimeline"></section>
                <section class="moon-summary public-moon" id="publicMoonSummary"></section>
            </div>
            <div class="charts-grid">
                ${canvasCard("publicChartTemperature", "Temperatura", "Temperatura externa")}
                ${canvasCard("publicChartFeelsLike", "Sensação Térmica", "Sensação térmica externa")}
                ${canvasCard("publicChartHumidity", "Umidade", "Umidade externa")}
                ${canvasCard("publicChartPressure", "Pressão", "Pressão externa")}
            </div>
            <div class="chart-card chart-card--wide" id="public-solar-container">
                <span class="chart-label">Ciclo Solar do Dia</span>
                <canvas aria-label="Ciclo solar público" class="plot plot--solar-day" id="publicChartSolar" role="img"></canvas>
            </div>
        `;

        renderizarContextoAstronomico(dados);
        window.ClimateAqi?.updateExternal?.({
            valor: dados.aqi.valor,
            origem: dados.origem.rotulo,
            atualizadoEm: dados.atualizadoEm,
        });
        publicarEventosSolares(dados);
        const seriesUltimas24h = filtrarSeriesUltimas24h(dados.seriesHorarias, dados.atualizadoEm);
        renderizarGraficoLinha("publicChartTemperature", seriesUltimas24h.horarios, seriesUltimas24h.temperatura, "Temperatura", "°C", window.AppConfig.colors.blue);
        renderizarGraficoLinha("publicChartFeelsLike", seriesUltimas24h.horarios, seriesUltimas24h.sensacaoTermica, "Sensação térmica", "°C", window.AppConfig.colors.green);
        renderizarGraficoLinha("publicChartHumidity", seriesUltimas24h.horarios, seriesUltimas24h.umidade, "Umidade", "%", window.AppConfig.colors.purple);
        renderizarGraficoLinha("publicChartPressure", seriesUltimas24h.horarios, seriesUltimas24h.pressao, "Pressão", "hPa", window.AppConfig.colors.amber);
        renderizarGraficoSolar(dados.cicloSolar);
    }

    function renderizarContextoAstronomico(dados) {
        const dataAtual = dataFirebasePublica(dados);
        const estadoEstacao = window.ClimateSeason?.getState?.();
        const estadoLua = window.ClimateMoon?.getState?.(dataAtual);

        const estacao = document.getElementById("publicSeasonTimeline");
        if (estacao && estadoEstacao) {
            estacao.innerHTML = `
                <div class="season-timeline__track" aria-label="Progresso anual das estações">
                    ${estadoEstacao.estacoes.map(item => `
                        <span class="season-timeline__segment season-timeline__segment--${item.chave}">
                            <i>${item.nome}</i>
                        </span>
                    `).join("")}
                    <span class="season-timeline__marker" style="left: ${estadoEstacao.progressoAno}%"></span>
                </div>
            `;
        }

        const lua = document.getElementById("publicMoonSummary");
        if (lua && estadoLua) {
            lua.innerHTML = `
                <div class="moon-summary__scene moon-summary__scene--${estadoLua.fase.chave}" style="--moon-shadow: ${estadoLua.sombra}%">
                    <span class="moon-summary__orb" aria-hidden="true"></span>
                </div>
                <div class="moon-summary__content">
                    <span>${estadoLua.fase.nome}</span>
                    <strong>${estadoLua.iluminacao}% iluminada</strong>
                </div>
                <dl class="moon-summary__details">
                    <div><dt>Idade</dt><dd>${estadoLua.idade.toFixed(1)} dias</dd></div>
                    <div><dt>Próx. cheia</dt><dd>${formatarDataCompleta(estadoLua.proximaCheia)}</dd></div>
                    <div><dt>Próx. nova</dt><dd>${formatarDataCompleta(estadoLua.proximaNova)}</dd></div>
                </dl>
            `;
        }
    }

    function renderizarGraficoLinha(id, horarios, valores, label, unidade, cor) {
        const canvas = document.getElementById(id);
        if (!canvas) return;
        if (graficos[id]) graficos[id].destroy();

        const pontos = (valores || []).map((valor, indice) => ({ horario: horarios[indice], valor }))
            .filter(ponto => ponto.valor !== null);

        if (!pontos.length) return;

        const ctx = canvas.getContext("2d");
        graficos[id] = new Chart(ctx, {
            type: "line",
            data: {
                labels: pontos.map(ponto => formatarHoraIso(ponto.horario)),
                datasets: [{
                    label,
                    data: pontos.map(ponto => ponto.valor),
                    borderColor: cor,
                    backgroundColor: `${cor}22`,
                    fill: true,
                    tension: 0.35,
                    pointRadius: 0,
                    pointHitRadius: 18,
                }],
            },
            options: window.ClimateCharts.mergeDeep(window.ClimateCharts.createDefaults(window.AppConfig.colors), {
                plugins: {
                    tooltip: {
                        callbacks: {
                            label: contexto => `${label}: ${Number(contexto.parsed.y).toFixed(2)}${unidade}`,
                        },
                    },
                },
                scales: {
                    y: {
                        title: { display: true, text: unidade, color: window.AppConfig.colors.text },
                    },
                },
            }),
        });
    }

    function filtrarSeriesUltimas24h(series, atualizadoEm) {
        const fim = atualizadoEm instanceof Date && !Number.isNaN(atualizadoEm.getTime()) ? atualizadoEm : new Date();
        const inicio = new Date(fim.getTime() - 24 * 60 * 60 * 1000);
        const resultado = {
            horarios: [],
            temperatura: [],
            sensacaoTermica: [],
            umidade: [],
            pressao: [],
        };

        (series?.horarios || []).forEach((horario, indice) => {
            const dataHora = new Date(horario);
            if (Number.isNaN(dataHora.getTime()) || dataHora < inicio || dataHora > fim) return;

            resultado.horarios.push(horario);
            resultado.temperatura.push(series.temperatura?.[indice] ?? null);
            resultado.sensacaoTermica.push(series.sensacaoTermica?.[indice] ?? null);
            resultado.umidade.push(series.umidade?.[indice] ?? null);
            resultado.pressao.push(series.pressao?.[indice] ?? null);
        });

        return resultado;
    }

    function renderizarGraficoSolar(eventos) {
        const canvas = document.getElementById("publicChartSolar");
        if (!canvas || !eventos) return;
        if (graficos.publicChartSolar) graficos.publicChartSolar.destroy();

        const pontosLuz = [
            { x: 0, y: 0 },
            { x: eventos.dawn, y: 0.08, label: "Amanhecer", timeLabel: window.ClimateData.formatTime(eventos.dawn) },
            { x: eventos.sunrise, y: 0.52, label: "Nascer do sol", timeLabel: window.ClimateData.formatTime(eventos.sunrise) },
            { x: eventos.zenith, y: 1, label: "Zênite", timeLabel: window.ClimateData.formatTime(eventos.zenith) },
            { x: eventos.sunset, y: 0.52, label: "Pôr do sol", timeLabel: window.ClimateData.formatTime(eventos.sunset) },
            { x: eventos.dusk, y: 0.08, label: "Anoitecer", timeLabel: window.ClimateData.formatTime(eventos.dusk) },
            { x: 24, y: 0 },
        ];

        const ctx = canvas.getContext("2d");
        graficos.publicChartSolar = new Chart(ctx, {
            type: "line",
            data: {
                datasets: [
                    {
                        label: "Luz do dia",
                        data: pontosLuz,
                        borderColor: "#facc15",
                        backgroundColor: "rgba(250, 204, 21, 0.22)",
                        fill: true,
                        tension: 0.42,
                        pointRadius: 0,
                        pointHitRadius: 18,
                    },
                    {
                        type: "scatter",
                        label: "Eventos solares",
                        data: pontosLuz.slice(1, 6),
                        backgroundColor: ["#fde68a", "#fb923c", "#facc15", "#f87171", "#818cf8"],
                        pointBorderColor: "#0b1120",
                        pointBorderWidth: 2,
                        pointRadius: 5,
                        pointHitRadius: 18,
                    },
                ],
            },
            options: window.ClimateSolar.getSolarTodayOptions({
                defaults: window.ClimateCharts.createDefaults(window.AppConfig.colors),
                colors: window.AppConfig.colors,
            }),
            plugins: [window.ClimateSolar.solarDayBackgroundPlugin],
        });
        graficos.publicChartSolar.$solarDayTimes = eventos;
    }

    function card(titulo, valor, unidade) {
        const texto = Number.isFinite(valor) ? `${valor.toFixed(2)}${unidade}` : "--";
        return `
            <article class="stats-card public-card">
                <span class="stats-card__label">${titulo}</span>
                <strong class="stats-card__value">${texto}</strong>
                <span class="public-card__meta">Dado externo</span>
            </article>
        `;
    }

    function cardAqi(valor) {
        const categoria = classificarAqi(valor);
        return `
            <article class="stats-card public-card public-card--aqi">
                <span class="stats-card__label">AQI externo</span>
                <strong class="stats-card__value">${Number.isFinite(valor) ? Math.round(valor) : "--"}</strong>
                <span class="stats-card__trend stats-card__trend--stable">${categoria.texto}</span>
            </article>
        `;
    }

    function canvasCard(id, titulo, ariaLabel) {
        return `
            <div class="chart-card" id="${id}-container">
                <span class="chart-label">${titulo}</span>
                <canvas aria-label="${ariaLabel}" class="plot" id="${id}" role="img"></canvas>
            </div>
        `;
    }

    function classificarAqi(valor) {
        if (!Number.isFinite(valor)) return { texto: "--", classe: "unknown" };
        return CORES_AQI.find(categoria => valor >= categoria.min && valor <= categoria.max) || CORES_AQI[CORES_AQI.length - 1];
    }

    function publicarEventosSolares(dados) {
        window.dispatchEvent(new CustomEvent("public-solar-events-updated", {
            detail: {
                events: dados?.cicloSolar || null,
                origem: dados?.origem?.rotulo || null,
            }
        }));
    }

    function limparGraficos() {
        Object.values(graficos).forEach(grafico => grafico?.destroy?.());
        Object.keys(graficos).forEach(chave => delete graficos[chave]);
    }

    function obterElementos() {
        return {
            publicApp: document.getElementById("publicApp"),
            privateApp: document.getElementById("privateApp"),
            chat: document.getElementById("aiChat"),
            publicResults: document.getElementById("publicResults"),
            formCep: document.getElementById("publicCepForm"),
            cepInput: document.getElementById("publicCepInput"),
            btnLocalizacao: document.getElementById("publicLocationButton"),
            publicUserStatus: document.getElementById("publicUserStatus"),
            btnEntrar: document.getElementById("publicLoginButton"),
            btnSair: document.getElementById("publicLogoutButton"),
        };
    }

    function formatarHoraIso(valor) {
        if (!valor) return "--";
        const data = new Date(valor);
        if (Number.isNaN(data.getTime())) return "--";
        return `${String(data.getHours()).padStart(2, "0")}:${String(data.getMinutes()).padStart(2, "0")}`;
    }

    function formatarDataHora(data) {
        if (!(data instanceof Date) || Number.isNaN(data.getTime())) return "--";
        return `${String(data.getDate()).padStart(2, "0")}/${String(data.getMonth() + 1).padStart(2, "0")} ${String(data.getHours()).padStart(2, "0")}:${String(data.getMinutes()).padStart(2, "0")}`;
    }

    function formatarDataCompleta(data) {
        if (!(data instanceof Date) || Number.isNaN(data.getTime())) return "--";
        return `${String(data.getDate()).padStart(2, "0")}/${String(data.getMonth() + 1).padStart(2, "0")}/${data.getFullYear()}`;
    }

    function dataFirebasePublica(dados) {
        const data = dados?.atualizadoEm instanceof Date ? dados.atualizadoEm : null;
        if (!data || Number.isNaN(data.getTime())) {
            return window.ClimateData?.dataAtual?.();
        }
        return `${String(data.getDate()).padStart(2, "0")}-${String(data.getMonth() + 1).padStart(2, "0")}-${data.getFullYear()}`;
    }

    window.PublicWeatherView = {
        setup,
        mostrar,
        ocultar,
        atualizarUsuario,
    };
})();
