'use strict';

(function () {
    const modules = window.ClimatePdfReportModules = window.ClimatePdfReportModules || {};

    const { config, data, dom, charts, pdf, format } = modules;
    const { TAB_CONFIG } = config;
    const { getFields, getPdfTableMetrics, getAllReportMetrics, buildCompactTableRows, buildDailyAlerts, buildSummaryCards, extractReportRows } = data;
    const { createHeader, createSummarySection, createChartsSection, createTableSection } = dom;
    const { collectChartCards } = charts;
    const { generatePdf } = pdf;
    const { formatFirebaseDate, slug } = format;

    let getContext = null;
    let selectedFormat = "pdf";

    function setup({ buttonId, formatName = "exportFormat", getContext: contextGetter }) {
        getContext = contextGetter;
        const button = document.getElementById(buttonId);
        if (!button) return;

        setupFormatControls(button, formatName);
        button.addEventListener("click", () => exportActiveTab(button));
    }

    async function exportActiveTab(button) {
        const format = getSelectedFormat();
        const originalText = button.innerText;
        button.disabled = true;
        button.innerText = format === "json" ? "Gerando JSON..." : "Gerando PDF...";

        const renderRoot = document.createElement("div");
        renderRoot.className = "pdf-render-root";

        try {
            const context = getContext ? getContext() : {};
            const report = await buildReport(context);

            if (format === "json") {
                exportJsonReport(report);
                return;
            }

            await carregarBibliotecasPdf();
            renderRoot.appendChild(report.element);
            document.body.appendChild(renderRoot);
            await generatePdf(report.element, report.fileNamePdf);
        } catch (error) {
            window.ClimateDiagnostics?.depurar("Erro ao exportar dados.", error);
            alert("Não foi possível exportar os dados.");
        } finally {
            renderRoot.remove();
            button.disabled = false;
            button.innerText = originalText || getButtonLabel(getSelectedFormat());
        }
    }

    function setupFormatControls(button, formatName) {
        const inputs = Array.from(document.querySelectorAll(`input[name="${formatName}"]`));
        if (!inputs.length) {
            button.innerText = getButtonLabel(selectedFormat);
            return;
        }

        const sync = () => {
            selectedFormat = getSelectedFormat(formatName);
            button.innerText = getButtonLabel(selectedFormat);
        };

        inputs.forEach(input => input.addEventListener("change", sync));
        sync();
    }

    function getSelectedFormat(formatName = "exportFormat") {
        const checked = document.querySelector(`input[name="${formatName}"]:checked`);
        return checked?.value === "json" ? "json" : "pdf";
    }

    function getButtonLabel(format) {
        return format === "json" ? "Exportar JSON" : "Exportar PDF";
    }

    function canGeneratePdf() {
        return typeof html2canvas === "function" && typeof window.jspdf?.jsPDF === "function";
    }

    async function carregarBibliotecasPdf() {
        if (canGeneratePdf()) return;

        const configuracao = window.AppConfig?.firebase || {};
        await carregarScriptUnico(configuracao.html2canvasUrl, "html2canvas");
        await carregarScriptUnico(configuracao.jsPdfUrl, "jspdf");

        if (!canGeneratePdf()) {
            throw new Error("Bibliotecas de PDF indisponíveis.");
        }
    }

    function carregarScriptUnico(url, nomeGlobal) {
        if (!url) return Promise.reject(new Error(`URL ausente para ${nomeGlobal}.`));
        if (window[nomeGlobal]) return Promise.resolve();

        return new Promise((resolve, reject) => {
            const existente = document.querySelector(`script[data-lazy-lib="${nomeGlobal}"]`);
            if (existente) {
                existente.addEventListener("load", resolve, { once: true });
                existente.addEventListener("error", reject, { once: true });
                return;
            }

            const script = document.createElement("script");
            script.src = url;
            script.async = true;
            script.dataset.lazyLib = nomeGlobal;
            script.onload = resolve;
            script.onerror = () => reject(new Error(`Falha ao carregar ${nomeGlobal}.`));
            document.head.appendChild(script);
        });
    }

    function exportJsonReport(report) {
        const payload = {
            relatorio: "Estação Climática",
            versaoFormato: 2,
            aba: report.tabLabel,
            dataConsultada: formatFirebaseDate(report.selectedDate),
            dataConsultadaFirebase: report.selectedDate,
            geradoEm: report.generatedAt.toISOString(),
            resumo: report.summaryCards.map(formatarCardResumoJson),
            tabelaResumida: report.tableRows.map(formatarLinhaTabelaResumidaJson(report.tableMetrics)),
            tabelaDetalhada: report.rows.map(formatarLinhaTabelaDetalhadaJson),
            // Compatibilidade com o JSON antigo: consumidores existentes ainda encontram `tabela`.
            tabela: report.rows.map(formatarLinhaTabelaDetalhadaJson),
            dadosBrutos: report.selectedData,
        };
        const blob = new Blob([JSON.stringify(payload, null, 2)], {
            type: "application/json;charset=utf-8",
        });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = report.fileNameJson;
        document.body.appendChild(link);
        link.click();
        link.remove();
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

        return item;
    }

    function normalizarDetalhesResumoJson(card) {
        if (Array.isArray(card.details) && card.details.length) {
            return card.details.map(detail => ({
                rotulo: detail.label || "",
                valor: detail.value ?? "--",
            }));
        }

        return [
            { rotulo: "Mín", valor: card.min },
            { rotulo: "Máx", valor: card.max },
            { rotulo: "Delta", valor: card.delta },
        ];
    }

    function formatarLinhaTabelaResumidaJson(metrics) {
        return row => ({
            horario: row.time,
            valores: metrics.reduce((acc, metric) => {
                acc[metric.label] = row.values[metric.key] || "--";
                return acc;
            }, {}),
            statusGeral: row.status,
        });
    }

    function formatarLinhaTabelaDetalhadaJson(row) {
        return {
            horario: row.time,
            horarioCompleto: row.fullTime,
            indicador: row.label,
            valor: row.value,
            status: row.status,
        };
    }

    async function buildReport(context) {
        const tabConfig = TAB_CONFIG[context.activeTab] || TAB_CONFIG.Tab0 || TAB_CONFIG.Tab1;
        const selectedDate = context.selectedDate || ClimateData.dataAtual();
        const generatedAt = new Date();
        const fileNameBase = `relatorio-estacao-${slug(tabConfig.label)}-${selectedDate}`;
        const data = context.latestData?.[tabConfig.dataKey] || {};
        const selectedData = ClimateData.filterDataByDays(data, 2, selectedDate);
        const fields = getFields(tabConfig);
        const rows = extractReportRows(selectedData, getAllReportMetrics(tabConfig), fields);
        const tableMetrics = getPdfTableMetrics(tabConfig);
        const tableRows = buildCompactTableRows(rows, tableMetrics);
        const summaryCards = buildSummaryCards(tabConfig, rows, context.chartInstances || {}, context.latestData || {}, selectedDate);
        const alerts = buildDailyAlerts(rows, tabConfig.metrics);
        const chartCards = await collectChartCards(tabConfig, context.chartInstances || {}, selectedDate);

        const report = document.createElement("article");
        report.className = "pdf-report";
        report.appendChild(createHeader(tabConfig.label, selectedDate, generatedAt));
        report.appendChild(createSummarySection(summaryCards, alerts));
        report.appendChild(createChartsSection(chartCards));
        if (tabConfig.hasTable !== false) {
            report.appendChild(createTableSection(tableRows, tableMetrics));
        }

        return {
            element: report,
            fileNamePdf: `${fileNameBase}.pdf`,
            fileNameJson: `${fileNameBase}.json`,
            tabLabel: tabConfig.label,
            selectedDate,
            generatedAt,
            summaryCards,
            rows,
            tableRows,
            tableMetrics,
            selectedData,
        };
    }

    modules.exporter = {
        setup,
        exportActiveTab,
        setupFormatControls,
        getSelectedFormat,
        getButtonLabel,
        canGeneratePdf,
        carregarBibliotecasPdf,
        exportJsonReport,
        buildReport,
    };
})();
