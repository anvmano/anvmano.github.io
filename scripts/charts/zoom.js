'use strict';

(function () {
    let sobreposicaoAmpliacao = null;
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

    async function abrirZoom(card, opcoesAmpliacao, disparador) {
        try {
            await garantirEstilosZoom();
            tratarAmpliacao(card, opcoesAmpliacao, disparador);
        } catch (erro) {
            window.ClimateDiagnostics?.erro("Falha ao preparar o zoom do gráfico.", erro);
        }
    }

    function registrarFechamentoPorEscape() {
        if (eventoEscapeRegistrado) return;

        document.addEventListener("keydown", evento => {
            if (evento.key === "Escape") fecharAmpliacao();
        });
        eventoEscapeRegistrado = true;
    }

    function ehDispositivoToque() {
        return window.matchMedia("(pointer: coarse)").matches || navigator.maxTouchPoints > 0;
    }

    function fecharAmpliacao({ restaurarFoco = true } = {}) {
        if (!sobreposicaoAmpliacao) return;
        const disparadorAnterior = disparadorZoom;
        const graficoAmpliado = sobreposicaoAmpliacao._chart;
        if (graficoAmpliado) graficoAmpliado.destroy();
        sobreposicaoAmpliacao.remove();
        sobreposicaoAmpliacao = null;
        disparadorZoom = null;

        if (restaurarFoco && disparadorAnterior?.isConnected) {
            requestAnimationFrame(() => disparadorAnterior.focus({ preventScroll: true }));
        }
    }

    function copiarDadosGrafico(graficoOrigem) {
        return {
            labels: graficoOrigem.data.labels ? [...graficoOrigem.data.labels] : undefined,
            datasets: graficoOrigem.data.datasets.map(serieGrafico => ({
                type: serieGrafico.type,
                label: serieGrafico.label,
                data: Array.isArray(serieGrafico.data)
                    ? serieGrafico.data.map(item => item && typeof item === "object" ? { ...item } : item)
                    : serieGrafico.data,
                yAxisID: serieGrafico.yAxisID,
                borderColor: serieGrafico.borderColor,
                borderDash: serieGrafico.borderDash,
                backgroundColor: Array.isArray(serieGrafico.backgroundColor) || typeof serieGrafico.backgroundColor === "string"
                    ? serieGrafico.backgroundColor
                    : "transparent",
                fill: serieGrafico.fill,
                tension: serieGrafico.tension,
                borderWidth: serieGrafico.borderWidth,
                pointRadius: serieGrafico.pointRadius,
                pointHitRadius: serieGrafico.pointHitRadius || 18,
                pointHoverRadius: serieGrafico.pointHoverRadius || 6,
                pointBackgroundColor: serieGrafico.pointBackgroundColor,
                pointBorderColor: serieGrafico.pointBorderColor,
                pointHoverBackgroundColor: serieGrafico.pointHoverBackgroundColor,
                pointHoverBorderColor: serieGrafico.pointHoverBorderColor,
                pointHoverBorderWidth: serieGrafico.pointHoverBorderWidth,
                showLine: serieGrafico.showLine,
                spanGaps: serieGrafico.spanGaps,
                order: serieGrafico.order,
                parsing: serieGrafico.parsing,
                tipoDado: serieGrafico.tipoDado,
            }))
        };
    }

    function criarGraficoAmpliado({ sourceChart: graficoOrigem, targetCtx: contextoDestino, getZoomOptions: obterOpcoesAmpliacao }) {
        const idOrigem = graficoOrigem.canvas.id;
        const eGraficoSolar = Boolean(graficoOrigem.$solarDayTimes);
        const plugins = [];
        if (eGraficoSolar) plugins.push(ClimateSolar.solarDayBackgroundPlugin);
        if (Array.isArray(graficoOrigem.$zoomPlugins)) plugins.push(...graficoOrigem.$zoomPlugins);
        const configuracao = {
            type: graficoOrigem.config.type || "line",
            data: copiarDadosGrafico(graficoOrigem),
            options: obterOpcoesAmpliacao?.(idOrigem) || {},
            plugins,
        };

        const graficoAmpliado = new Chart(contextoDestino, configuracao);
        if (eGraficoSolar) {
            graficoAmpliado.$solarDayTimes = graficoOrigem.$solarDayTimes;
        }
        if (graficoOrigem.$comfortBand) {
            graficoAmpliado.$comfortBand = graficoOrigem.$comfortBand;
            graficoAmpliado.update();
        }
        if (graficoOrigem.$marcadorAgora) {
            graficoAmpliado.$marcadorAgora = { ...graficoOrigem.$marcadorAgora };
            graficoAmpliado.update("none");
        }
        sobreposicaoAmpliacao._chart = graficoAmpliado;
        return graficoAmpliado;
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

    function tratarAmpliacao(card, { chartInstances: instanciasGraficos, getZoomOptions: obterOpcoesAmpliacao }, disparador = document.activeElement) {
        fecharAmpliacao({ restaurarFoco: false });

        const canvasOrigem = card.querySelector("canvas");
        if (!canvasOrigem) return;

        const graficoOrigem = instanciasGraficos[canvasOrigem.id];
        if (!graficoOrigem) return;

        const sobreposicao = document.createElement("div");
        sobreposicao.className = "plot-zoom-overlay";
        sobreposicao.setAttribute("role", "dialog");
        sobreposicao.setAttribute("aria-modal", "true");
        sobreposicao.setAttribute("tabindex", "-1");
        if (ehDispositivoToque()) {
            sobreposicao.classList.add("plot-zoom-overlay--touch");
        }

        const cardAmpliado = card.cloneNode(false);
        const rotulo = card.querySelector(".chart-label");
        const botaoFechar = document.createElement("button");
        const canvasAmpliado = document.createElement("canvas");
        botaoFechar.type = "button";
        botaoFechar.className = "plot-zoom-close";
        botaoFechar.setAttribute("aria-label", "Fechar gráfico ampliado");
        botaoFechar.innerHTML = "&times;";
        canvasAmpliado.className = "plot plot--zoom";
        canvasAmpliado.setAttribute("aria-label", canvasOrigem.getAttribute("aria-label") || "Gráfico ampliado");
        canvasAmpliado.setAttribute("role", "img");

        if (rotulo) {
            const rotuloAmpliado = rotulo.cloneNode(true);
            rotuloAmpliado.id = `zoom-chart-label-${canvasOrigem.id}`;
            sobreposicao.setAttribute("aria-labelledby", rotuloAmpliado.id);
            cardAmpliado.appendChild(rotuloAmpliado);
        } else {
            sobreposicao.setAttribute("aria-label", canvasOrigem.getAttribute("aria-label") || "Gráfico ampliado");
        }
        cardAmpliado.appendChild(botaoFechar);
        cardAmpliado.appendChild(canvasAmpliado);
        sobreposicao.appendChild(cardAmpliado);

        const fecharSeFundo = evento => {
            if (evento.target === sobreposicao) fecharAmpliacao();
        };

        sobreposicao.addEventListener("pointerdown", fecharSeFundo);
        sobreposicao.addEventListener("click", fecharSeFundo);
        cardAmpliado.addEventListener("pointerdown", evento => evento.stopPropagation());
        cardAmpliado.addEventListener("touchstart", evento => evento.stopPropagation(), { passive: true });
        canvasAmpliado.addEventListener("pointerdown", evento => evento.stopPropagation());
        canvasAmpliado.addEventListener("touchstart", evento => evento.stopPropagation(), { passive: true });
        botaoFechar.addEventListener("click", evento => {
            evento.stopPropagation();
            fecharAmpliacao();
        });
        sobreposicao.addEventListener("keydown", evento => conterFocoNoDialogo(evento, sobreposicao));

        disparadorZoom = disparador instanceof HTMLElement ? disparador : null;
        sobreposicaoAmpliacao = sobreposicao;
        document.body.appendChild(sobreposicao);
        criarGraficoAmpliado({ sourceChart: graficoOrigem, targetCtx: canvasAmpliado.getContext("2d"), getZoomOptions: obterOpcoesAmpliacao });
        botaoFechar.focus({ preventScroll: true });
    }

    function criarBotaoAmpliacao(card, opcoesAmpliacao) {
        if (card.querySelector(".chart-zoom-button")) return;

        const botao = document.createElement("button");
        botao.type = "button";
        botao.className = "chart-zoom-button";
        botao.setAttribute("aria-label", "Ampliar gráfico");
        botao.innerHTML = `
            <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
                <path d="M15 3h6v6"/>
                <path d="M21 3l-7 7"/>
                <path d="M9 21H3v-6"/>
                <path d="M3 21l7-7"/>
            </svg>
        `;
        botao.addEventListener("click", evento => {
            evento.stopPropagation();
            void abrirZoom(card, opcoesAmpliacao, botao);
        });

        card.appendChild(botao);
    }

    function configurarModulo(opcoesAmpliacao) {
        registrarFechamentoPorEscape();
        registrarCards(document, opcoesAmpliacao);
    }

    function registrarCards(raiz = document, opcoesAmpliacao) {
        registrarFechamentoPorEscape();
        raiz.querySelectorAll(".chart-card").forEach(card => {
            if (card.dataset.zoomRegistrado === "true") return;
            card.dataset.zoomRegistrado = "true";
            card.classList.add("chart-card--zoomable");
            card.removeAttribute("title");
            criarBotaoAmpliacao(card, opcoesAmpliacao);
            card.addEventListener("dblclick", () => {
                const botaoZoom = card.querySelector(".chart-zoom-button");
                void abrirZoom(card, opcoesAmpliacao, botaoZoom || card);
            });
        });
    }

    window.ClimateZoom = {
        closeZoom: fecharAmpliacao,
        setup: configurarModulo,
        registrarCards,
    };
})();
