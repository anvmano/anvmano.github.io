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
    const HORAS_PREVISAO_GRAFICOS = 12;
    const marcadorAgoraPlugin = {
        id: "marcadorAgoraPublico",
        afterDraw(grafico) {
            const marcador = grafico.$marcadorAgora;
            const escalaX = grafico.scales?.x;
            const area = grafico.chartArea;
            if (!marcador || !escalaX || !area || marcador.indice < 0) return;

            const x = escalaX.getPixelForValue(marcador.indice);
            if (!Number.isFinite(x) || x < area.left || x > area.right) return;

            const contexto = grafico.ctx;
            contexto.save();
            contexto.strokeStyle = "rgba(148, 163, 184, 0.65)";
            contexto.lineWidth = 1;
            contexto.setLineDash([4, 4]);
            contexto.beginPath();
            contexto.moveTo(x, area.top);
            contexto.lineTo(x, area.bottom);
            contexto.stroke();

            contexto.setLineDash([]);
            contexto.font = "600 10px sans-serif";
            contexto.textAlign = "center";
            contexto.textBaseline = "top";
            const larguraTexto = contexto.measureText("Agora").width;
            const centroSeguro = Math.min(Math.max(x, area.left + larguraTexto / 2 + 7), area.right - larguraTexto / 2 - 7);
            contexto.fillStyle = "rgba(15, 23, 42, 0.88)";
            contexto.fillRect(centroSeguro - larguraTexto / 2 - 5, area.top + 4, larguraTexto + 10, 17);
            contexto.fillStyle = "#cbd5e1";
            contexto.fillText("Agora", centroSeguro, area.top + 7);
            contexto.restore();
        },
    };
    let elementos = {};
    let callbacks = {};
    let sequenciaBusca = 0;
    let consultaRestaurada = false;

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
        elementos.cepInput?.addEventListener("input", evento => {
            aplicarMascaraCep(evento.currentTarget);
            limparErroCep();
        });

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
        if (!consultaRestaurada) {
            consultaRestaurada = true;
            restaurarUltimaConsulta().catch(erro => {
                window.ClimateDiagnostics?.depurar("Não foi possível restaurar a última consulta pública.", erro);
            });
        }
    }

    function ocultar() {
        elementos.publicApp?.setAttribute("hidden", "");
        elementos.privateApp?.removeAttribute("hidden");
        elementos.chat?.removeAttribute("hidden");
        elementos.chat?.classList.remove("is-disabled");
    }

    async function buscarPorCep() {
        const cep = elementos.cepInput?.value;
        await executarBusca(() => window.ExternalWeatherService.buscarPorCep(cep), { origemCep: true });
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

    async function executarBusca(busca, { origemCep = false } = {}) {
        const idBusca = ++sequenciaBusca;
        definirEstadoBusca(true);
        limparErroCep();
        renderizarMensagem("Consultando clima da localização...", "loading");
        try {
            const dados = await busca();
            if (idBusca !== sequenciaBusca) return;
            const renderizada = await renderizarDados(dados, idBusca);
            if (!renderizada) return;
            preservarUltimaConsulta(dados);
            anunciarEstado(`Dados climáticos carregados para ${dados.origem?.rotulo || "a localização"}.`, "status");
        } catch (erro) {
            if (idBusca !== sequenciaBusca) return;
            if (erro?.esperado) {
                window.ClimateDiagnostics?.depurar("Validação da consulta pública.", erro);
            } else {
                window.ClimateDiagnostics?.erro("Falha técnica na consulta pública.", erro);
            }
            if (origemCep && erro?.esperado) marcarErroCep(erro.message);
            renderizarMensagem(erro.message || "Não foi possível carregar os dados públicos.", "error");
        } finally {
            if (idBusca === sequenciaBusca) definirEstadoBusca(false);
        }
    }

    function renderizarEstadoInicial() {
        renderizarMensagem("Informe um CEP ou permita a localização para ver clima, AQI, ciclo solar, estação do ano e fase da lua.", "empty");
        renderizarContextoAstronomico(null);
    }

    function renderizarMensagem(mensagem, tipo = "empty") {
        if (!elementos.publicResults) return;
        limparContextoConsultaPublica();
        // A live region oculta anuncia o estado; a mensagem visível evita duplicar role=alert.
        elementos.publicResults.innerHTML = `<p class="state-message state-message--${tipo}">${mensagem}</p>`;
        anunciarEstado(mensagem, tipo === "error" ? "alert" : "status");
    }

    async function renderizarDados(dados, idBusca = sequenciaBusca) {
        await window.ClimateAssets.carregarChart();
        if (idBusca !== sequenciaBusca) return false;
        window.ClimateCharts.registerComfortBand();
        const insights = analisarDadosPublicos(dados);
        const atualidade = calcularAtualidade(dados.atualizadoEm);

        elementos.publicResults.innerHTML = `
            <div class="public-location ${atualidade.desatualizado ? "is-stale" : ""}">
                <span>${dados.origem.rotulo}</span>
                <strong>Atualizado ${formatarDataHora(dados.atualizadoEm)} · ${atualidade.rotulo}</strong>
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
            ${montarSecaoInsightsPublicos(insights)}
            <div class="charts-grid">
                ${canvasCard("publicChartTemperature", "Temperatura", "Temperatura externa")}
                ${canvasCard("publicChartFeelsLike", "Sensação Térmica", "Sensação térmica externa")}
                ${canvasCard("publicChartHumidity", "Umidade", "Umidade externa")}
                ${canvasCard("publicChartPressure", "Pressão", "Pressão externa")}
            </div>
            <div class="chart-card chart-card--wide" id="public-solar-container">
                <span class="chart-label">Ciclo Solar do Dia</span>
                <span class="chart-card__meta-chip" id="publicSolarDuration" hidden></span>
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
        const janelaGraficos = montarJanelaObservadaEPrevista(dados.seriesHorarias, dados.atualizadoEm);
        renderizarGraficoLinha("publicChartTemperature", janelaGraficos, "temperatura", "Temperatura", "°C", window.AppConfig.colors.blue);
        renderizarGraficoLinha("publicChartFeelsLike", janelaGraficos, "sensacaoTermica", "Sensação térmica", "°C", window.AppConfig.colors.green);
        renderizarGraficoLinha("publicChartHumidity", janelaGraficos, "umidade", "Umidade", "%", window.AppConfig.colors.purple);
        renderizarGraficoLinha("publicChartPressure", janelaGraficos, "pressao", "Pressão", "hPa", window.AppConfig.colors.amber);
        renderizarGraficoSolar(dados.cicloSolar);
        window.ClimateZoom?.registrarCards?.(elementos.publicResults, {
            chartInstances: graficos,
            getZoomOptions: obterOpcoesZoomPublico,
        });
        return true;
    }

    function analisarDadosPublicos(dados) {
        const chuva = window.ClimateInsightsAmbientais.resumirChuva(
            dados.previsaoCurtoPrazo,
            dados.atualizadoEm,
            6
        );
        const indiceUv = window.ClimateInsightsAmbientais.analisarIndiceUv(
            dados.climaAtual.indiceUv,
            dados.previsaoDiaria.indiceUvMaximo
        );
        const riscoMofo = window.ClimateInsightsAmbientais.avaliarRiscoMofo({
            temperatura: dados.climaAtual.temperatura,
            umidade: dados.climaAtual.umidade,
            pontoOrvalho: dados.climaAtual.pontoOrvalho,
        });
        const ventilacao = window.ClimateInsightsAmbientais.recomendarVentilacaoExterna({
            climaAtual: dados.climaAtual,
            aqi: dados.aqi,
            chuva,
        });

        return { chuva, indiceUv, riscoMofo, ventilacao };
    }

    function montarSecaoInsightsPublicos({ chuva, indiceUv, riscoMofo, ventilacao }) {
        const pontoOrvalho = riscoMofo.pontoOrvalho;
        const valorOrvalho = Number.isFinite(pontoOrvalho) ? `${pontoOrvalho.toFixed(1)}°C` : "--";
        const valorChuva = chuva.classe === "indisponivel" ? "--" : `${Math.round(chuva.probabilidade)}%`;
        const valorUv = Number.isFinite(indiceUv.valor) ? indiceUv.valor.toFixed(1) : "--";

        return `
            <section class="environment-insights" aria-label="Condições e recomendações da localização">
                <div class="environment-insights__grid">
                    ${montarCardInsight({
                        titulo: "Ventilação",
                        valor: ventilacao.rotulo,
                        status: "Agora",
                        classe: ventilacao.classe,
                        descricao: ventilacao.descricao,
                        detalhe: "Baseado em clima, chuva e AQI externos",
                    })}
                    ${montarCardInsight({
                        titulo: "Chuva · próximas 6h",
                        valor: valorChuva,
                        status: chuva.rotulo,
                        classe: chuva.classe,
                        descricao: chuva.descricao,
                        detalhe: chuva.classe === "indisponivel" ? "Sem previsão horária" : `${chuva.acumulado.toFixed(1)} mm acumulados · pico ${chuva.intensidadeMaxima.toFixed(1)} mm/h`,
                    })}
                    ${montarCardInsight({
                        titulo: "Índice UV",
                        valor: valorUv,
                        status: indiceUv.rotulo,
                        classe: indiceUv.classe,
                        descricao: indiceUv.descricao,
                        detalhe: Number.isFinite(indiceUv.maximo) ? `Máxima do dia: ${indiceUv.maximo.toFixed(1)}` : "Valor atual",
                    })}
                    ${montarCardInsight({
                        titulo: "Ponto de orvalho",
                        valor: valorOrvalho,
                        status: riscoMofo.rotulo,
                        classe: riscoMofo.classe,
                        descricao: riscoMofo.descricao,
                        detalhe: "Risco estimado de condensação e mofo",
                    })}
                </div>
            </section>
        `;
    }

    function montarCardInsight({ titulo, valor, status, classe, descricao, detalhe }) {
        return `
            <article class="environment-insight environment-insight--${classe}">
                <div class="environment-insight__header">
                    <span>${titulo}</span>
                    <small>${status}</small>
                </div>
                <strong>${valor}</strong>
                <p>${descricao}</p>
                <span class="environment-insight__detail">${detalhe}</span>
            </article>
        `;
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

    function renderizarGraficoLinha(id, janela, chaveMetrica, label, unidade, cor) {
        const canvas = document.getElementById(id);
        if (!canvas) return;
        if (graficos[id]) graficos[id].destroy();

        const valores = janela?.[chaveMetrica] || [];
        const valoresMedidos = valores.map((valor, indice) => janela.tipos[indice] === "medido" ? valor : null);
        const valoresPrevistos = valores.map((valor, indice) => janela.tipos[indice] === "previsao" ? valor : null);
        const valorTransicao = valoresMedidos[janela.indiceAgora];
        if (janela.indiceAgora >= 0 && numeroValido(valorTransicao) !== null && valoresPrevistos.some(valor => numeroValido(valor) !== null)) {
            valoresPrevistos[janela.indiceAgora] = valorTransicao;
        }

        const temMedicao = valoresMedidos.some(valor => numeroValido(valor) !== null);
        const temPrevisao = valoresPrevistos.some((valor, indice) => indice > janela.indiceAgora && numeroValido(valor) !== null);
        if (!temMedicao && !temPrevisao) return;

        const ctx = canvas.getContext("2d");
        const corPrevisao = corComTransparencia(cor, 0.58);
        const datasets = [];
        if (temMedicao) {
            datasets.push({
                label: "Medido",
                tipoDado: "medido",
                data: valoresMedidos,
                borderColor: cor,
                backgroundColor: `${cor}22`,
                fill: true,
                tension: 0.35,
                pointRadius: 0,
                pointHitRadius: 18,
                spanGaps: false,
            });
        }
        if (temPrevisao) {
            datasets.push({
                label: "Previsão",
                tipoDado: "previsao",
                data: valoresPrevistos,
                borderColor: corPrevisao,
                backgroundColor: corComTransparencia(cor, 0.05),
                borderDash: [6, 4],
                fill: false,
                tension: 0.35,
                pointRadius: 0,
                pointHitRadius: 18,
                spanGaps: false,
            });
        }

        const opcoes = criarOpcoesGraficoPublico({ janela, unidade });
        const grafico = new Chart(ctx, {
            type: "line",
            data: {
                labels: janela.horarios.map(formatarHoraIso),
                datasets,
            },
            options: opcoes,
            plugins: [marcadorAgoraPlugin],
        });
        grafico.$marcadorAgora = { indice: janela.indiceAgora };
        grafico.$zoomPlugins = [marcadorAgoraPlugin];
        grafico.update("none");
        graficos[id] = grafico;
    }

    function criarOpcoesGraficoPublico({ janela, unidade }) {
        const limiteTicks = window.matchMedia?.("(max-width: 600px)")?.matches ? 7 : 13;
        return window.ClimateCharts.mergeDeep(window.ClimateCharts.createDefaults(window.AppConfig.colors), {
            plugins: {
                legend: {
                    display: true,
                    labels: {
                        color: window.AppConfig.colors.text,
                        boxWidth: 18,
                        boxHeight: 2,
                        padding: 12,
                    },
                },
                tooltip: {
                    filter: contexto => !(contexto.dataset.tipoDado === "previsao" && contexto.dataIndex <= janela.indiceAgora),
                    callbacks: {
                        title: itens => formatarDataHoraTooltip(janela.horarios[itens[0]?.dataIndex]),
                        label: contexto => `${contexto.dataset.label}: ${Number(contexto.parsed.y).toFixed(2)}${unidade}`,
                    },
                },
            },
            scales: {
                x: {
                    ticks: { maxTicksLimit: limiteTicks },
                },
                y: {
                    title: { display: true, text: unidade, color: window.AppConfig.colors.text },
                },
            },
        });
    }

    function montarJanelaObservadaEPrevista(series, atualizadoEm, horasPrevisao = HORAS_PREVISAO_GRAFICOS) {
        const fim = atualizadoEm instanceof Date && !Number.isNaN(atualizadoEm.getTime()) ? atualizadoEm : new Date();
        const inicio = new Date(fim.getTime() - 24 * 60 * 60 * 1000);
        const inicioPrevisao = new Date(fim);
        inicioPrevisao.setMinutes(0, 0, 0);
        inicioPrevisao.setHours(inicioPrevisao.getHours() + 1);
        const fimPrevisao = new Date(inicioPrevisao.getTime() + horasPrevisao * 60 * 60 * 1000);
        const resultado = {
            horarios: [],
            tipos: [],
            temperatura: [],
            sensacaoTermica: [],
            umidade: [],
            pressao: [],
            indiceAgora: -1,
        };

        (series?.horarios || []).forEach((horario, indice) => {
            const dataHora = new Date(horario);
            if (Number.isNaN(dataHora.getTime())) return;
            const eMedido = dataHora >= inicio && dataHora <= fim;
            const ePrevisao = dataHora >= inicioPrevisao && dataHora < fimPrevisao;
            if (!eMedido && !ePrevisao) return;

            resultado.horarios.push(horario);
            resultado.tipos.push(eMedido ? "medido" : "previsao");
            resultado.temperatura.push(series.temperatura?.[indice] ?? null);
            resultado.sensacaoTermica.push(series.sensacaoTermica?.[indice] ?? null);
            resultado.umidade.push(series.umidade?.[indice] ?? null);
            resultado.pressao.push(series.pressao?.[indice] ?? null);
            if (eMedido) resultado.indiceAgora = resultado.horarios.length - 1;
        });

        return resultado;
    }

    function numeroValido(valor) {
        if (valor === null || valor === undefined || valor === "") return null;
        const numero = Number(valor);
        return Number.isFinite(numero) ? numero : null;
    }

    function corComTransparencia(cor, alpha) {
        const hexadecimal = String(cor || "").replace("#", "");
        if (!/^[0-9a-f]{6}$/i.test(hexadecimal)) return cor;
        const vermelho = Number.parseInt(hexadecimal.slice(0, 2), 16);
        const verde = Number.parseInt(hexadecimal.slice(2, 4), 16);
        const azul = Number.parseInt(hexadecimal.slice(4, 6), 16);
        return `rgba(${vermelho}, ${verde}, ${azul}, ${alpha})`;
    }

    function formatarDataHoraTooltip(valor) {
        const data = new Date(valor);
        if (Number.isNaN(data.getTime())) return "--";
        const dia = String(data.getDate()).padStart(2, "0");
        const mes = String(data.getMonth() + 1).padStart(2, "0");
        const hora = String(data.getHours()).padStart(2, "0");
        const minuto = String(data.getMinutes()).padStart(2, "0");
        return `${dia}/${mes} ${hora}:${minuto}`;
    }

    function renderizarGraficoSolar(eventos) {
        const canvas = document.getElementById("publicChartSolar");
        atualizarChipDuracaoSolarPublica(eventos);
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
                        pointHitRadius: 0,
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

    function obterOpcoesZoomPublico(idGrafico) {
        const padroes = window.ClimateCharts.createDefaults(window.AppConfig.colors);
        if (idGrafico === "publicChartSolar") {
            return window.ClimateSolar.getSolarTodayOptions({
                defaults: padroes,
                colors: window.AppConfig.colors,
            });
        }

        const unidades = {
            publicChartTemperature: "°C",
            publicChartFeelsLike: "°C",
            publicChartHumidity: "%",
            publicChartPressure: "hPa",
        };
        const unidade = unidades[idGrafico] || "";
        return window.ClimateCharts.mergeDeep(padroes, {
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: true,
                    labels: {
                        color: window.AppConfig.colors.text,
                        boxWidth: 18,
                        boxHeight: 2,
                        padding: 12,
                    },
                },
                tooltip: {
                    filter: contexto => !(contexto.dataset.tipoDado === "previsao" && contexto.dataIndex <= contexto.chart.$marcadorAgora?.indice),
                    callbacks: {
                        label: contexto => `${contexto.dataset.label}: ${Number(contexto.parsed.y).toFixed(2)}${unidade}`,
                    },
                },
            },
            scales: {
                y: {
                    title: {
                        display: Boolean(unidade),
                        text: unidade,
                        color: window.AppConfig.colors.text,
                    },
                },
            },
        });
    }

    function atualizarChipDuracaoSolarPublica(eventos) {
        const chip = document.getElementById("publicSolarDuration");
        if (!chip) return;

        const duracao = window.ClimateSolar?.formatarDuracaoDia?.(eventos);
        chip.hidden = !duracao;
        chip.textContent = duracao ? `Duração do dia: ${duracao}` : "";
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

    function limparContextoConsultaPublica() {
        limparGraficos();
        window.ClimateAqi?.updateExternal?.(null);
        publicarEventosSolares(null);
        renderizarContextoAstronomico(null);
    }

    function definirEstadoBusca(carregando) {
        elementos.publicResults?.setAttribute("aria-busy", String(carregando));
        [elementos.btnBuscar, elementos.btnLocalizacao, elementos.cepInput].forEach(controle => {
            if (controle) controle.disabled = carregando;
        });
    }

    function anunciarEstado(mensagem, papel = "status") {
        if (!elementos.statusBusca) return;
        elementos.statusBusca.setAttribute("role", papel === "alert" ? "alert" : "status");
        elementos.statusBusca.textContent = mensagem || "";
    }

    function marcarErroCep(mensagem) {
        if (!elementos.cepInput) return;
        elementos.cepInput.setAttribute("aria-invalid", "true");
        elementos.cepInput.setAttribute("aria-describedby", "publicSearchStatus");
        anunciarEstado(mensagem, "alert");
    }

    function limparErroCep() {
        elementos.cepInput?.removeAttribute("aria-invalid");
        elementos.cepInput?.removeAttribute("aria-describedby");
    }

    function aplicarMascaraCep(input) {
        if (!input) return;
        const digitos = String(input.value || "").replace(/\D/g, "").slice(0, 8);
        input.value = digitos.length > 5 ? `${digitos.slice(0, 5)}-${digitos.slice(5)}` : digitos;
    }

    function preservarUltimaConsulta(dados) {
        const chave = window.AppConfig?.publicData?.sessionKey;
        if (!chave || !dados) return;
        try {
            const copia = {
                ...dados,
                origem: {
                    tipo: dados.origem?.tipo || "consulta",
                    rotulo: dados.origem?.rotulo || "Última consulta",
                },
            };
            sessionStorage.setItem(chave, JSON.stringify({
                salvoEm: new Date().toISOString(),
                dados: copia,
            }, (nome, valor) => ["latitude", "longitude", "precisao", "cep"].includes(nome) ? undefined : valor));
        } catch (erro) {
            window.ClimateDiagnostics?.depurar("Armazenamento da consulta pública indisponível.", erro);
        }
    }

    async function restaurarUltimaConsulta() {
        const chave = window.AppConfig?.publicData?.sessionKey;
        if (!chave) return;
        let salvo;
        try {
            salvo = JSON.parse(sessionStorage.getItem(chave) || "null");
        } catch {
            return;
        }
        if (!salvo?.dados || !salvo.salvoEm) return;
        const idadeMinutos = (Date.now() - new Date(salvo.salvoEm).getTime()) / 60000;
        const limite = Number(window.AppConfig?.publicData?.maxAgeMinutes) || 60;
        if (!Number.isFinite(idadeMinutos) || idadeMinutos > limite) {
            sessionStorage.removeItem(chave);
            return;
        }
        salvo.dados.atualizadoEm = new Date(salvo.dados.atualizadoEm);
        const renderizada = await renderizarDados(salvo.dados);
        if (renderizada) anunciarEstado("Última consulta desta sessão restaurada.", "status");
    }

    function calcularAtualidade(atualizadoEm) {
        const data = atualizadoEm instanceof Date ? atualizadoEm : new Date(atualizadoEm);
        const minutos = Number.isNaN(data.getTime()) ? Infinity : Math.max(0, Math.floor((Date.now() - data.getTime()) / 60000));
        const limite = Number(window.AppConfig?.publicData?.staleAfterMinutes) || 20;
        if (!Number.isFinite(minutos)) return { desatualizado: true, rotulo: "horário indisponível" };
        if (minutos < 1) return { desatualizado: false, rotulo: "agora" };
        return {
            desatualizado: minutos > limite,
            rotulo: minutos > limite ? `há ${minutos} min · desatualizado` : `há ${minutos} min`,
        };
    }

    function obterElementos() {
        return {
            publicApp: document.getElementById("publicApp"),
            privateApp: document.getElementById("privateApp"),
            chat: document.getElementById("aiChat"),
            publicResults: document.getElementById("publicResults"),
            formCep: document.getElementById("publicCepForm"),
            cepInput: document.getElementById("publicCepInput"),
            btnBuscar: document.getElementById("publicCepButton"),
            btnLocalizacao: document.getElementById("publicLocationButton"),
            statusBusca: document.getElementById("publicSearchStatus"),
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
        aplicarMascaraCep,
        calcularAtualidade,
        montarJanelaObservadaEPrevista,
    };
})();
