'use strict';

(function () {
    const FAIXA_CONFORTO_PADRAO = {
        min: 20,
        max: 26,
        label: "Faixa de conforto",
    };

    function criarPadroes(cores) {
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
            onHover: (evento, elementosAtivos, grafico) => {
                window.ClimateChartSync?.tratarInteracao(grafico, evento, elementosAtivos);
            },
            onClick: (evento, elementosAtivos, grafico) => {
                window.ClimateChartSync?.tratarInteracao(grafico, evento, elementosAtivos);
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
                    grid: { color: cores.grid, drawBorder: false },
                    ticks: {
                        color: cores.text,
                        font: { size: 11 },
                        minRotation: 45,
                        maxRotation: 45,
                    },
                },
                y: {
                    grid: { color: cores.grid, drawBorder: false },
                    ticks: { color: cores.text, font: { size: 11 } },
                }
            }
        };
    }

    function mesclarRecursivamente(destino, origem) {
        const resultado = { ...destino };
        for (const chave of Object.keys(origem)) {
            if (origem[chave] && typeof origem[chave] === 'object' && !Array.isArray(origem[chave])) {
                resultado[chave] = mesclarRecursivamente(destino[chave] || {}, origem[chave]);
            } else {
                resultado[chave] = origem[chave];
            }
        }
        return resultado;
    }

    function deveMostrarFaixaConforto(chave, sufixo) {
        const chaveNormalizada = chave.toLowerCase();
        if (sufixo === "%" && (
            chaveNormalizada.includes("umidade") ||
            chaveNormalizada.includes("humidity")
        )) {
            return true;
        }

        return sufixo === "°" && (
            chaveNormalizada.includes("temperatura") ||
            chaveNormalizada.includes("sensacao")
        );
    }

    function obterValorNumerico(valor) {
        if (valor === null || valor === undefined || valor === "") return null;
        const numero = Number(valor);
        return Number.isFinite(numero) ? numero : null;
    }

    function obterLimitesEscalaDados(valores) {
        const valoresNumericos = (valores || [])
            .map(obterValorNumerico)
            .filter(valor => valor !== null);

        if (!valoresNumericos.length) return {};

        const minimo = Math.min(...valoresNumericos);
        const maximo = Math.max(...valoresNumericos);
        const intervalo = maximo - minimo;
        const espacamento = intervalo > 0 ? Math.max(intervalo * 0.12, 0.1) : 1;

        return {
            min: minimo - espacamento,
            max: maximo + espacamento,
        };
    }

    function formatarMarcadorEixo(valor, sufixo) {
        const numero = Number(valor);
        if (!Number.isFinite(numero)) return valor;

        const valorAbsoluto = Math.abs(numero);
        const casasDecimais = valorAbsoluto < 10 ? 2 : 1;
        const formatado = numero
            .toFixed(casasDecimais)
            .replace(/\.?0+$/, "");

        return `${formatado}${sufixo || ""}`;
    }

    const pluginFaixaConforto = {
        id: "comfortBand",
        beforeDatasetsDraw(grafico) {
            const faixa = grafico.$comfortBand;
            const escalaY = grafico.scales.y;
            const areaDesenho = grafico.chartArea;
            if (!faixa || !escalaY || !areaDesenho) return;

            const minimoVisivel = Math.min(escalaY.min, escalaY.max);
            const maximoVisivel = Math.max(escalaY.min, escalaY.max);
            const minimoFaixa = Math.max(faixa.min, minimoVisivel);
            const maximoFaixa = Math.min(faixa.max, maximoVisivel);
            if (minimoFaixa >= maximoFaixa) return;

            const minimoY = escalaY.getPixelForValue(minimoFaixa);
            const maximoY = escalaY.getPixelForValue(maximoFaixa);
            const topo = Math.min(minimoY, maximoY);
            const altura = Math.abs(maximoY - minimoY);
            if (altura <= 0) return;

            const contextoDesenho = grafico.ctx;
            contextoDesenho.save();
            contextoDesenho.fillStyle = "rgba(52, 211, 153, 0.08)";
            contextoDesenho.fillRect(areaDesenho.left, topo, areaDesenho.right - areaDesenho.left, altura);
            contextoDesenho.strokeStyle = "rgba(52, 211, 153, 0.20)";
            contextoDesenho.setLineDash([4, 4]);
            contextoDesenho.beginPath();
            if (faixa.min >= minimoVisivel && faixa.min <= maximoVisivel) {
                const minimoLinha = escalaY.getPixelForValue(faixa.min);
                contextoDesenho.moveTo(areaDesenho.left, minimoLinha);
                contextoDesenho.lineTo(areaDesenho.right, minimoLinha);
            }
            if (faixa.max >= minimoVisivel && faixa.max <= maximoVisivel) {
                const maximoLinha = escalaY.getPixelForValue(faixa.max);
                contextoDesenho.moveTo(areaDesenho.left, maximoLinha);
                contextoDesenho.lineTo(areaDesenho.right, maximoLinha);
            }
            contextoDesenho.stroke();
            contextoDesenho.restore();
        }
    };

    function registrarFaixaConforto() {
        if (window.Chart && typeof window.Chart.register === "function") {
            window.Chart.register(pluginFaixaConforto);
        }
    }

    function criarGraficoLinha({
        canvasCtx: contextoCanvas,
        data: dados,
        key: chave,
        label: rotulo,
        color: cor,
        yAxisTitle: tituloEixoY,
        yAxisSuffix: sufixoEixoY = "",
        existingChart: graficoExistente,
        defaults: padroes,
        colors: cores,
        comfortBand: faixaConforto = FAIXA_CONFORTO_PADRAO,
        grupoSincronizacao,
        onEmpty: aoEstarVazio,
        onReady: aoEstarPronto
    }) {
        if (graficoExistente) {
            window.ClimateChartSync?.desregistrar(graficoExistente);
            graficoExistente.destroy();
        }

        const { hours: horas, [chave]: dadosGrafico } = ClimateData.extractData(dados, [chave]);

        const temPontos = Array.isArray(dadosGrafico) && dadosGrafico.some(valor => obterValorNumerico(valor) !== null);
        if (!temPontos) {
            contextoCanvas.clearRect(0, 0, contextoCanvas.canvas.width, contextoCanvas.canvas.height);
            if (aoEstarVazio) aoEstarVazio();
            return null;
        }

        if (aoEstarPronto) aoEstarPronto();
        if (!window.Chart) return null;

        const gradiente = contextoCanvas.createLinearGradient(0, 0, 0, 220);
        gradiente.addColorStop(0, cor + '33');
        gradiente.addColorStop(1, cor + '00');
        const mostrarFaixaConforto = deveMostrarFaixaConforto(chave, sufixoEixoY);
        const limitesDados = obterLimitesEscalaDados(dadosGrafico);

        const opcoes = mesclarRecursivamente(padroes, {
            plugins: {
                tooltip: {
                    callbacks: {
                        label: contexto => {
                            const valor = contexto.parsed.y;
                            const formatado = Number.isFinite(valor) ? valor.toFixed(2) : "--";
                            return `${contexto.dataset.label || rotulo}: ${formatado}${sufixoEixoY || ""}`;
                        }
                    }
                }
            },
            scales: {
                y: {
                    min: limitesDados.min,
                    max: limitesDados.max,
                    title: {
                        display: !!tituloEixoY,
                        text: tituloEixoY,
                        color: cores.text,
                        font: { size: 11 }
                    },
                    ticks: {
                        precision: 1,
                        callback: v => formatarMarcadorEixo(v, sufixoEixoY)
                    }
                }
            }
        });

        const grafico = new Chart(contextoCanvas, {
            type: "line",
            data: {
                labels: ClimateData.formatHoursArray(horas),
                datasets: [{
                    label: rotulo,
                    data: dadosGrafico,
                    borderColor: cor,
                    borderWidth: 2,
                    backgroundColor: gradiente,
                    fill: true,
                    tension: 0.4,
                    pointRadius: 0,
                    pointHitRadius: 18,
                    pointHoverRadius: 6,
                    pointHoverBackgroundColor: cor,
                    pointHoverBorderColor: '#0b1120',
                    pointHoverBorderWidth: 2,
                }]
            },
            options: opcoes
        });

        if (mostrarFaixaConforto) {
            grafico.$comfortBand = faixaConforto;
            grafico.update();
        }
        if (grupoSincronizacao) window.ClimateChartSync?.registrar(grafico, grupoSincronizacao);

        return grafico;
    }

    window.ClimateCharts = {
        createDefaults: criarPadroes,
        createLineChart: criarGraficoLinha,
        mergeDeep: mesclarRecursivamente,
        registerComfortBand: registrarFaixaConforto,
    };
})();
