'use strict';

(function () {
    let zoomOverlay = null;

    function closeZoom() {
        if (!zoomOverlay) return;
        const zoomChart = zoomOverlay._chart;
        if (zoomChart) zoomChart.destroy();
        zoomOverlay.remove();
        zoomOverlay = null;
    }

    function cloneChartData(sourceChart) {
        return {
            labels: sourceChart.data.labels ? [...sourceChart.data.labels] : undefined,
            datasets: sourceChart.data.datasets.map(dataset => ({
                type: dataset.type,
                label: dataset.label,
                data: Array.isArray(dataset.data)
                    ? dataset.data.map(item => item && typeof item === "object" ? { ...item } : item)
                    : dataset.data,
                yAxisID: dataset.yAxisID,
                borderColor: dataset.borderColor,
                backgroundColor: Array.isArray(dataset.backgroundColor) || typeof dataset.backgroundColor === "string"
                    ? dataset.backgroundColor
                    : "transparent",
                fill: dataset.fill,
                tension: dataset.tension,
                borderWidth: dataset.borderWidth,
                pointRadius: dataset.pointRadius,
                pointHitRadius: dataset.pointHitRadius || 18,
                pointHoverRadius: dataset.pointHoverRadius || 6,
                pointBackgroundColor: dataset.pointBackgroundColor,
                pointBorderColor: dataset.pointBorderColor,
                pointHoverBackgroundColor: dataset.pointHoverBackgroundColor,
                pointHoverBorderColor: dataset.pointHoverBorderColor,
                pointHoverBorderWidth: dataset.pointHoverBorderWidth,
                showLine: dataset.showLine,
                order: dataset.order,
                parsing: dataset.parsing,
            }))
        };
    }

    function createZoomChart({ sourceChart, targetCtx, getZoomOptions }) {
        const sourceId = sourceChart.canvas.id;
        const solarTodayId = window.AppConfig.ids.charts.solarToday;
        const config = {
            type: sourceChart.config.type || "line",
            data: cloneChartData(sourceChart),
            options: getZoomOptions(sourceId),
            plugins: sourceId === solarTodayId ? [ClimateSolar.solarDayBackgroundPlugin] : []
        };

        const zoomChart = new Chart(targetCtx, config);
        if (sourceId === solarTodayId) {
            zoomChart.$solarDayTimes = sourceChart.$solarDayTimes;
        }
        if (sourceChart.$comfortBand) {
            zoomChart.$comfortBand = sourceChart.$comfortBand;
            zoomChart.update();
        }
        zoomOverlay._chart = zoomChart;
        return zoomChart;
    }

    function handleZoom(card, { chartInstances, getZoomOptions }) {
        closeZoom();

        const sourceCanvas = card.querySelector("canvas");
        if (!sourceCanvas) return;

        const sourceChart = chartInstances[sourceCanvas.id];
        if (!sourceChart) return;

        const overlay = document.createElement("div");
        overlay.className = "plot-zoom-overlay";

        const clone = card.cloneNode(false);
        const label = card.querySelector(".chart-label");
        const zoomCanvas = document.createElement("canvas");
        zoomCanvas.className = "plot plot--zoom";
        zoomCanvas.setAttribute("aria-label", sourceCanvas.getAttribute("aria-label") || "Gráfico ampliado");
        zoomCanvas.setAttribute("role", "img");

        if (label) clone.appendChild(label.cloneNode(true));
        clone.appendChild(zoomCanvas);
        overlay.appendChild(clone);

        overlay.addEventListener("click", event => {
            if (event.target.closest(".chart-card")) closeZoom();
        });

        zoomOverlay = overlay;
        document.body.appendChild(overlay);
        createZoomChart({ sourceChart, targetCtx: zoomCanvas.getContext("2d"), getZoomOptions });
        window.scrollTo({ top: 0, behavior: "smooth" });
    }

    function createZoomButton(card, zoomOptions) {
        if (card.querySelector(".chart-zoom-button")) return;

        const button = document.createElement("button");
        button.type = "button";
        button.className = "chart-zoom-button";
        button.setAttribute("aria-label", "Ampliar gráfico");
        button.innerHTML = `
            <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
                <path d="M15 3h6v6"/>
                <path d="M21 3l-7 7"/>
                <path d="M9 21H3v-6"/>
                <path d="M3 21l7-7"/>
            </svg>
        `;
        button.addEventListener("click", event => {
            event.stopPropagation();
            handleZoom(card, zoomOptions);
        });

        card.appendChild(button);
    }

    function setup(zoomOptions) {
        document.addEventListener("keydown", event => {
            if (event.key === "Escape") closeZoom();
        });

        document.querySelectorAll(".chart-card").forEach(card => {
            card.classList.add("chart-card--zoomable");
            card.title = "Dê duplo clique ou use o botão para ampliar";
            createZoomButton(card, zoomOptions);
            card.addEventListener("dblclick", () => handleZoom(card, zoomOptions));
        });
    }

    window.ClimateZoom = {
        closeZoom,
        setup,
    };
})();
