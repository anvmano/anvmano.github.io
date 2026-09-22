'use strict';

(function () {
    const modulos = window.ClimatePdfReportModules = window.ClimatePdfReportModules || {};

    const { config: configuracaoRelatorio, data: dados, dom: elementosDom, charts: graficos, pdf, format: formatacao } = modulos;
    const { TAB_CONFIG: CONFIGURACAO_ABAS } = configuracaoRelatorio;
    const { construirFonteDadosRelatorio, getPdfTableMetrics: obterMetricasTabelaPdf, buildCompactTableRows: montarLinhasTabelaCompacta, buildDailyAlerts: montarAlertasDiarios, buildSummaryCards: montarCardsResumo } = dados;
    const { createHeader: criarCabecalho, createSummarySection: criarSecaoResumo, createChartsSection: criarSecaoGraficos, createTableSection: criarSecaoTabela } = elementosDom;
    const { collectChartCards: coletarCardsGraficos } = graficos;
    const { generatePdf: gerarPdf } = pdf;
    const { formatFirebaseDate: formatarDataFirebaseRelatorio, slug: gerarIdentificadorUrl } = formatacao;

    let obterContextoModulo = null;
    let formatoSelecionado = "pdf";

    function configurarModulo({ buttonId: idBotao, formatName: nomeFormato = "exportFormat", getContext: obterContextoFornecido }) {
        obterContextoModulo = obterContextoFornecido;
        const botao = document.getElementById(idBotao);
        if (!botao) return;

        configurarControlesFormatoRelatorio(botao, nomeFormato);
        botao.addEventListener("click", () => exportarAbaAtual(botao));
    }

    async function exportarAbaAtual(botao) {
        const formatoExportacao = obterFormatoSelecionadoRelatorio();
        const textoOriginal = botao.innerText;
        botao.disabled = true;
        botao.innerText = formatoExportacao === "json" ? "Gerando JSON..." : "Gerando PDF...";

        const raizRenderizacao = document.createElement("div");
        raizRenderizacao.className = "pdf-render-root";

        try {
            const contexto = obterContextoModulo ? obterContextoModulo() : {};
            const relatorio = await montarRelatorio(contexto);

            if (formatoExportacao === "json") {
                exportarRelatorioJson(relatorio);
                return;
            }

            await carregarBibliotecasPdf();
            raizRenderizacao.appendChild(relatorio.element);
            document.body.appendChild(raizRenderizacao);
            await gerarPdf(relatorio.element, relatorio.fileNamePdf);
        } catch (erro) {
            window.ClimateDiagnostics?.depurar("Erro ao exportar dados.", erro);
            alert("Não foi possível exportar os dados.");
        } finally {
            raizRenderizacao.remove();
            botao.disabled = false;
            botao.innerText = textoOriginal || obterRotuloBotaoRelatorio(obterFormatoSelecionadoRelatorio());
        }
    }

    function configurarControlesFormatoRelatorio(botao, nomeFormato) {
        const entradasDados = Array.from(document.querySelectorAll(`input[name="${nomeFormato}"]`));
        if (!entradasDados.length) {
            botao.innerText = obterRotuloBotaoRelatorio(formatoSelecionado);
            return;
        }

        const sincronizarControles = () => {
            formatoSelecionado = obterFormatoSelecionadoRelatorio(nomeFormato);
            botao.innerText = obterRotuloBotaoRelatorio(formatoSelecionado);
        };

        entradasDados.forEach(entrada => entrada.addEventListener("change", sincronizarControles));
        sincronizarControles();
    }

    function obterFormatoSelecionadoRelatorio(nomeFormato = "exportFormat") {
        const verificado = document.querySelector(`input[name="${nomeFormato}"]:checked`);
        return verificado?.value === "json" ? "json" : "pdf";
    }

    function obterRotuloBotaoRelatorio(formatoExportacao) {
        return formatoExportacao === "json" ? "Exportar JSON" : "Exportar PDF";
    }

    function podeGerarPdf() {
        return typeof html2canvas === "function" && typeof window.jspdf?.jsPDF === "function";
    }

    async function carregarBibliotecasPdf() {
        if (podeGerarPdf()) return;

        const configuracao = window.AppConfig?.firebase || {};
        await carregarScriptUnico(configuracao.html2canvasUrl, "html2canvas");
        await carregarScriptUnico(configuracao.jsPdfUrl, "jspdf");

        if (!podeGerarPdf()) {
            throw new Error("Bibliotecas de PDF indisponíveis.");
        }
    }

    function carregarScriptUnico(url, nomeGlobal) {
        if (!url) return Promise.reject(new Error(`URL ausente para ${nomeGlobal}.`));
        if (window[nomeGlobal]) return Promise.resolve();

        return new Promise((resolver, rejeitar) => {
            const existente = document.querySelector(`script[data-lazy-lib="${nomeGlobal}"]`);
            if (existente) {
                existente.addEventListener("load", resolver, { once: true });
                existente.addEventListener("error", rejeitar, { once: true });
                return;
            }

            const script = document.createElement("script");
            script.src = url;
            script.async = true;
            script.dataset.lazyLib = nomeGlobal;
            script.onload = resolver;
            script.onerror = () => rejeitar(new Error(`Falha ao carregar ${nomeGlobal}.`));
            document.head.appendChild(script);
        });
    }

    function exportarRelatorioJson(relatorio) {
        const conteudoEnvio = {
            relatorio: "Estação Climática",
            versaoFormato: 2,
            aba: relatorio.tabLabel,
            dataConsultada: formatarDataFirebaseRelatorio(relatorio.selectedDate),
            dataConsultadaFirebase: relatorio.selectedDate,
            geradoEm: relatorio.generatedAt.toISOString(),
            resumo: relatorio.summaryCards.map(formatarCardResumoJson),
            tabelaResumida: relatorio.tableRows.map(formatarLinhaTabelaResumidaJson(relatorio.tableMetrics)),
            tabelaDetalhada: relatorio.rows.map(formatarLinhaTabelaDetalhadaJson),
            // Compatibilidade com o JSON antigo: consumidores existentes ainda encontram `tabela`.
            tabela: relatorio.rows.map(formatarLinhaTabelaDetalhadaJson),
            dadosBrutos: relatorio.selectedData,
            climaExterno: relatorio.dadosClimaExterno,
        };
        const blob = new Blob([JSON.stringify(conteudoEnvio, null, 2)], {
            type: "application/json;charset=utf-8",
        });
        const url = URL.createObjectURL(blob);
        const ligacao = document.createElement("a");
        ligacao.href = url;
        ligacao.download = relatorio.fileNameJson;
        document.body.appendChild(ligacao);
        ligacao.click();
        ligacao.remove();
        URL.revokeObjectURL(url);
    }

    function formatarCardResumoJson(card) {
        const detalhes = normalizarDetalhesResumoJson(card);
        const item = {
            indicador: card.label,
            valorAtual: card.current,
            status: card.status,
            detalhes,
        };

        if (card.min !== undefined || card.max !== undefined || card.delta !== undefined) {
            item.minimo = card.min;
            item.maximo = card.max;
            item.delta = card.delta;
        }

        if (card.qualidade) item.qualidadeDados = card.qualidade;

        return item;
    }

    function normalizarDetalhesResumoJson(card) {
        if (Array.isArray(card.details) && card.details.length) {
            return card.details.map(detalhe => ({
                rotulo: detalhe.label || "",
                valor: detalhe.value ?? "--",
            }));
        }

        return [
            { rotulo: "Mín", valor: card.min },
            { rotulo: "Máx", valor: card.max },
            { rotulo: "Delta", valor: card.delta },
        ];
    }

    function formatarLinhaTabelaResumidaJson(metricas) {
        return linha => ({
            horario: linha.time,
            valores: metricas.reduce((acumulador, metrica) => {
                acumulador[metrica.label] = linha.values[metrica.key] || "--";
                return acumulador;
            }, {}),
            statusGeral: linha.status,
        });
    }

    function formatarLinhaTabelaDetalhadaJson(linha) {
        const item = {
            horario: linha.time,
            horarioCompleto: linha.fullTime,
            indicador: linha.label,
            valor: linha.value,
            status: linha.status,
        };
        if (linha.qualidade) item.qualidadeDados = linha.qualidade;
        return item;
    }

    async function montarRelatorio(contexto, { onProgress: aoAvancar } = {}) {
        const configuracaoAba = CONFIGURACAO_ABAS[contexto.activeTab] || CONFIGURACAO_ABAS.Tab0 || CONFIGURACAO_ABAS.Tab1;
        const dataSelecionada = contexto.selectedDate || ClimateData.dataAtual();
        const geradoEm = new Date();
        const baseNomeArquivo = `relatorio-estacao-${gerarIdentificadorUrl(configuracaoAba.label)}-${dataSelecionada}`;
        aoAvancar?.("Preparando dados.");
        const fonte = construirFonteDadosRelatorio(configuracaoAba, contexto.latestData || {}, dataSelecionada);
        const linhas = fonte.linhasDetalhadas;
        const metricasTabela = obterMetricasTabelaPdf(configuracaoAba);
        const linhasTabela = montarLinhasTabelaCompacta(fonte.linhasNormalizadas, metricasTabela);
        const cardsResumo = montarCardsResumo(
            configuracaoAba,
            fonte.linhasNormalizadas,
            contexto.latestData || {},
            dataSelecionada,
            fonte.qualidades,
            contexto.dadosClimaExterno || null
        );
        const alertas = montarAlertasDiarios(fonte.linhasNormalizadas, configuracaoAba.metrics, fonte.qualidades);
        aoAvancar?.("Gerando gráficos.");
        const cardsGraficos = await coletarCardsGraficos(configuracaoAba, {
            normalizedRows: fonte.linhasNormalizadas,
            latestData: contexto.latestData || {},
            selectedDate: dataSelecionada,
            qualities: fonte.qualidades,
            dadosClimaExterno: contexto.dadosClimaExterno || null,
        });

        aoAvancar?.("Montando relatório.");
        const relatorio = document.createElement("article");
        relatorio.className = "pdf-report";
        relatorio.appendChild(criarCabecalho(configuracaoAba.label, dataSelecionada, geradoEm));
        relatorio.appendChild(criarSecaoResumo(cardsResumo, alertas));
        relatorio.appendChild(criarSecaoGraficos(cardsGraficos));
        if (configuracaoAba.hasTable !== false) {
            relatorio.appendChild(criarSecaoTabela(linhasTabela, metricasTabela));
        }

        return {
            element: relatorio,
            fileNamePdf: `${baseNomeArquivo}.pdf`,
            fileNameJson: `${baseNomeArquivo}.json`,
            tabLabel: configuracaoAba.label,
            selectedDate: dataSelecionada,
            generatedAt: geradoEm,
            summaryCards: cardsResumo,
            rows: linhas,
            tableRows: linhasTabela,
            tableMetrics: metricasTabela,
            selectedData: fonte.dadosSelecionados,
            normalizedRows: fonte.linhasNormalizadas,
            qualities: fonte.qualidades,
            chartCards: cardsGraficos,
            dadosClimaExterno: contexto.dadosClimaExterno || null,
        };
    }

    modulos.exporter = {
        setup: configurarModulo,
        exportActiveTab: exportarAbaAtual,
        setupFormatControls: configurarControlesFormatoRelatorio,
        getSelectedFormat: obterFormatoSelecionadoRelatorio,
        getButtonLabel: obterRotuloBotaoRelatorio,
        canGeneratePdf: podeGerarPdf,
        carregarBibliotecasPdf,
        exportJsonReport: exportarRelatorioJson,
        buildReport: montarRelatorio,
    };
})();
