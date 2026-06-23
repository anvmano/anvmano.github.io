'use strict';

(function () {
    const DEFAULT_COMFORT_BAND = {
        min: 20,
        max: 26,
        label: "Faixa de conforto",
    };

    function createDefaults(colors) {
        return {
            responsive: true,
            maintainAspectRatio: false,
            animation: { duration: 600, easing: 'easeInOutQuart' },
            interaction: {
                mode: 'index',
                intersect: false,
                axis: 'x'
            },
            hover: {
                mode: 'index',
                intersect: false
            },
            plugins: {
                legend: { display: false },
                tooltip: {
                    mode: 'index',
                    intersect: false,
                    displayColors: false,
                    backgroundColor: '#1a2234',
                    borderColor: 'rgba(99,132,200,0.3)',
                    borderWidth: 1,
                    titleColor: '#94a3b8',
                    bodyColor: '#f1f5f9',
                    padding: 10,
                    cornerRadius: 8,
                }
            },
            scales: {
                x: {
                    grid: { color: colors.grid, drawBorder: false },
                    ticks: {
                        color: colors.text,
                        font: { size: 11 },
                        minRotation: 45,
                        maxRotation: 45,
                    },
                },
                y: {
                    grid: { color: colors.grid, drawBorder: false },
                    ticks: { color: colors.text, font: { size: 11 } },
                }
            }
        };
    }

    function mergeDeep(target, source) {
        const result = { ...target };
        for (const key of Object.keys(source)) {
            if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
                result[key] = mergeDeep(target[key] || {}, source[key]);
            } else {
                result[key] = source[key];
            }
        }
        return result;
    }

    function shouldShowComfortBand(key, suffix) {
        const normalizedKey = key.toLowerCase();
        if (suffix === "%" && (
            normalizedKey.includes("umidade") ||
            normalizedKey.includes("humidity")
        )) {
            return true;
        }

        return suffix === "°" && (
            normalizedKey.includes("temperatura") ||
            normalizedKey.includes("sensacao")
        );
    }

    function getNumericValue(value) {
        if (value === null || value === undefined || value === "") return null;
        const number = Number(value);
        return Number.isFinite(number) ? number : null;
    }

    function getDataScaleBounds(values) {
        const numericValues = (values || [])
            .map(getNumericValue)
            .filter(value => value !== null);

        if (!numericValues.length) return {};

        const min = Math.min(...numericValues);
        const max = Math.max(...numericValues);
        const range = max - min;
        const padding = range > 0 ? Math.max(range * 0.12, 0.1) : 1;

        return {
            min: min - padding,
            max: max + padding,
        };
    }

    function formatAxisTick(value, suffix) {
        const number = Number(value);
        if (!Number.isFinite(number)) return value;

        const absolute = Math.abs(number);
        const decimals = absolute < 10 ? 2 : 1;
        const formatted = number
            .toFixed(decimals)
            .replace(/\.?0+$/, "");

        return `${formatted}${suffix || ""}`;
    }

    const comfortBandPlugin = {
        id: "comfortBand",
        beforeDatasetsDraw(chart) {
            const band = chart.$comfortBand;
            const yScale = chart.scales.y;
            const area = chart.chartArea;
            if (!band || !yScale || !area) return;

            const visibleMin = Math.min(yScale.min, yScale.max);
            const visibleMax = Math.max(yScale.min, yScale.max);
            const bandMin = Math.max(band.min, visibleMin);
            const bandMax = Math.min(band.max, visibleMax);
            if (bandMin >= bandMax) return;

            const yMin = yScale.getPixelForValue(bandMin);
            const yMax = yScale.getPixelForValue(bandMax);
            const top = Math.min(yMin, yMax);
            const height = Math.abs(yMax - yMin);
            if (height <= 0) return;

            const ctx = chart.ctx;
            ctx.save();
            ctx.fillStyle = "rgba(52, 211, 153, 0.08)";
            ctx.fillRect(area.left, top, area.right - area.left, height);
            ctx.strokeStyle = "rgba(52, 211, 153, 0.20)";
            ctx.setLineDash([4, 4]);
            ctx.beginPath();
            if (band.min >= visibleMin && band.min <= visibleMax) {
                const lineMin = yScale.getPixelForValue(band.min);
                ctx.moveTo(area.left, lineMin);
                ctx.lineTo(area.right, lineMin);
            }
            if (band.max >= visibleMin && band.max <= visibleMax) {
                const lineMax = yScale.getPixelForValue(band.max);
                ctx.moveTo(area.left, lineMax);
                ctx.lineTo(area.right, lineMax);
            }
            ctx.stroke();
            ctx.restore();
        }
    };

    function registerComfortBand() {
        if (window.Chart && typeof window.Chart.register === "function") {
            window.Chart.register(comfortBandPlugin);
        }
    }

    function createLineChart({
        canvasCtx,
        data,
        key,
        label,
        color,
        yAxisTitle,
        yAxisSuffix = "",
        existingChart,
        defaults,
        colors,
        comfortBand = DEFAULT_COMFORT_BAND,
        onEmpty,
        onReady
    }) {
        if (existingChart) existingChart.destroy();

        const { hours, [key]: chartData } = ClimateData.extractData(data, [key]);

        const hasPoints = Array.isArray(chartData) && chartData.some(value => getNumericValue(value) !== null);
        if (!hasPoints) {
            canvasCtx.clearRect(0, 0, canvasCtx.canvas.width, canvasCtx.canvas.height);
            if (onEmpty) onEmpty();
            return null;
        }

        if (onReady) onReady();
        if (!window.Chart) return null;

        const gradient = canvasCtx.createLinearGradient(0, 0, 0, 220);
        gradient.addColorStop(0, color + '33');
        gradient.addColorStop(1, color + '00');
        const showComfortBand = shouldShowComfortBand(key, yAxisSuffix);
        const dataBounds = getDataScaleBounds(chartData);

        const options = mergeDeep(defaults, {
            plugins: {
                tooltip: {
                    callbacks: {
                        label: context => {
                            const value = context.parsed.y;
                            const formatted = Number.isFinite(value) ? value.toFixed(2) : "--";
                            return `${context.dataset.label || label}: ${formatted}${yAxisSuffix || ""}`;
                        }
                    }
                }
            },
            scales: {
                y: {
                    min: dataBounds.min,
                    max: dataBounds.max,
                    title: {
                        display: !!yAxisTitle,
                        text: yAxisTitle,
                        color: colors.text,
                        font: { size: 11 }
                    },
                    ticks: {
                        precision: 1,
                        callback: v => formatAxisTick(v, yAxisSuffix)
                    }
                }
            }
        });

        const chart = new Chart(canvasCtx, {
            type: "line",
            data: {
                labels: ClimateData.formatHoursArray(hours),
                datasets: [{
                    label,
                    data: chartData,
                    borderColor: color,
                    borderWidth: 2,
                    backgroundColor: gradient,
                    fill: true,
                    tension: 0.4,
                    pointRadius: 0,
                    pointHitRadius: 18,
                    pointHoverRadius: 6,
                    pointHoverBackgroundColor: color,
                    pointHoverBorderColor: '#0b1120',
                    pointHoverBorderWidth: 2,
                }]
            },
            options
        });

        if (showComfortBand) {
            chart.$comfortBand = comfortBand;
            chart.update();
        }

        return chart;
    }

    window.ClimateCharts = {
        createDefaults,
        createLineChart,
        mergeDeep,
        registerComfortBand,
    };
})();
