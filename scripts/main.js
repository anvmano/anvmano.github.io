'use strict';

const AppConfig = window.AppConfig;
const ClimateData = window.ClimateData;
const ClimateDataQuality = window.ClimateDataQuality;
const ClimateAnalytics = window.ClimateAnalytics;
const ClimateInsightsAmbientais = window.ClimateInsightsAmbientais;
const ClimateSolar = window.ClimateSolar;
const ClimateCharts = window.ClimateCharts;
const ClimateAqi = window.ClimateAqi;
const ClimateSeason = window.ClimateSeason;
const ClimateMoon = window.ClimateMoon;
const FirebaseService = window.FirebaseService;
const ClimateUI = window.ClimateUI;
const ClimateZoom = window.ClimateZoom;
const ClimateAssets = window.ClimateAssets;
const ClimatePdfReport = window.ClimatePdfReport;
const ClimateChat = window.ClimateChat;
const ClimateAuthService = window.ClimateAuthService;
const BrowserLocationService = window.BrowserLocationService;
const ExternalWeatherService = window.ExternalWeatherService;
const PublicWeatherView = window.PublicWeatherView;
const QuartoView = window.QuartoView;
const AquarioView = window.AquarioView;
const SalaView = window.SalaView;
const SolarView = window.SolarView;
const EstacaoView = window.EstacaoView;

if (
    !AppConfig ||
    !ClimateData ||
    !ClimateDataQuality ||
    !ClimateAnalytics ||
    !ClimateInsightsAmbientais ||
    !ClimateSolar ||
    !ClimateCharts ||
    !ClimateAqi ||
    !ClimateSeason ||
    !ClimateMoon ||
    !FirebaseService ||
    !ClimateUI ||
    !ClimateZoom ||
    !ClimateAssets ||
    !ClimatePdfReport ||
    !ClimateChat ||
    !ClimateAuthService ||
    !BrowserLocationService ||
    !ExternalWeatherService ||
    !PublicWeatherView ||
    !QuartoView ||
    !AquarioView ||
    !SalaView ||
    !SolarView ||
    !EstacaoView
) {
    throw new Error("Módulos auxiliares não foram carregados na ordem correta.");
}

const instanciasGraficos = {};
const dadosMaisRecentes = {
    room: null,
    solar: null,
    aquarium: null,
    livingRoom: null,
};

const CORES = AppConfig.colors;
const FAIXA_CONFORTO = AppConfig.comfortBand;
const PADROES_GRAFICOS = ClimateCharts.createDefaults(CORES);
const CAMINHOS_FIREBASE = AppConfig.firebasePaths;
const IDS = AppConfig.ids;

let dataSelecionada = ClimateData.dataAtual();
let temporizadorIndicadorAstronomico = null;
let ultimoEstadoAstronomico = null;
let carregamentoChart = null;
let dashboardInternoInicializado = false;
let modoPublicoAtivo = false;
let eventosSolaresPublicos = null;
let firebaseProgressivoAgendado = false;
let canceladoresFirebase = [];

if (window.Chart) ClimateCharts.registerComfortBand();

function obterDataSelecionada() {
    return dataSelecionada;
}

function definirDataSelecionada(dataReferencia) {
    dataSelecionada = dataReferencia;
    ClimateSeason.update();
    ClimateMoon.update();
}

