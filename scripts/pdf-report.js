'use strict';

(function () {
    const TAB_CONFIG = {
        Tab1: {
            label: "Sala",
            dataKey: "livingRoom",
            tableType: "livingRoom",
            metrics: [
                { key: "temperature", label: "Temperatura", unit: "°C", chart: "livingRoomTemperature", comfortBand: AppConfig.comfortBand },
                { key: "feelsLike", label: "Sensação térmica", unit: "°C", chart: "livingRoomFeelsLike", comfortBand: AppConfig.comfortBand },
                { key: "humidity", label: "Umidade", unit: "%", chart: "livingRoomHumidity", comfortBand: AppConfig.humidityComfortBand },
                { key: "pressure", label: "Pressão", unit: "hPa", chart: "livingRoomPressure" },
            ],
        },
        Tab2: {
            label: "Quarto",
            dataKey: "room",
            tableType: "room",
            metrics: [
                { key: "temperature", label: "Temperatura", unit: "°C", chart: "roomTemperature", comfortBand: AppConfig.comfortBand },
                { key: "feelsLike", label: "Sensação térmica", unit: "°C", chart: "roomFeelsLike", comfortBand: AppConfig.comfortBand },
                { key: "humidity", label: "Umidade", unit: "%", chart: "roomHumidity", comfortBand: AppConfig.humidityComfortBand },
            ],
            solarCharts: [
                { label: "Ciclo solar", unit: "h", chart: "solarToday" },
            ],
        },
        Tab3: {
            label: "Aquário",
            dataKey: "aquarium",
            tableType: "aquarium",
            metrics: [
                { key: "temperature", label: "Temperatura", unit: "°C", chart: "aquariumTemperature", comfortBand: AppConfig.aquariumComfortBand },
                { key: "ph", label: "pH", unit: "", chart: "aquariumPh" },
                { key: "tds", label: "TDS", unit: "", chart: "aquariumTds" },
                { key: "turbidity", label: "Turbidez", unit: "", chart: "aquariumTurbidity" },
            ],
        },
    };

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
        const rows = extractReportRows(selectedData, tabConfig.metrics, fields);
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

    function getFields(tabConfig) {
        if (tabConfig.tableType === "room") return AppConfig.fields.room;
        if (tabConfig.tableType === "livingRoom") return AppConfig.fields.livingRoom;
        return AppConfig.fields.aquarium;
    }

    function getPdfTableMetrics(tabConfig) {
        const preferredKeys = ["temperature", "feelsLike", "humidity"];
        const preferredMetrics = preferredKeys
            .map(key => tabConfig.metrics.find(metric => metric.key === key))
            .filter(Boolean);

        return preferredMetrics.length >= 2 ? preferredMetrics : tabConfig.metrics;
    }

    function buildCompactTableRows(rows, metrics) {
        const grouped = new Map();
        rows.forEach(row => {
            if (!row.fullTime || !metrics.some(metric => metric.key === row.metricKey)) return;

            if (!grouped.has(row.fullTime)) {
                grouped.set(row.fullTime, {
                    time: row.fullTime,
                    values: {},
                    statuses: [],
                });
            }

            const group = grouped.get(row.fullTime);
            group.values[row.metricKey] = row.value;
            group.statuses.push(row.status);
        });

        return Array.from(grouped.values())
            .sort((a, b) => a.time.localeCompare(b.time))
            .map(group => ({
                time: group.time,
                values: group.values,
                status: group.statuses.includes("Alerta") ? "Alerta" : "Estável",
            }));
    }

    function buildDailyAlerts(rows, metrics) {
        const alertMetrics = metrics.filter(metric => ["temperature", "feelsLike"].includes(metric.key));
        const alerts = [];

        alertMetrics.forEach(metric => {
            const alertRows = rows
                .filter(row => row.metricKey === metric.key && row.status === "Alerta" && row.fullTime)
                .sort((a, b) => a.fullTime.localeCompare(b.fullTime));

            if (!alertRows.length) return;

            const first = alertRows[0].fullTime;
            const last = alertRows[alertRows.length - 1].fullTime;
            alerts.push(`${metric.label} fora da faixa ideal entre ${first} e ${last}.`);
        });

        return alerts.slice(0, 4);
    }

    function createHeader(tabLabel, selectedDate, generatedAt) {
        const header = document.createElement("header");
        header.className = "pdf-report__header";
        header.innerHTML = `
            <div>
                <span class="pdf-report__eyebrow">Resumo executivo</span>
                <h2 class="pdf-report__title">Relatório da Estação Climática</h2>
                <p class="pdf-report__subtitle">Leitura consolidada da aba ativa e da data selecionada.</p>
            </div>
            <div class="pdf-report__meta">
                <div class="pdf-report__meta-item">
                    <span class="pdf-report__label">Aba selecionada</span>
                    <span class="pdf-report__value">${escapeHtml(tabLabel)}</span>
                </div>
                <div class="pdf-report__meta-item">
                    <span class="pdf-report__label">Data consultada</span>
                    <span class="pdf-report__value">${formatFirebaseDate(selectedDate)}</span>
                </div>
                <div class="pdf-report__meta-item">
                    <span class="pdf-report__label">Gerado em</span>
                    <span class="pdf-report__value">${formatDateTime(generatedAt)}</span>
                </div>
            </div>
        `;
        return header;
    }

    function createSummarySection(cards, alerts) {
        const section = document.createElement("section");
        section.className = "pdf-report__section pdf-report__summary-section";
        section.innerHTML = `<span class="pdf-report__section-title">Indicadores principais</span>`;

        const grid = document.createElement("div");
        grid.className = "pdf-summary-grid";
        cards.forEach(card => grid.appendChild(createSummaryCard(card)));
        section.appendChild(grid);
        section.appendChild(createAlertsPanel(alerts));
        return section;
    }

    function createAlertsPanel(alerts) {
        const panel = document.createElement("article");
        panel.className = "pdf-alert-panel";
        const items = alerts.length
            ? alerts.map(alert => `<li>${escapeHtml(alert)}</li>`).join("")
            : "<li>Nenhum alerta relevante encontrado para o período.</li>";

        panel.innerHTML = `
            <div class="pdf-alert-panel__heading">
                <span class="pdf-report__section-title">Alertas do dia</span>
                <span class="pdf-status pdf-status--${alerts.length ? "alert" : "stable"}">${alerts.length ? "Atenção" : "Estável"}</span>
            </div>
            <ul class="pdf-alert-list">${items}</ul>
        `;
        return panel;
    }

    function createSummaryCard(card) {
        const statusClass = getStatusClass(card.status);
        const el = document.createElement("article");
        el.className = "pdf-summary-card";
        el.innerHTML = `
            <div class="pdf-summary-card__top">
                <span class="pdf-summary-card__name">${escapeHtml(card.label)}</span>
                <span class="pdf-status pdf-status--${statusClass}">${escapeHtml(card.status)}</span>
            </div>
            <strong class="pdf-summary-card__current">${escapeHtml(card.current)}</strong>
            <dl class="pdf-summary-card__details">
                <div><dt>Mín</dt><dd>${escapeHtml(card.min)}</dd></div>
                <div><dt>Máx</dt><dd>${escapeHtml(card.max)}</dd></div>
                <div><dt>Delta</dt><dd>${escapeHtml(card.delta)}</dd></div>
            </dl>
        `;
        return el;
    }

    function createChartsSection(cards) {
        const section = document.createElement("section");
        section.className = "pdf-report__section pdf-report__charts-section";
        section.innerHTML = `<span class="pdf-report__section-title">Gráficos</span>`;

        const grid = document.createElement("div");
        grid.className = "pdf-chart-grid";
        cards.forEach(card => grid.appendChild(createChartCard(card)));
        section.appendChild(grid);
        return section;
    }

    function createChartCard(card) {
        const el = document.createElement("article");
        el.className = [
            "pdf-chart-card",
            card.wide ? "pdf-chart-card--wide" : "",
            card.compact ? "pdf-chart-card--compact" : "",
        ].filter(Boolean).join(" ");
        el.innerHTML = `
            <div class="pdf-chart-card__title">
                <span class="pdf-chart-card__name">${escapeHtml(card.label)}</span>
                <span class="pdf-chart-card__unit">${escapeHtml(card.unit || "")}</span>
            </div>
        `;

        if (card.image) {
            const img = document.createElement("img");
            img.src = card.image;
            img.alt = card.label;
            el.appendChild(img);
        } else {
            const empty = document.createElement("div");
            empty.className = "pdf-empty";
            empty.innerText = card.emptyMessage || "Sem dados disponíveis";
            el.appendChild(empty);
        }

        if (card.stats?.length) {
            const stats = document.createElement("div");
            stats.className = "pdf-chart-stats";
            stats.innerHTML = card.stats.map(item => `<span>${escapeHtml(item)}</span>`).join("");
            el.appendChild(stats);
        }

        return el;
    }

    function createTableSection(rows, metrics) {
        const section = document.createElement("section");
        section.className = "pdf-report__section pdf-report__table-section";
        section.innerHTML = `<span class="pdf-report__section-title">Tabela resumida</span>`;

        if (!rows.length) {
            const empty = document.createElement("div");
            empty.className = "pdf-empty";
            empty.innerText = "Sem dados disponíveis";
            section.appendChild(empty);
            return section;
        }

        const table = document.createElement("table");
        table.className = "pdf-table";
        table.innerHTML = `
            <thead>
                <tr>
                    <th>Horário</th>
                    ${metrics.map(metric => `<th>${escapeHtml(metric.label)}</th>`).join("")}
                    <th>Status geral</th>
                </tr>
            </thead>
        `;
        const tbody = document.createElement("tbody");
        rows.forEach(row => {
            const tr = document.createElement("tr");
            tr.innerHTML = `
                <td>${escapeHtml(row.time)}</td>
                ${metrics.map(metric => `<td>${escapeHtml(row.values[metric.key] || "--")}</td>`).join("")}
                <td><span class="pdf-status pdf-status--${getStatusClass(row.status)}">${escapeHtml(row.status)}</span></td>
            `;
            tbody.appendChild(tr);
        });
        table.appendChild(tbody);
        section.appendChild(table);
        return section;
    }

    function buildSummaryCards(tabConfig, rows, chartInstances) {
        const cards = getPdfTableMetrics(tabConfig).map(metric => {
            const values = rows
                .filter(row => row.metricKey === metric.key && Number.isFinite(row.numericValue))
                .map(row => row.numericValue);
            return buildMetricSummary(metric, values);
        });

        const solarChart = chartInstances[AppConfig.ids.charts.solarToday];
        cards.push(buildSolarSummary(solarChart));

        return cards;
    }

    function buildMetricSummary(metric, values) {
        if (!values.length) {
            return emptySummary(metric.label);
        }

        const first = values[0];
        const last = values[values.length - 1];
        const min = Math.min(...values);
        const max = Math.max(...values);
        const delta = last - first;
        const status = getMetricStatus(metric, last);

        return {
            label: metric.label,
            current: formatValue(last, metric.unit),
            min: formatValue(min, metric.unit),
            max: formatValue(max, metric.unit),
            delta: formatDelta(delta, metric.unit),
            status,
        };
    }

    function buildSolarSummary(chart) {
        const times = chart?.$solarDayTimes;
        if (!times) return emptySummary("Ciclo solar");

        const dayLength = times.sunset - times.sunrise;
        return {
            label: "Ciclo solar",
            current: `Zênite ${ClimateData.formatTime(times.zenith)}`,
            min: `Nascer ${ClimateData.formatTime(times.sunrise)}`,
            max: `Pôr ${ClimateData.formatTime(times.sunset)}`,
            delta: `${dayLength.toFixed(2)}h`,
            status: "Estável",
        };
    }

    function emptySummary(label) {
        return {
            label,
            current: "--",
            min: "--",
            max: "--",
            delta: "--",
            status: "Sem dados",
        };
    }

    async function collectChartCards(tabConfig, chartInstances, selectedDate) {
        const cards = [];
        const temperatureMetric = tabConfig.metrics.find(metric => metric.key === "temperature");
        const feelsLikeMetric = tabConfig.metrics.find(metric => metric.key === "feelsLike");
        const humidityMetric = tabConfig.metrics.find(metric => metric.key === "humidity");

        if (temperatureMetric && feelsLikeMetric) {
            cards.push(await createMetricChartCard(
                "Temperatura x Sensação Térmica",
                "°C",
                [temperatureMetric, feelsLikeMetric],
                chartInstances,
                selectedDate
            ));
        } else if (temperatureMetric) {
            cards.push(await createMetricChartCard(temperatureMetric.label, temperatureMetric.unit, [temperatureMetric], chartInstances, selectedDate));
        }

        if (humidityMetric) {
            cards.push(await createMetricChartCard(humidityMetric.label, humidityMetric.unit, [humidityMetric], chartInstances, selectedDate));
        } else {
            const fallbackMetrics = tabConfig.metrics
                .filter(metric => metric.key !== "temperature" && metric.key !== "feelsLike")
                .slice(0, Math.max(0, 2 - cards.length));

            for (const metric of fallbackMetrics) {
                cards.push(await createMetricChartCard(metric.label, metric.unit, [metric], chartInstances, selectedDate));
            }
        }

        const solarChartId = AppConfig.ids.charts.solarToday;
        cards.push({
            label: "Ciclo solar compacto",
            unit: "h",
            image: captureChartImage(solarChartId, chartInstances),
            compact: true,
            emptyMessage: buildNoDataMessage("ciclo solar", selectedDate),
            stats: buildSolarChartStats(chartInstances[solarChartId]),
        });

        return cards;
    }

    async function createMetricChartCard(label, unit, metrics, chartInstances, selectedDate) {
        const image = createMetricChartImage(label, unit, metrics, chartInstances);
        return {
            label,
            unit,
            image,
            emptyMessage: buildNoDataMessage(label, selectedDate),
            stats: metrics.flatMap(metric => {
                const chart = chartInstances[AppConfig.ids.charts[metric.chart]];
                return buildChartStats(metric.label, getChartValues(chart), metric.unit);
            }),
        };
    }

    function createMetricChartImage(title, unit, metrics, chartInstances) {
        if (typeof Chart !== "function") return captureFirstMetricImage(metrics, chartInstances);

        const series = metrics
            .map((metric, index) => {
                const chart = chartInstances[AppConfig.ids.charts[metric.chart]];
                const labels = getChartLabels(chart);
                const values = getChartValues(chart);
                return {
                    metric,
                    labels,
                    values,
                    color: getPdfChartColor(index),
                };
            })
            .filter(item => item.labels.length && item.values.some(Number.isFinite));

        if (!series.length) return captureFirstMetricImage(metrics, chartInstances);

        const labels = series[0].labels;
        const canvas = document.createElement("canvas");
        canvas.width = 1200;
        canvas.height = 520;

        const datasets = series.flatMap(item => {
            const stats = calculateSeriesStats(item.values);
            const normalizedValues = labels.map((_, index) => item.values[index] ?? null);
            return [
                {
                    label: item.metric.label,
                    data: normalizedValues,
                    borderColor: item.color,
                    backgroundColor: item.color,
                    borderWidth: 4,
                    tension: 0.32,
                    pointRadius: normalizedValues.map((_, index) => index === stats.minIndex || index === stats.maxIndex ? 6 : 0),
                    pointHoverRadius: 0,
                    fill: false,
                },
                {
                    label: `${item.metric.label} média`,
                    data: labels.map(() => stats.avg),
                    borderColor: withAlpha(item.color, 0.45),
                    borderDash: [10, 8],
                    borderWidth: 2,
                    pointRadius: 0,
                    fill: false,
                },
            ];
        });

        const comfortBand = getPdfComfortBand(metrics);
        const yBounds = calculatePdfYBounds(series);
        const chart = new Chart(canvas.getContext("2d"), {
            type: "line",
            data: { labels, datasets },
            options: createPdfChartOptions(title, unit, datasets.length > 2, yBounds),
            plugins: [pdfChartBackgroundPlugin(), pdfComfortBandPlugin()],
        });

        chart.$pdfComfortBand = comfortBand;
        chart.update("none");
        const image = canvas.toDataURL("image/png", 1);
        chart.destroy();
        return image;
    }

    function captureFirstMetricImage(metrics, chartInstances) {
        const metric = metrics.find(item => item?.chart);
        return metric ? captureChartImage(AppConfig.ids.charts[metric.chart], chartInstances) : null;
    }

    function createPdfChartOptions(title, unit, showLegend, yBounds = {}) {
        return {
            responsive: false,
            animation: false,
            maintainAspectRatio: false,
            layout: {
                padding: { top: 24, right: 28, bottom: 12, left: 16 },
            },
            plugins: {
                title: {
                    display: true,
                    text: title,
                    color: "#f8fafc",
                    font: { size: 26, weight: "700" },
                    padding: { bottom: 18 },
                },
                legend: {
                    display: showLegend,
                    labels: {
                        color: "#cbd5e1",
                        boxWidth: 22,
                        boxHeight: 10,
                        font: { size: 18, weight: "600" },
                        filter: item => !item.text.includes("média"),
                    },
                },
                tooltip: { enabled: false },
            },
            scales: {
                x: {
                    ticks: {
                        color: "#94a3b8",
                        maxRotation: 0,
                        minRotation: 0,
                        autoSkip: true,
                        maxTicksLimit: 8,
                        font: { size: 17 },
                    },
                    grid: { color: "rgba(99, 132, 200, 0.16)" },
                },
                y: {
                    suggestedMin: yBounds.suggestedMin,
                    suggestedMax: yBounds.suggestedMax,
                    title: {
                        display: Boolean(unit),
                        text: unit,
                        color: "#94a3b8",
                        font: { size: 17, weight: "700" },
                    },
                    ticks: {
                        color: "#94a3b8",
                        font: { size: 17 },
                    },
                    grid: { color: "rgba(99, 132, 200, 0.18)" },
                },
            },
        };
    }

    function pdfChartBackgroundPlugin() {
        return {
            id: "pdfChartBackground",
            beforeDraw(chart) {
                const { ctx, width, height } = chart;
                ctx.save();
                ctx.fillStyle = "#111827";
                ctx.fillRect(0, 0, width, height);
                ctx.restore();
            },
        };
    }

    function pdfComfortBandPlugin() {
        return {
            id: "pdfComfortBand",
            beforeDatasetsDraw(chart) {
                const band = chart.$pdfComfortBand;
                const yScale = chart.scales.y;
                const area = chart.chartArea;
                if (!band || !yScale || !area) return;

                const yMin = clamp(yScale.getPixelForValue(band.min), area.top, area.bottom);
                const yMax = clamp(yScale.getPixelForValue(band.max), area.top, area.bottom);
                const top = Math.min(yMin, yMax);
                const height = Math.abs(yMax - yMin);
                const ctx = chart.ctx;

                ctx.save();
                ctx.fillStyle = "rgba(52, 211, 153, 0.10)";
                ctx.fillRect(area.left, top, area.right - area.left, height);
                ctx.strokeStyle = "rgba(52, 211, 153, 0.35)";
                ctx.setLineDash([8, 6]);
                ctx.beginPath();
                ctx.moveTo(area.left, yMin);
                ctx.lineTo(area.right, yMin);
                ctx.moveTo(area.left, yMax);
                ctx.lineTo(area.right, yMax);
                ctx.stroke();
                ctx.restore();
            },
        };
    }

    function getPdfComfortBand(metrics) {
        const metricWithBand = metrics.find(metric => metric.comfortBand);
        return metricWithBand?.comfortBand || null;
    }

    function calculatePdfYBounds(series) {
        const values = series
            .flatMap(item => item.values)
            .filter(Number.isFinite);

        if (!values.length) return {};

        const min = Math.min(...values);
        const max = Math.max(...values);
        const range = max - min;
        const padding = range > 0 ? Math.max(range * 0.12, 0.1) : 1;

        return {
            suggestedMin: min - padding,
            suggestedMax: max + padding,
        };
    }

    function buildNoDataMessage(label, selectedDate) {
        return `Sem dados de ${label.toLowerCase()} em ${formatFirebaseDate(selectedDate)}.`;
    }

    function clamp(value, min, max) {
        return Math.min(Math.max(value, min), max);
    }

    function getPdfChartColor(index) {
        return ["#38bdf8", "#34d399", "#a78bfa", "#fb7185"][index] || "#facc15";
    }

    function withAlpha(hex, alpha) {
        const value = hex.replace("#", "");
        const r = parseInt(value.slice(0, 2), 16);
        const g = parseInt(value.slice(2, 4), 16);
        const b = parseInt(value.slice(4, 6), 16);
        return `rgba(${r}, ${g}, ${b}, ${alpha})`;
    }

    function getChartLabels(chart) {
        return (chart?.data?.labels || []).map(label => String(label));
    }

    function getChartValues(chart) {
        const data = chart?.data?.datasets?.[0]?.data || [];
        return data.map(point => {
            const value = typeof point === "object" && point !== null ? point.y : point;
            const number = Number(value);
            return Number.isFinite(number) ? number : null;
        });
    }

    function calculateSeriesStats(values) {
        const numeric = values
            .map((value, index) => ({ value, index }))
            .filter(item => Number.isFinite(item.value));

        if (!numeric.length) {
            return { min: null, max: null, avg: null, minIndex: -1, maxIndex: -1 };
        }

        const minItem = numeric.reduce((lowest, item) => item.value < lowest.value ? item : lowest, numeric[0]);
        const maxItem = numeric.reduce((highest, item) => item.value > highest.value ? item : highest, numeric[0]);
        const avg = numeric.reduce((sum, item) => sum + item.value, 0) / numeric.length;
        return {
            min: minItem.value,
            max: maxItem.value,
            avg,
            minIndex: minItem.index,
            maxIndex: maxItem.index,
        };
    }

    function buildChartStats(label, values, unit) {
        const stats = calculateSeriesStats(values);
        if (!Number.isFinite(stats.avg)) return [];

        return [
            `${label}: mín ${formatValue(stats.min, unit)} · máx ${formatValue(stats.max, unit)} · média ${formatValue(stats.avg, unit)}`,
        ];
    }

    function buildSolarChartStats(chart) {
        const times = chart?.$solarDayTimes;
        if (!times) return [];

        return [
            `Amanhecer ${ClimateData.formatTime(times.dawn)}`,
            `Nascer ${ClimateData.formatTime(times.sunrise)}`,
            `Zênite ${ClimateData.formatTime(times.zenith)}`,
            `Pôr ${ClimateData.formatTime(times.sunset)}`,
            `Anoitecer ${ClimateData.formatTime(times.dusk)}`,
        ];
    }

    function captureChartImage(chartId, chartInstances) {
        const chart = chartInstances[chartId];
        const canvas = chart?.canvas;
        if (!canvas || typeof canvas.toDataURL !== "function") return null;

        try {
            return canvas.toDataURL("image/png", 1);
        } catch {
            return null;
        }
    }

    function extractReportRows(data, metrics, fields) {
        const rows = [];
        const firebaseDates = Object.keys(data || {}).sort((a, b) => ClimateData.parseFirebaseDate(a) - ClimateData.parseFirebaseDate(b));

        for (const firebaseDate of firebaseDates) {
            const dateData = data[firebaseDate];
            if (!dateData || typeof dateData !== "object") continue;

            for (const time of Object.keys(dateData).sort()) {
                const timeData = dateData[time];
                if (!timeData || typeof timeData !== "object") continue;
                const [hour, minute = "0"] = time.split("-");

                for (const itemKey of Object.keys(timeData).sort()) {
                    const item = timeData[itemKey];
                    if (!item || typeof item !== "object") continue;

                    metrics.forEach((metric, metricIndex) => {
                        const fieldName = fields[metric.key];
                        const rawValue = item[fieldName];
                        const numericValue = Number(rawValue);
                        const hasValue = Number.isFinite(numericValue);
                        rows.push({
                            time: metricIndex === 0 ? `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}` : "",
                            fullTime: `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`,
                            metricKey: metric.key,
                            label: metric.label,
                            numericValue: hasValue ? numericValue : null,
                            value: hasValue ? formatValue(numericValue, metric.unit) : "--",
                            status: hasValue ? getMetricStatus(metric, numericValue) : "Sem dados",
                        });
                    });
                }
            }
        }

        return rows;
    }

    async function generatePdf(element, fileName) {
        await waitForImages(element);

        const { jsPDF } = window.jspdf;
        const pdf = new jsPDF({
            unit: "mm",
            format: "a4",
            orientation: "portrait",
            compress: true,
        });

        await addReportBlocks(pdf, element);
        addPdfFooters(pdf);
        pdf.save(fileName);
    }

    async function addReportBlocks(pdf, element) {
        const layout = createPdfLayout();
        const header = element.querySelector(".pdf-report__header");
        const summarySection = element.querySelector(".pdf-report__summary-section");
        const chartsSection = element.querySelector(".pdf-report__charts-section");
        const tableSection = element.querySelector(".pdf-report__table-section");
        let cursorY = layout.margin.top;

        paintPdfPage(pdf, layout);

        cursorY = await addElementBlock(pdf, header, layout, cursorY, { gap: 6 });
        await addElementBlock(pdf, summarySection, layout, cursorY, { gap: 0 });

        cursorY = addPdfPage(pdf, layout);
        cursorY = addSectionHeading(pdf, "Gráficos", layout, cursorY);
        for (const chartCard of chartsSection.querySelectorAll(".pdf-chart-card")) {
            cursorY = await addElementBlock(pdf, chartCard, layout, cursorY, { gap: 4 });
        }

        cursorY = addPdfPage(pdf, layout);
        cursorY = addSectionHeading(pdf, "Tabela resumida", layout, cursorY);
        const tableContent = tableSection.querySelector(".pdf-table, .pdf-empty");
        await addElementBlock(pdf, tableContent, layout, cursorY, { allowSplit: true, gap: 0 });
    }

    function createPdfLayout() {
        return {
            pageWidth: 210,
            pageHeight: 297,
            contentWidth: 194,
            contentBottom: 281,
            margin: {
                top: 8,
                right: 8,
                bottom: 16,
                left: 8,
            },
        };
    }

    async function addElementBlock(pdf, element, layout, cursorY, options = {}) {
        if (!element) return cursorY;

        const gap = options.gap ?? 4;
        const canvas = await captureElement(element);
        const heightMm = getCanvasHeightMm(canvas, layout);

        if (options.allowSplit || heightMm > getContentHeight(layout)) {
            return addCanvasSlices(pdf, canvas, layout, cursorY, gap);
        }

        if (cursorY + heightMm > layout.contentBottom) {
            cursorY = addPdfPage(pdf, layout);
        }

        addCanvasImage(pdf, canvas, layout, cursorY, heightMm);
        return cursorY + heightMm + gap;
    }

    async function captureElement(element) {
        return html2canvas(element, {
            scale: 2,
            backgroundColor: "#0b1120",
            useCORS: true,
            scrollX: 0,
            scrollY: 0,
            windowWidth: Math.max(element.scrollWidth, element.offsetWidth),
            windowHeight: Math.max(element.scrollHeight, element.offsetHeight),
        });
    }

    function addCanvasSlices(pdf, canvas, layout, cursorY, gap) {
        const pixelsPerMm = canvas.width / layout.contentWidth;
        let sourceY = 0;

        while (sourceY < canvas.height) {
            const availableHeight = layout.contentBottom - cursorY;
            if (availableHeight < 35) {
                cursorY = addPdfPage(pdf, layout);
            }

            const sliceHeight = Math.min(
                Math.floor((layout.contentBottom - cursorY) * pixelsPerMm),
                canvas.height - sourceY
            );
            const pageCanvas = createCanvasSlice(canvas, sourceY, sliceHeight);
            const sliceHeightMm = sliceHeight / pixelsPerMm;

            addCanvasImage(pdf, pageCanvas, layout, cursorY, sliceHeightMm);
            sourceY += sliceHeight;
            cursorY += sliceHeightMm;

            if (sourceY < canvas.height) {
                cursorY = addPdfPage(pdf, layout);
            }
        }

        return cursorY + gap;
    }

    function createCanvasSlice(canvas, sourceY, sliceHeight) {
        const pageCanvas = document.createElement("canvas");
        pageCanvas.width = canvas.width;
        pageCanvas.height = sliceHeight;

        const context = pageCanvas.getContext("2d");
        context.fillStyle = "#0b1120";
        context.fillRect(0, 0, pageCanvas.width, pageCanvas.height);
        context.drawImage(
            canvas,
            0,
            sourceY,
            canvas.width,
            sliceHeight,
            0,
            0,
            pageCanvas.width,
            pageCanvas.height
        );

        return pageCanvas;
    }

    function addCanvasImage(pdf, canvas, layout, y, heightMm) {
        pdf.addImage(
            canvas.toDataURL("image/jpeg", 0.96),
            "JPEG",
            layout.margin.left,
            y,
            layout.contentWidth,
            heightMm
        );
    }

    function getCanvasHeightMm(canvas, layout) {
        return canvas.height * layout.contentWidth / canvas.width;
    }

    function getContentHeight(layout) {
        return layout.contentBottom - layout.margin.top;
    }

    function addSectionHeading(pdf, title, layout, cursorY) {
        const height = 8;
        if (cursorY + height > layout.contentBottom) {
            cursorY = addPdfPage(pdf, layout);
        }

        pdf.setFont("helvetica", "bold");
        pdf.setFontSize(8);
        pdf.setTextColor(148, 163, 184);
        pdf.text(title.toUpperCase(), layout.margin.left, cursorY + 4);
        return cursorY + height;
    }

    function addPdfPage(pdf, layout) {
        pdf.addPage();
        paintPdfPage(pdf, layout);
        return layout.margin.top;
    }

    function paintPdfPage(pdf, layout) {
        pdf.setFillColor(11, 17, 32);
        pdf.rect(0, 0, layout.pageWidth, layout.pageHeight, "F");
    }

    function waitForImages(element) {
        const images = Array.from(element.querySelectorAll("img"));
        const pending = images
            .filter(img => !img.complete)
            .map(img => new Promise(resolve => {
                img.addEventListener("load", resolve, { once: true });
                img.addEventListener("error", resolve, { once: true });
            }));

        return Promise.all(pending);
    }

    function addPdfFooters(pdf) {
        const pageCount = pdf.internal.getNumberOfPages();
        const generatedAt = formatDateTime(new Date());

        for (let page = 1; page <= pageCount; page++) {
            pdf.setPage(page);
            pdf.setFontSize(8);
            pdf.setTextColor(148, 163, 184);
            pdf.text("Estação Climática", 8, 290);
            pdf.text(`Página ${page} / ${pageCount}`, 105, 290, { align: "center" });
            pdf.text(generatedAt, 202, 290, { align: "right" });
        }
    }

    function getMetricStatus(metric, value) {
        if (!Number.isFinite(value)) return "Sem dados";
        if (["temperature", "feelsLike", "humidity"].includes(metric.key)) {
            const band = metric.comfortBand || AppConfig.comfortBand;
            return value < band.min || value > band.max ? "Alerta" : "Estável";
        }
        return "Estável";
    }

    function getStatusClass(status) {
        if (status === "Alerta") return "alert";
        if (status === "Sem dados") return "empty";
        return "stable";
    }

    function formatValue(value, unit) {
        if (!Number.isFinite(value)) return "--";
        return `${value.toFixed(2)}${unit}`;
    }

    function formatDelta(value, unit) {
        if (!Number.isFinite(value)) return "--";
        const sign = value > 0 ? "+" : "";
        return `${sign}${value.toFixed(2)}${unit}`;
    }

    function formatFirebaseDate(date) {
        return date ? date.replace(/-/g, "/") : "--";
    }

    function formatDateTime(date) {
        return date.toLocaleString("pt-BR", {
            day: "2-digit",
            month: "2-digit",
            year: "numeric",
            hour: "2-digit",
            minute: "2-digit",
        });
    }

    function escapeHtml(value) {
        return String(value)
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }

    function slug(value) {
        return value
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "")
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, "-")
            .replace(/(^-|-$)/g, "");
    }

    window.ClimatePdfReport = {
        setup,
    };
})();
