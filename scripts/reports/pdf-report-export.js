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
        if (format === "pdf" && !canGeneratePdf()) {
            alert("Biblioteca de PDF não carregada.");
            return;
        }

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

            renderRoot.appendChild(report.element);
            document.body.appendChild(renderRoot);
            await generatePdf(report.element, report.fileNamePdf);
        } catch (error) {
            console.error("Erro ao exportar dados:", error);
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

    function exportJsonReport(report) {
        const payload = {
            relatorio: "Estação Climática",
            aba: report.tabLabel,
            dataConsultada: formatFirebaseDate(report.selectedDate),
            dataConsultadaFirebase: report.selectedDate,
            geradoEm: report.generatedAt.toISOString(),
            resumo: report.summaryCards.map(card => ({
                indicador: card.label,
                atual: card.current,
                minimo: card.min,
                maximo: card.max,
                delta: card.delta,
                status: card.status,
            })),
            tabela: report.rows.map(row => ({
                horario: row.time,
                indicador: row.label,
                valor: row.value,
                status: row.status,
            })),
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

    async function buildReport(context) {
        const tabConfig = TAB_CONFIG[context.activeTab] || TAB_CONFIG.Tab1;
        const selectedDate = context.selectedDate || ClimateData.dataAtual();
        const generatedAt = new Date();
        const fileNameBase = `relatorio-estacao-${slug(tabConfig.label)}-${selectedDate}`;
        const data = context.latestData?.[tabConfig.dataKey] || {};
        const selectedData = ClimateData.filterDataByDays(data, 2, selectedDate);
        const fields = getFields(tabConfig);
        const rows = extractReportRows(selectedData, getAllReportMetrics(tabConfig), fields);
        const tableMetrics = getPdfTableMetrics(tabConfig);
        const tableRows = buildCompactTableRows(rows, tableMetrics);
        const summaryCards = buildSummaryCards(tabConfig, rows, context.chartInstances || {});
        const alerts = buildDailyAlerts(rows, tabConfig.metrics);
        const chartCards = await collectChartCards(tabConfig, context.chartInstances || {}, selectedDate);

        const report = document.createElement("article");
        report.className = "pdf-report";
        report.appendChild(createHeader(tabConfig.label, selectedDate, generatedAt));
        report.appendChild(createSummarySection(summaryCards, alerts));
        report.appendChild(createChartsSection(chartCards));
        report.appendChild(createTableSection(tableRows, tableMetrics));

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
        exportJsonReport,
        buildReport,
    };
})();