function criarGrafico({
    canvasCtx: contextoCanvas,
    containerId: idRecipiente,
    data: dados,
    key: chave,
    label: rotulo,
    color: cor,
    yAxisTitle: tituloEixoY,
    yAxisSuffix: sufixoEixoY = "",
    comfortBand: faixaConforto = FAIXA_CONFORTO,
    grupoSincronizacao,
    emptyMessage: mensagemVazia = "Sem dados para esta data."
}) {
    const id = contextoCanvas.canvas.id;
    if (!window.Chart) {
        if (idRecipiente) ClimateUI.renderChartMessage(idRecipiente, "Carregando gráfico...", "loading");
        carregarChartParaGraficos();
        return instanciasGraficos[id] || null;
    }

    const grafico = ClimateCharts.createLineChart({
        canvasCtx: contextoCanvas,
        data: dados,
        key: chave,
        label: rotulo,
        color: cor,
        yAxisTitle: tituloEixoY,
        yAxisSuffix: sufixoEixoY,
        existingChart: instanciasGraficos[id],
        defaults: PADROES_GRAFICOS,
        colors: CORES,
        comfortBand: faixaConforto,
        grupoSincronizacao,
        onEmpty: () => {
            delete instanciasGraficos[id];
            if (idRecipiente) ClimateUI.renderChartMessage(idRecipiente, mensagemVazia);
        },
        onReady: () => {
            if (idRecipiente) ClimateUI.clearChartMessage(idRecipiente);
        }
    });
    if (grafico) instanciasGraficos[id] = grafico;
    return instanciasGraficos[id];
}

function carregarChartParaGraficos() {
    if (window.Chart) return Promise.resolve(window.Chart);
    if (!carregamentoChart) {
        carregamentoChart = ClimateAssets.carregarChart()
            .then(grafico => {
                ClimateCharts.registerComfortBand();
                renderizarPainelDaDataSelecionada();
                return grafico;
            })
            .catch(erro => {
                window.ClimateDiagnostics?.erro("Falha ao carregar Chart.js.", erro);
                mostrarFalhaGraficos();
                throw erro;
            });
    }
    return carregamentoChart;
}

function mostrarFalhaGraficos() {
    Object.values(IDS.chartContainers).forEach(idRecipiente => {
        ClimateUI.renderChartMessage(idRecipiente, "Não foi possível carregar os gráficos.", "error");
    });
}

function obterOpcoesAmpliacao(idOrigem) {
    if (idOrigem === IDS.charts.sunHistory) {
        return ClimateSolar.getSunHistoryOptions({
            legend: true,
            tickSize: 12,
            labelSize: 12,
            defaults: PADROES_GRAFICOS,
            colors: CORES
        });
    }

    if (idOrigem === IDS.charts.solarToday) {
        return ClimateSolar.getSolarTodayOptions({
            tickSize: 12,
            labelSize: 12,
            defaults: PADROES_GRAFICOS,
            colors: CORES
        });
    }

    if (idOrigem === IDS.charts.rain) {
        return window.ClimateChuva.obterOpcoes({ cores: CORES });
    }

    return ClimateCharts.mergeDeep(PADROES_GRAFICOS, {
        animation: false,
        plugins: {
            tooltip: {
                callbacks: {
                    label: contexto => {
                        const valor = contexto.parsed.y;
                        const formatado = Number.isFinite(valor) ? valor.toFixed(2) : "--";
                        return `${contexto.dataset.label || ""}: ${formatado}`;
                    }
                }
            }
        },
        scales: {
            x: {
                ticks: { font: { size: 12 } }
            },
            y: {
                ticks: { font: { size: 12 } }
            }
        }
    });
}

function renderizarDadosQuarto(dados) {
    QuartoView.render({
        data: dados,
        selectedDate: dataSelecionada,
        createChart: criarGrafico,
        colors: CORES,
        ui: ClimateUI
    });
}

function renderizarDadosEstacao() {
    EstacaoView.render({
        latestData: dadosMaisRecentes,
        selectedDate: dataSelecionada,
        chartInstances: instanciasGraficos,
        defaults: PADROES_GRAFICOS,
        colors: CORES,
        ensureChart: carregarChartParaGraficos,
        ui: ClimateUI
    });
}

function renderizarDadosAquario(dados) {
    AquarioView.render({
        data: dados,
        selectedDate: dataSelecionada,
        createChart: criarGrafico,
        colors: CORES,
        ui: ClimateUI
    });
}

function renderizarDadosSala(dados) {
    ClimateAqi.update(dados);
    SalaView.render({
        data: dados,
        selectedDate: dataSelecionada,
        createChart: criarGrafico,
        colors: CORES,
        ui: ClimateUI
    });
}

