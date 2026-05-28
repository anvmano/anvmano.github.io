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
                    ticks: { color: colors.text, font: { size: 11 } },
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
        return suffix === "°" && (
            normalizedKey.includes("temperatura") ||
            normalizedKey.includes("sensacao")
        );
    }

    const comfortBandPlugin = {
        id: "comfortBand",
        beforeDatasetsDraw(chart) {
            const band = chart.$comfortBand;
            const yScale = chart.scales.y;
            const area = chart.chartArea;
            if (!band || !yScale || !area) return;

            const yMin = yScale.getPixelForValue(band.min);
            const yMax = yScale.getPixelForValue(band.max);
            const top = Math.min(yMin, yMax);
            const height = Math.abs(yMax - yMin);

            const ctx = chart.ctx;
            ctx.save();
            ctx.fillStyle = "rgba(52, 211, 153, 0.08)";
            ctx.fillRect(area.left, top, area.right - area.left, height);
            ctx.strokeStyle = "rgba(52, 211, 153, 0.20)";
            ctx.setLineDash([4, 4]);
            ctx.beginPath();
            ctx.moveTo(area.left, yMin);
            ctx.lineTo(area.right, yMin);
            ctx.moveTo(area.left, yMax);
            ctx.lineTo(area.right, yMax);
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
        todasDatas,
        existingChart,
        defaults,
        colors,
        comfortBand = DEFAULT_COMFORT_BAND
    }) {
        if (existingChart) existingChart.destroy();

        const { hours, [key]: chartData } = ClimateData.extractData(data, [key], todasDatas);

        const gradient = canvasCtx.createLinearGradient(0, 0, 0, 220);
        gradient.addColorStop(0, color + '33');
        gradient.addColorStop(1, color + '00');

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
                    title: {
                        display: !!yAxisTitle,
                        text: yAxisTitle,
                        color: colors.text,
                        font: { size: 11 }
                    },
                    ticks: {
                        precision: 1,
                        callback: v => v + (yAxisSuffix || "")
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

        if (shouldShowComfortBand(key, yAxisSuffix)) {
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
