'use strict';

(function () {
    const modules = window.ClimatePdfReportModules = window.ClimatePdfReportModules || {};

    const { format } = modules;
    const { buildNoDataMessage, clamp, formatValue } = format;

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
        }

        const individualMetrics = tabConfig.metrics.filter(metric => (
            metric.key !== "temperature" &&
            metric.key !== "feelsLike" &&
            metric.key !== "humidity"
        ));

        for (const metric of individualMetrics) {
            cards.push(await createMetricChartCard(metric.label, metric.unit, [metric], chartInstances, selectedDate));
        }

        if (tabConfig.includeSolar) {
            const solarChartId = AppConfig.ids.charts.solarToday;
            const solarChart = chartInstances[solarChartId];
            cards.push({
                label: "Ciclo solar compacto",
                unit: "h",
                image: createSolarCompactImage(solarChart),
                compact: true,
                emptyMessage: buildNoDataMessage("ciclo solar", selectedDate),
                stats: buildSolarChartStats(solarChart),
            });
        }

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

    function createSolarCompactImage(chart) {
        const times = chart?.$solarDayTimes;
        if (!times || typeof Chart !== "function" || !window.ClimateSolar || !window.ClimateCharts) return null;

        const canvas = document.createElement("canvas");
        canvas.width = 1200;
        canvas.height = 520;

        const daylightPoints = [
            { x: 0, y: 0 },
            { x: times.dawn, y: 0.08, label: "Amanhecer", timeLabel: ClimateData.formatTime(times.dawn) },
            { x: times.sunrise, y: 0.52, label: "Nascer do sol", timeLabel: ClimateData.formatTime(times.sunrise) },
            { x: times.zenith, y: 1, label: "Zenite", timeLabel: ClimateData.formatTime(times.zenith) },
            { x: times.sunset, y: 0.52, label: "Pôr do sol", timeLabel: ClimateData.formatTime(times.sunset) },
            { x: times.dusk, y: 0.08, label: "Anoitecer", timeLabel: ClimateData.formatTime(times.dusk) },
            { x: 24, y: 0 },
        ];

        const eventPoints = daylightPoints.slice(1, 6);
        const defaults = window.ClimateCharts.createDefaults(AppConfig.colors);
        const options = window.ClimateSolar.getSolarTodayOptions({
            defaults,
            colors: AppConfig.colors,
            tickSize: 17,
            labelSize: 17,
        });
        options.responsive = false;
        options.animation = false;
        options.layout = { padding: { top: 20, right: 24, bottom: 8, left: 10 } };
        options.plugins.tooltip.enabled = false;

        const pdfSolarChart = new Chart(canvas.getContext("2d"), {
            type: "line",
            data: {
                datasets: [
                    {
                        label: "Luz do dia",
                        data: daylightPoints,
                        borderColor: "#facc15",
                        backgroundColor: "rgba(250, 204, 21, 0.22)",
                        fill: true,
                        tension: 0.42,
                        pointRadius: 0,
                        pointHitRadius: 18,
                        pointHoverRadius: 0,
                        order: 2,
                    },
                    {
                        type: "scatter",
                        label: "Eventos solares",
                        data: eventPoints,
                        borderColor: "#f8fafc",
                        backgroundColor: ["#fde68a", "#fb923c", "#facc15", "#f87171", "#818cf8"],
                        pointBorderColor: "#0b1120",
                        pointBorderWidth: 3,
                        pointRadius: 7,
                        pointHitRadius: 18,
                        pointHoverRadius: 7,
                        order: 1,
                    },
                ],
            },
            options,
            plugins: [pdfChartBackgroundPlugin(), window.ClimateSolar.solarDayBackgroundPlugin],
        });

        pdfSolarChart.$solarDayTimes = times;
        pdfSolarChart.update("none");
        const image = canvas.toDataURL("image/png", 1);
        pdfSolarChart.destroy();
        return image;
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

    modules.charts = {
        collectChartCards,
        createMetricChartCard,
        createMetricChartImage,
        captureFirstMetricImage,
        createPdfChartOptions,
        pdfChartBackgroundPlugin,
        pdfComfortBandPlugin,
        getPdfComfortBand,
        calculatePdfYBounds,
        createSolarCompactImage,
        getPdfChartColor,
        withAlpha,
        getChartLabels,
        getChartValues,
        calculateSeriesStats,
        buildChartStats,
        buildSolarChartStats,
        captureChartImage,
    };
})();