function renderizarPainelDaDataSelecionada() {
    renderizarDadosEstacao();
    if (dadosMaisRecentes.room) renderizarDadosQuarto(dadosMaisRecentes.room);
    if (dadosMaisRecentes.aquarium) renderizarDadosAquario(dadosMaisRecentes.aquarium);
    if (dadosMaisRecentes.livingRoom) renderizarDadosSala(dadosMaisRecentes.livingRoom);
}

function obterValorHoraAtual(agora = new Date()) {
    return agora.getHours() + (agora.getMinutes() / 60) + (agora.getSeconds() / 3600);
}

function obterEventosSolaresHoje() {
    if (modoPublicoAtivo) return eventosSolaresPublicos?.events || null;
    if (!dadosMaisRecentes.solar) return null;
    return ClimateSolar.getSolarEventsForSelectedDate(dadosMaisRecentes.solar, ClimateData.dataAtual());
}

function obterEventosSolaresPadrao() {
    return {
        dawn: 5.5,
        sunrise: 6,
        zenith: 12,
        sunset: 18,
        dusk: 18.5
    };
}

function formatarHoraAstronomica(valor) {
    if (!Number.isFinite(valor)) return "--";
    const totalMinutosSolar = Math.round(valor * 60);
    const hora = Math.floor(totalMinutosSolar / 60) % 24;
    const minuto = totalMinutosSolar % 60;
    return `${String(hora).padStart(2, "0")}:${String(minuto).padStart(2, "0")}`;
}

function obterDescricaoAstronomica(estado) {
    if (!estado?.events) return "Informe CEP ou permita a localização para consultar o ciclo solar.";
    return `Nascer do sol: ${formatarHoraAstronomica(estado.events.sunrise)} · Pôr do sol: ${formatarHoraAstronomica(estado.events.sunset)}`;
}

function obterRotuloModoAstronomico(modo) {
    if (modo === "day") return "Dia";
    if (modo === "twilight") return "Transição";
    if (modo === "unknown") return "Aguardando";
    return "Noite";
}

function formatarDuracaoAstronomica(inicio, fim) {
    if (!Number.isFinite(inicio) || !Number.isFinite(fim)) return "--";
    const totalMinutosSolar = Math.max(0, Math.round((fim - inicio) * 60));
    const horas = Math.floor(totalMinutosSolar / 60);
    const minutos = totalMinutosSolar % 60;
    return `${horas}h${String(minutos).padStart(2, "0")}`;
}

function obterEstadoAstronomico(agora = new Date()) {
    const eventosSolares = obterEventosSolaresHoje();
    if (modoPublicoAtivo && !eventosSolares) {
        return {
            mode: "unknown",
            progress: 0.5,
            x: "50%",
            y: "3px",
            events: null,
            source: "aguardando localização",
            origem: null,
        };
    }

    const eventos = eventosSolares || obterEventosSolaresPadrao();
    const hora = obterValorHoraAtual(agora);
    const ehCrepusculo = (hora >= eventos.dawn && hora < eventos.sunrise) || (hora > eventos.sunset && hora <= eventos.dusk);
    const ehDia = hora >= eventos.sunrise && hora <= eventos.sunset;
    const ehCaminhoSolar = hora >= eventos.dawn && hora <= eventos.dusk;
    const modo = ehCrepusculo ? "twilight" : ehDia ? "day" : "night";
    const inicioIntervalo = ehCaminhoSolar ? eventos.dawn : eventos.dusk;
    const fimIntervalo = ehCaminhoSolar ? eventos.dusk : eventos.sunrise + 24;
    const horaAjustada = !ehCaminhoSolar && hora < eventos.sunrise ? hora + 24 : hora;
    const progresso = Math.min(1, Math.max(0, (horaAjustada - inicioIntervalo) / (fimIntervalo - inicioIntervalo || 1)));
    const y = 3 + Math.sin(progresso * Math.PI) * 12;

    return {
        mode: modo,
        progress: progresso,
        x: `${(progresso * 100).toFixed(1)}%`,
        y: `${y.toFixed(1)}px`,
        events: eventos,
        source: eventosSolares ? (modoPublicoAtivo ? "dados solares públicos" : "dados solares") : "fallback 06:00-18:00",
        origem: modoPublicoAtivo ? eventosSolaresPublicos?.origem : null,
    };
}

