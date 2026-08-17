'use strict';

(function () {
    let zoomOverlay = null;
    let disparadorZoom = null;
    let eventoEscapeRegistrado = false;
    let carregamentoEstilosZoom = null;

    function garantirEstilosZoom() {
        if (!carregamentoEstilosZoom) {
            carregamentoEstilosZoom = window.ClimateAssets?.carregarCssZoom?.()
                || Promise.reject(new Error("Carregador dos estilos de zoom indisponível."));
            carregamentoEstilosZoom = carregamentoEstilosZoom.catch(erro => {
                carregamentoEstilosZoom = null;
                throw erro;
            });
        }
        return carregamentoEstilosZoom;
    }

    async function abrirZoom(card, zoomOptions, disparador) {
        try {
            await garantirEstilosZoom();
            handleZoom(card, zoomOptions, disparador);
        } catch (erro) {
            window.ClimateDiagnostics?.erro("Falha ao preparar o zoom do gráfico.", erro);
        }
    }

    function registrarFechamentoPorEscape() {
        if (eventoEscapeRegistrado) return;

        document.addEventListener("keydown", event => {
            if (event.key === "Escape") closeZoom();
        });
        eventoEscapeRegistrado = true;
    }

    function isTouchDevice() {
        return window.matchMedia("(pointer: coarse)").matches || navigator.maxTouchPoints > 0;
    }

    function closeZoom({ restaurarFoco = true } = {}) {
        if (!zoomOverlay) return;
        const disparadorAnterior = disparadorZoom;
        const zoomChart = zoomOverlay._chart;
        if (zoomChart) zoomChart.destroy();
        zoomOverlay.remove();
        zoomOverlay = null;
        disparadorZoom = null;

        if (restaurarFoco && disparadorAnterior?.isConnected) {
            requestAnimationFrame(() => disparadorAnterior.focus({ preventScroll: true }));
        }
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
                borderDash: dataset.borderDash,
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
                spanGaps: dataset.spanGaps,
                order: dataset.order,
                parsing: dataset.parsing,
                tipoDado: dataset.tipoDado,
            }))
        };
    }

    function createZoomChart({ sourceChart, targetCtx, getZoomOptions }) {
        const sourceId = sourceChart.canvas.id;
        const eGraficoSolar = Boolean(sourceChart.$solarDayTimes);
        const plugins = [];
        if (eGraficoSolar) plugins.push(ClimateSolar.solarDayBackgroundPlugin);
        if (Array.isArray(sourceChart.$zoomPlugins)) plugins.push(...sourceChart.$zoomPlugins);
        const config = {
            type: sourceChart.config.type || "line",
            data: cloneChartData(sourceChart),
            options: getZoomOptions?.(sourceId) || {},
            plugins,
        };

        const zoomChart = new Chart(targetCtx, config);
        if (eGraficoSolar) {
            zoomChart.$solarDayTimes = sourceChart.$solarDayTimes;
        }
        if (sourceChart.$comfortBand) {
            zoomChart.$comfortBand = sourceChart.$comfortBand;
            zoomChart.update();
        }
        if (sourceChart.$marcadorAgora) {
            zoomChart.$marcadorAgora = { ...sourceChart.$marcadorAgora };
            zoomChart.update("none");
        }
        zoomOverlay._chart = zoomChart;
        return zoomChart;
    }

    function conterFocoNoDialogo(evento, dialogo) {
        if (evento.key !== "Tab") return;

        const focaveis = Array.from(dialogo.querySelectorAll(
            'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
        )).filter(elemento => !elemento.hasAttribute("hidden"));
        if (!focaveis.length) {
            evento.preventDefault();
            dialogo.focus();
            return;
        }

        const primeiro = focaveis[0];
        const ultimo = focaveis[focaveis.length - 1];
        const focoAtual = document.activeElement;
        if (evento.shiftKey && (focoAtual === primeiro || !dialogo.contains(focoAtual))) {
            evento.preventDefault();
            ultimo.focus();
        } else if (!evento.shiftKey && (focoAtual === ultimo || !dialogo.contains(focoAtual))) {
            evento.preventDefault();
            primeiro.focus();
        }
    }

    function handleZoom(card, { chartInstances, getZoomOptions }, disparador = document.activeElement) {
        closeZoom({ restaurarFoco: false });

        const sourceCanvas = card.querySelector("canvas");
        if (!sourceCanvas) return;

        const sourceChart = chartInstances[sourceCanvas.id];
        if (!sourceChart) return;

        const overlay = document.createElement("div");
        overlay.className = "plot-zoom-overlay";
        overlay.setAttribute("role", "dialog");
        overlay.setAttribute("aria-modal", "true");
        overlay.setAttribute("tabindex", "-1");
        if (isTouchDevice()) {
            overlay.classList.add("plot-zoom-overlay--touch");
        }

        const clone = card.cloneNode(false);
        const label = card.querySelector(".chart-label");
        const closeButton = document.createElement("button");
        const zoomCanvas = document.createElement("canvas");
        closeButton.type = "button";
        closeButton.className = "plot-zoom-close";
        closeButton.setAttribute("aria-label", "Fechar gráfico ampliado");
        closeButton.innerHTML = "&times;";
        zoomCanvas.className = "plot plot--zoom";
        zoomCanvas.setAttribute("aria-label", sourceCanvas.getAttribute("aria-label") || "Gráfico ampliado");
        zoomCanvas.setAttribute("role", "img");

        if (label) {
            const rotuloAmpliado = label.cloneNode(true);
            rotuloAmpliado.id = `zoom-chart-label-${sourceCanvas.id}`;
            overlay.setAttribute("aria-labelledby", rotuloAmpliado.id);
            clone.appendChild(rotuloAmpliado);
        } else {
            overlay.setAttribute("aria-label", sourceCanvas.getAttribute("aria-label") || "Gráfico ampliado");
        }
        clone.appendChild(closeButton);
        clone.appendChild(zoomCanvas);
        overlay.appendChild(clone);

        const fecharSeFundo = event => {
            if (event.target === overlay) closeZoom();
        };

        overlay.addEventListener("pointerdown", fecharSeFundo);
        overlay.addEventListener("click", fecharSeFundo);
        clone.addEventListener("pointerdown", event => event.stopPropagation());
        clone.addEventListener("touchstart", event => event.stopPropagation(), { passive: true });
        zoomCanvas.addEventListener("pointerdown", event => event.stopPropagation());
        zoomCanvas.addEventListener("touchstart", event => event.stopPropagation(), { passive: true });
        closeButton.addEventListener("click", event => {
            event.stopPropagation();
            closeZoom();
        });
        overlay.addEventListener("keydown", event => conterFocoNoDialogo(event, overlay));

        disparadorZoom = disparador instanceof HTMLElement ? disparador : null;
        zoomOverlay = overlay;
        document.body.appendChild(overlay);
        createZoomChart({ sourceChart, targetCtx: zoomCanvas.getContext("2d"), getZoomOptions });
        closeButton.focus({ preventScroll: true });
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
            void abrirZoom(card, zoomOptions, button);
        });

        card.appendChild(button);
    }

    function setup(zoomOptions) {
        registrarFechamentoPorEscape();
        registrarCards(document, zoomOptions);
    }

    function registrarCards(raiz = document, zoomOptions) {
        registrarFechamentoPorEscape();
        raiz.querySelectorAll(".chart-card").forEach(card => {
            if (card.dataset.zoomRegistrado === "true") return;
            card.dataset.zoomRegistrado = "true";
            card.classList.add("chart-card--zoomable");
            card.removeAttribute("title");
            createZoomButton(card, zoomOptions);
            card.addEventListener("dblclick", () => {
                const botaoZoom = card.querySelector(".chart-zoom-button");
                void abrirZoom(card, zoomOptions, botaoZoom || card);
            });
        });
    }

    window.ClimateZoom = {
        closeZoom,
        setup,
        registrarCards,
    };
})();