function atualizarIndicadorAstronomico() {
    const indicador = document.getElementById("astroIndicator");
    if (!indicador) return;

    const estado = obterEstadoAstronomico();
    ultimoEstadoAstronomico = estado;
    const elementoRotulo = indicador.querySelector(".astro-indicator__label");

    indicador.classList.remove("astro-indicator--day", "astro-indicator--twilight", "astro-indicator--night", "astro-indicator--unknown");
    indicador.classList.add(`astro-indicator--${estado.mode}`);
    indicador.style.setProperty("--astro-progress", estado.progress.toFixed(3));
    const trilha = indicador.querySelector(".astro-indicator__track");
    if (trilha) trilha.style.setProperty("--astro-x", estado.x);
    indicador.style.setProperty("--astro-y", estado.y);
    if (elementoRotulo) elementoRotulo.textContent = "";
    indicador.title = obterDescricaoAstronomica(estado);
    indicador.setAttribute("aria-label", indicador.title);
    atualizarDetalhesAstronomicos(estado);
}

function configurarIndicadorAstronomico() {
    const indicador = document.getElementById("astroIndicator");
    const janelaDetalhes = document.getElementById("astroPopover");

    if (indicador && janelaDetalhes) {
        indicador.setAttribute("role", "button");
        indicador.setAttribute("tabindex", "0");
        indicador.setAttribute("aria-controls", "astroPopover");
        indicador.setAttribute("aria-expanded", "false");
        indicador.addEventListener("click", evento => {
            evento.stopPropagation();
            alternarDetalhesAstronomicos();
        });
        indicador.addEventListener("keydown", evento => {
            if (evento.key !== "Enter" && evento.key !== " ") return;
            evento.preventDefault();
            alternarDetalhesAstronomicos();
        });
        document.addEventListener("click", evento => {
            if (janelaDetalhes.hidden) return;
            if (janelaDetalhes.contains(evento.target) || indicador.contains(evento.target)) return;
            fecharDetalhesAstronomicos();
        });
        document.addEventListener("keydown", evento => {
            if (evento.key === "Escape") fecharDetalhesAstronomicos();
        });
        window.addEventListener("header-popover-open", evento => {
            if (evento.detail?.source !== "astro") fecharDetalhesAstronomicos();
        });
    }

    atualizarIndicadorAstronomico();
    if (temporizadorIndicadorAstronomico) clearInterval(temporizadorIndicadorAstronomico);
    temporizadorIndicadorAstronomico = setInterval(atualizarIndicadorAstronomico, 60000);
}

function alternarDetalhesAstronomicos() {
    const indicador = document.getElementById("astroIndicator");
    const janelaDetalhes = document.getElementById("astroPopover");
    if (!indicador || !janelaDetalhes) return;

    if (janelaDetalhes.hidden) {
        window.dispatchEvent(new CustomEvent("header-popover-open", { detail: { source: "astro" } }));
        atualizarDetalhesAstronomicos(ultimoEstadoAstronomico || obterEstadoAstronomico());
        janelaDetalhes.hidden = false;
        indicador.setAttribute("aria-expanded", "true");
    } else {
        fecharDetalhesAstronomicos();
    }
}

function fecharDetalhesAstronomicos() {
    const indicador = document.getElementById("astroIndicator");
    const janelaDetalhes = document.getElementById("astroPopover");
    if (!indicador || !janelaDetalhes) return;

    janelaDetalhes.hidden = true;
    indicador.setAttribute("aria-expanded", "false");
}

function atualizarDetalhesAstronomicos(estado) {
    const janelaDetalhes = document.getElementById("astroPopover");
    if (!janelaDetalhes || !estado) return;

    const valorCabecalho = janelaDetalhes.querySelector(".astro-popover__header strong");
    const lista = janelaDetalhes.querySelector(".astro-popover__list");
    if (!valorCabecalho || !lista) return;

    valorCabecalho.textContent = obterRotuloModoAstronomico(estado.mode);
    if (!estado.events) {
        lista.innerHTML = `
            <div><dt>Status</dt><dd>Informe CEP ou localização</dd></div>
            <div><dt>Origem</dt><dd>Modo público</dd></div>
        `;
        return;
    }

    const origem = estado.origem ? [["Origem", estado.origem]] : [];
    lista.innerHTML = [
        ...origem,
        ["Amanhecer", formatarHoraAstronomica(estado.events.dawn)],
        ["Nascer do sol", formatarHoraAstronomica(estado.events.sunrise)],
        ["Zênite", formatarHoraAstronomica(estado.events.zenith)],
        ["Pôr do sol", formatarHoraAstronomica(estado.events.sunset)],
        ["Anoitecer", formatarHoraAstronomica(estado.events.dusk)],
        ["Duração do dia", formatarDuracaoAstronomica(estado.events.sunrise, estado.events.sunset)],
    ].map(([rotulo, valor]) => `<div><dt>${rotulo}</dt><dd>${valor}</dd></div>`).join("");
}

function configurarCicloSolarPublico() {
    window.addEventListener("public-solar-events-updated", evento => {
        const detalhe = evento.detail || {};
        eventosSolaresPublicos = detalhe.events ? {
            events: detalhe.events,
            origem: detalhe.origem || null,
        } : null;
        atualizarIndicadorAstronomico();
    });
}

async function configurarEscutasFirebase() {
    if (canceladoresFirebase.length) return;

    FirebaseService.trackLoadStart();
    try {
        await FirebaseService.initializeDatabase();
    } finally {
        FirebaseService.trackLoadEnd();
    }

    registrarListenerFirebase(FirebaseService.listenToPath(CAMINHOS_FIREBASE.room, dados => {
        dadosMaisRecentes.room = dados;
        if (!dados) {
            ClimateUI.renderEmptyState(IDS.tables.room, "Sem dados de temperatura.");
            renderizarDadosEstacao();
            return;
        }
        renderizarDadosQuarto(dados);
        renderizarDadosEstacao();
    }, () => ClimateUI.renderEmptyState(IDS.tables.room, "Falha ao carregar dados de temperatura.", "error")));

    registrarListenerFirebase(FirebaseService.listenToPath(CAMINHOS_FIREBASE.solar, dados => {
        dadosMaisRecentes.solar = dados;
        if (!dados) {
            const dataFormatada = dataSelecionada.replace(/-/g, "/");
            ClimateUI.renderChartMessage(IDS.chartContainers.sunHistory, `Sem dados de nascer e pôr do sol em ${dataFormatada}.`);
            ClimateUI.renderChartMessage(IDS.chartContainers.solarToday, `Sem dados de ciclo solar em ${dataFormatada}.`);
            renderizarDadosEstacao();
            atualizarIndicadorAstronomico();
            return;
        }
        renderizarDadosEstacao();
        atualizarIndicadorAstronomico();
    }, () => {
        ClimateUI.renderChartMessage(IDS.chartContainers.sunHistory, "Falha ao carregar dados solares.", "error");
        ClimateUI.renderChartMessage(IDS.chartContainers.solarToday, "Falha ao carregar ciclo solar.", "error");
        renderizarDadosEstacao();
        atualizarIndicadorAstronomico();
    }));

    registrarListenerFirebase(FirebaseService.listenToPath(CAMINHOS_FIREBASE.aquarium, dados => {
        dadosMaisRecentes.aquarium = dados;
        if (!dados) {
            ClimateUI.renderEmptyState(IDS.tables.aquarium, "Sem dados do aquário.");
            renderizarDadosEstacao();
            return;
        }
        renderizarDadosAquario(dados);
        renderizarDadosEstacao();
    }, () => ClimateUI.renderEmptyState(IDS.tables.aquarium, "Falha ao carregar dados do aquário.", "error")));

    registrarListenerFirebase(FirebaseService.listenToPath(CAMINHOS_FIREBASE.livingRoom, dados => {
        dadosMaisRecentes.livingRoom = dados;
        if (!dados) {
            ClimateAqi.update(null);
            ClimateUI.renderEmptyState(IDS.tables.livingRoom, "Sem dados da sala.");
            renderizarDadosEstacao();
            return;
        }
        renderizarDadosSala(dados);
        renderizarDadosEstacao();
    }, () => ClimateUI.renderEmptyState(IDS.tables.livingRoom, "Falha ao carregar dados da sala.", "error")));
}

function iniciarFirebaseProgressivo() {
    if (firebaseProgressivoAgendado || canceladoresFirebase.length) return;
    firebaseProgressivoAgendado = true;
    ClimateAssets.executarQuandoOcioso(() => {
        firebaseProgressivoAgendado = false;
        if (modoPublicoAtivo) return;
        configurarEscutasFirebase().catch(erro => {
            FirebaseService.handleError("Firebase", erro);
            FirebaseService.setLoading(false);
            ClimateUI.renderStartupError();
        });
    }, 350);
}

function registrarListenerFirebase(cancelador) {
    if (typeof cancelador === "function") canceladoresFirebase.push(cancelador);
}

function pararFirebaseInterno() {
    canceladoresFirebase.forEach(cancelador => {
        try {
            cancelador();
        } catch (erro) {
            window.ClimateDiagnostics?.depurar("Falha ao cancelar listener Firebase.", erro);
        }
    });
    canceladoresFirebase = [];
    Object.keys(dadosMaisRecentes).forEach(chave => {
        dadosMaisRecentes[chave] = null;
    });
    ClimateAqi.update(null);
}

function reagirAberturaColapsavel() {
    document.addEventListener("climate-collapsible-expanded", evento => {
        const secao = evento.detail?.section;
        if (!secao?.querySelector?.(".calendar-heatmap, .hourly-heatmap, .weekly-heatmap")) return;
        renderizarPainelDaDataSelecionada();
    });
}

function inicializarDashboardInterno() {
    modoPublicoAtivo = false;
    eventosSolaresPublicos = null;
    atualizarIndicadorAstronomico();
    if (dashboardInternoInicializado) {
        PublicWeatherView.ocultar();
        iniciarFirebaseProgressivo();
        return;
    }

    dashboardInternoInicializado = true;
    PublicWeatherView.ocultar();
    ClimateUI.setupTabs("Tab0");
    ClimateUI.setupTabSwipe({
        tabOrder: ["Tab0", "Tab1", "Tab2", "Tab3"]
    });
    ClimateUI.setupDateControls({
        getSelectedDate: obterDataSelecionada,
        setSelectedDate: definirDataSelecionada,
        getTodayDate: ClimateData.dataAtual,
        onDateChange: renderizarPainelDaDataSelecionada
    });
    ClimateUI.setupCollapsibleSections();
    reagirAberturaColapsavel();
    ClimateZoom.setup({ chartInstances: instanciasGraficos, getZoomOptions: obterOpcoesAmpliacao });
    ClimatePdfReport.setup({
        buttonId: "btnExportData",
        formatName: "exportFormat",
        getContext: () => ({
            activeTab: ClimateUI.getActiveTabName(),
            selectedDate: dataSelecionada,
            latestData: dadosMaisRecentes,
            chartInstances: instanciasGraficos,
            dadosClimaExterno: EstacaoView.obterDadosExternosAtuais?.() || null,
        })
    });
    ClimateChat.setup({
        getContext: () => ({
            activeTab: ClimateUI.getActiveTabName(),
            selectedDate: dataSelecionada,
            latestData: dadosMaisRecentes,
        })
    });
    renderizarDadosEstacao();

    ClimateAssets.executarQuandoOcioso(() => {
        if (modoPublicoAtivo) return;
        ClimateAssets.carregarCssZoom()
            .catch(erro => window.ClimateDiagnostics?.depurar("Falha ao carregar CSS de zoom.", erro));
    }, 1200);

    iniciarFirebaseProgressivo();
}

function inicializarModoPublico(usuario, usuarioInterno) {
    modoPublicoAtivo = true;
    eventosSolaresPublicos = null;
    pararFirebaseInterno();
    PublicWeatherView.atualizarUsuario(usuario, usuarioInterno);
    PublicWeatherView.mostrar();
    atualizarIndicadorAstronomico();
}

function configurarAutenticacaoPublica() {
    configurarLogoutHeader();

    PublicWeatherView.setup({
        getUsuario: () => ClimateAuthService.obterUsuarioAtual(),
        isOwner: () => ClimateAuthService.ehUsuarioInterno(),
        onLogin: async () => {
            try {
                await ClimateAuthService.entrarComGoogle();
            } catch (erro) {
                window.ClimateDiagnostics?.erro("Falha no login com Google.", erro);
                window.alert(obterMensagemErroLogin(erro));
            }
        },
        onLogout: async () => {
            try {
                await ClimateAuthService.sair();
            } catch (erro) {
                window.ClimateDiagnostics?.erro("Falha ao sair.", erro);
            }
        },
    });

    ClimateAuthService.observarEstado(usuario => {
        const usuarioInterno = ClimateAuthService.ehUsuarioInterno(usuario);
        atualizarLogoutHeader(usuarioInterno);
        if (usuarioInterno) {
            inicializarDashboardInterno();
            return;
        }

        inicializarModoPublico(usuario, usuarioInterno);
    }).catch(erro => {
        window.ClimateDiagnostics?.erro("Falha ao inicializar autenticação.", erro);
        inicializarModoPublico(null, false);
    });
}

function configurarLogoutHeader() {
    const botaoSair = document.getElementById("authLogoutButton");
    if (!botaoSair) return;

    botaoSair.addEventListener("click", async () => {
        try {
            await ClimateAuthService.sair();
        } catch (erro) {
            window.ClimateDiagnostics?.erro("Falha ao sair.", erro);
            window.alert("Não foi possível sair agora.");
        }
    });
}

function atualizarLogoutHeader(usuarioInterno) {
    const botaoSair = document.getElementById("authLogoutButton");
    if (!botaoSair) return;

    if (usuarioInterno) {
        botaoSair.removeAttribute("hidden");
        return;
    }

    botaoSair.setAttribute("hidden", "");
}

function obterMensagemErroLogin(erro) {
    const codigo = erro?.code || "";
    if (codigo === "auth/unauthorized-domain") {
        return "Domínio não autorizado no Firebase Auth. Adicione anvmano.github.io em Authentication > Configurações > Domínios autorizados.";
    }
    if (codigo === "auth/popup-blocked") {
        return "O navegador bloqueou a janela de login. Permita pop-ups para este site e tente novamente.";
    }
    if (codigo === "auth/popup-closed-by-user" || codigo === "auth/cancelled-popup-request") {
        return "Login com Google cancelado antes de concluir.";
    }
    if (codigo === "auth/operation-not-allowed") {
        return "Login com Google não está habilitado no Firebase Authentication.";
    }
    return "Não foi possível entrar com Google agora. Verifique as configurações do Firebase Auth.";
}

document.addEventListener("DOMContentLoaded", () => {
    ClimateUI.setupMobileHeader();
    ClimateAqi.setup();
    ClimateSeason.setup();
    ClimateMoon.setup();
    configurarIndicadorAstronomico();
    configurarCicloSolarPublico();
    configurarAutenticacaoPublica();
});
