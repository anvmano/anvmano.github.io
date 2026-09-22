'use strict';

(function () {
    const ALIASES_CAMPOS_SOLARES = {
        dawn: {
            hours: ["HoraAmanhecer", "HourAmanhecer"],
            minutes: ["MinuteAmanhecer", "MinutoAmanhecer"],
        },
        sunrise: {
            hours: ["HourNascerDoSol", "HoraNascerDoSol"],
            minutes: ["MinuteNascerDoSol", "MinutoNascerDoSol"],
        },
        sunset: {
            hours: ["HoraPorDoSol", "HourPorDoSol"],
            minutes: ["MinutePorDoSol", "MinutoPorDoSol"],
        },
        dusk: {
            hours: ["HourAnoitecer", "HoraAnoitecer"],
            minutes: ["MinuteAnoitecer", "MinutoAnoitecer"],
        },
        zenith: {
            hours: ["HoraZenite", "HourZenith", "HoraZenith", "HourZenite", "HoraZênite"],
            minutes: ["MinuteZenite", "MinutoZenite", "MinuteZenith", "MinutoZenith", "MinutoZênite"],
        },
    };

    function obterValorNumero(item, nomes) {
        for (const nome of nomes) {
            const valor = Number(item[nome]);
            if (Number.isFinite(valor)) return valor;
        }
        return null;
    }

    function lerHorarioSegundos(item, nomesHora, nomesMinuto) {
        const hora = obterValorNumero(item, nomesHora);
        const minuto = obterValorNumero(item, nomesMinuto) || 0;
        if (hora == null) return null;
        return hora * 3600 + minuto * 60;
    }

    function temCamposSolares(item) {
        return item &&
            typeof item === "object" &&
            (
                temAlgumAlias(item, ALIASES_CAMPOS_SOLARES.sunrise.hours) ||
                temAlgumAlias(item, ALIASES_CAMPOS_SOLARES.dawn.hours)
            );
    }

    function lerSegundosEventosSolares(item) {
        if (!item) return null;

        const amanhecerSolar = lerHorarioSegundosPorAlias(item, ALIASES_CAMPOS_SOLARES.dawn);
        const nascerSolar = lerHorarioSegundosPorAlias(item, ALIASES_CAMPOS_SOLARES.sunrise);
        const porSolar = lerHorarioSegundosPorAlias(item, ALIASES_CAMPOS_SOLARES.sunset);
        const anoitecerSolar = lerHorarioSegundosPorAlias(item, ALIASES_CAMPOS_SOLARES.dusk);
        const zeniteDosDados = lerHorarioSegundosPorAlias(item, ALIASES_CAMPOS_SOLARES.zenith);

        if ([amanhecerSolar, nascerSolar, porSolar, anoitecerSolar].some(valor => valor == null)) return null;

        return {
            dawn: amanhecerSolar,
            sunrise: nascerSolar,
            zenith: zeniteDosDados != null ? zeniteDosDados : nascerSolar + ((porSolar - nascerSolar) / 2),
            sunset: porSolar,
            dusk: anoitecerSolar,
        };
    }

    function lerHorarioSegundosPorAlias(item, apelidos) {
        return lerHorarioSegundos(item, apelidos.hours, apelidos.minutes);
    }

    function temAlgumAlias(item, nomes) {
        return nomes.some(nome => item[nome] != null);
    }

    function obterPrimeiroItemData(dados, dataReferencia) {
        const dadosData = dados[dataReferencia];
        if (!dadosData || typeof dadosData !== "object") return null;
        for (const chave of Object.keys(dadosData).sort().reverse()) {
            const item = dadosData[chave];
            if (!item || typeof item !== "object") continue;
            if (temCamposSolares(item)) {
                return item;
            }
            for (const chaveAninhada of Object.keys(item).sort().reverse()) {
                const itemAninhado = item[chaveAninhada];
                if (temCamposSolares(itemAninhado)) return itemAninhado;
            }
        }
        return null;
    }

    function obterEventosSolaresDataSelecionada(dados, dataSelecionada) {
        const item = dataSelecionada ? obterPrimeiroItemData(dados, dataSelecionada) : null;
        const segundosEventos = lerSegundosEventosSolares(item);
        if (!segundosEventos) return null;

        return {
            date: dataSelecionada,
            dawn: ClimateData.secondsToHours(segundosEventos.dawn),
            sunrise: ClimateData.secondsToHours(segundosEventos.sunrise),
            zenith: ClimateData.secondsToHours(segundosEventos.zenith),
            sunset: ClimateData.secondsToHours(segundosEventos.sunset),
            dusk: ClimateData.secondsToHours(segundosEventos.dusk)
        };
    }

    function obterDadosNascerPorSol(dados) {
        const datas = [], horariosNascer = [], horariosPor = [], horariosAmanhecer = [], horariosAnoitecer = [];

        for (const dataReferencia of Object.keys(dados).sort((a,b) => ClimateData.parseFirebaseDate(a)-ClimateData.parseFirebaseDate(b))) {
            const item = obterPrimeiroItemData(dados, dataReferencia);
            const segundosEventos = lerSegundosEventosSolares(item);
            if (!segundosEventos) continue;

            datas.push(dataReferencia);
            horariosNascer.push(segundosEventos.sunrise);
            horariosPor.push(segundosEventos.sunset);
            horariosAmanhecer.push(segundosEventos.dawn);
            horariosAnoitecer.push(segundosEventos.dusk);
        }
        return { dates: datas, sunriseTimes: horariosNascer, sunsetTimes: horariosPor, amanhecerTimes: horariosAmanhecer, anoitecerTimes: horariosAnoitecer };
    }

    function rotuloDica(contexto) {
        return `${contexto.dataset.label || ""}: ${ClimateData.formatTime(contexto.raw)}`;
    }

    function ordenarTooltipPorPosicaoVisual(a, b) {
        const pixelA = obterPixelTooltip(a);
        const pixelB = obterPixelTooltip(b);

        if (Number.isFinite(pixelA) && Number.isFinite(pixelB)) {
            return pixelA - pixelB;
        }

        const valorA = Number(a.parsed?.y);
        const valorB = Number(b.parsed?.y);
        if (!Number.isFinite(valorA)) return 1;
        if (!Number.isFinite(valorB)) return -1;
        return valorB - valorA;
    }

    function obterPixelTooltip(contexto) {
        const serieGrafico = contexto.chart?.data?.datasets?.[contexto.datasetIndex];
        const escala = contexto.chart?.scales?.[serieGrafico?.yAxisID || "y"];
        const valor = Number(contexto.parsed?.y);
        if (!escala || !Number.isFinite(valor)) return null;
        return escala.getPixelForValue(valor);
    }

    function obterOpcoesHistoricoSolar({ legend: legenda = true, tickSize: tamanhoMarcador = 11, labelSize: tamanhoRotulo = 11, defaults: padroes, colors: cores } = {}) {
        return {
            responsive: true,
            maintainAspectRatio: false,
            animation: { duration: 600 },
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
                legend: {
                    display: legenda,
                    position: 'top',
                    labels: { color: cores.text, font: { size: tamanhoRotulo }, boxWidth: 12, padding: 16 }
                },
                tooltip: {
                    ...padroes.plugins.tooltip,
                    mode: "index",
                    intersect: false,
                    itemSort: ordenarTooltipPorPosicaoVisual,
                    callbacks: { label: rotuloDica }
                }
            },
            scales: {
                x: {
                    grid:  { color: cores.grid, drawBorder: false },
                    ticks: { color: cores.text, font: { size: tamanhoMarcador }, maxRotation: 45 }
                },
                yLeft: {
                    type: "linear", position: "right",
                    min: 4, max: 7,
                    grid: { color: cores.grid, drawBorder: false },
                    ticks: { callback: ClimateData.formatTime, color: cores.text, font: { size: tamanhoMarcador } }
                },
                yRight: {
                    type: "linear", position: "left",
                    min: 17, max: 21,
                    grid: { drawOnChartArea: false },
                    ticks: { callback: ClimateData.formatTime, color: cores.text, font: { size: tamanhoMarcador } }
                }
            }
        };
    }

    function criarGraficoNascerPorSol({ data: dados, ctx: contextoDesenho, existingChart: graficoExistente, defaults: padroes, colors: cores, onEmpty: aoEstarVazio }) {
        const { dates: datas, sunriseTimes: horariosNascer, sunsetTimes: horariosPor, amanhecerTimes: horariosAmanhecer, anoitecerTimes: horariosAnoitecer } = obterDadosNascerPorSol(dados);
        const datasFormatadas = datas.map(d => d.replace(/-/g, "/"));
        const remapear = (listaValores, i1, i2, o1, o2) => listaValores.map(t => ClimateData.mapRange(t, i1, i2, o1, o2));

        if (graficoExistente) graficoExistente.destroy();

        if (!datas.length) {
            if (aoEstarVazio) aoEstarVazio();
            return null;
        }

        return new Chart(contextoDesenho, {
            type: "line",
            data: {
                labels: datasFormatadas,
                datasets: [
                    { label: "Amanhecer",     yAxisID: "yLeft",  data: remapear(horariosAmanhecer,14400,25200,4,7),  borderColor: "#fde68a", backgroundColor: "transparent", tension: 0.4, borderWidth: 2, pointRadius: 0, pointHitRadius: 18, pointHoverRadius: 6, order: 1 },
                    { label: "Nascer do sol", yAxisID: "yLeft",  data: remapear(horariosNascer,  14400,25200,4,7),  borderColor: "#fb923c", backgroundColor: "transparent", tension: 0.4, borderWidth: 2, pointRadius: 0, pointHitRadius: 18, pointHoverRadius: 6, order: 2 },
                    { label: "Pôr do sol",    yAxisID: "yRight", data: remapear(horariosPor,   61200,75600,17,21), borderColor: "#f87171", backgroundColor: "transparent", tension: 0.4, borderWidth: 2, pointRadius: 0, pointHitRadius: 18, pointHoverRadius: 6, order: 3 },
                    { label: "Anoitecer",     yAxisID: "yRight", data: remapear(horariosAnoitecer,61200,75600,17,21), borderColor: "#818cf8", backgroundColor: "transparent", tension: 0.4, borderWidth: 2, pointRadius: 0, pointHitRadius: 18, pointHoverRadius: 6, order: 4 }
                ]
            },
            options: obterOpcoesHistoricoSolar({ defaults: padroes, colors: cores })
        });
    }

    const pluginFundoDiaSolar = {
        id: "solarDayBackground",
        beforeDatasetsDraw(grafico) {
            const horarios = grafico.$solarDayTimes;
            const escalaX = grafico.scales.x;
            const areaDesenho = grafico.chartArea;
            if (!horarios || !escalaX || !areaDesenho) return;

            const contextoDesenho = grafico.ctx;
            const amanhecerX = escalaX.getPixelForValue(horarios.dawn);
            const nascerX = escalaX.getPixelForValue(horarios.sunrise);
            const zeniteX = escalaX.getPixelForValue(horarios.zenith);
            const porX = escalaX.getPixelForValue(horarios.sunset);
            const anoitecerX = escalaX.getPixelForValue(horarios.dusk);

            contextoDesenho.save();
            contextoDesenho.fillStyle = "rgba(15, 23, 42, 0.72)";
            contextoDesenho.fillRect(areaDesenho.left, areaDesenho.top, Math.max(0, amanhecerX - areaDesenho.left), areaDesenho.bottom - areaDesenho.top);
            contextoDesenho.fillRect(anoitecerX, areaDesenho.top, Math.max(0, areaDesenho.right - anoitecerX), areaDesenho.bottom - areaDesenho.top);

            const crepusculo = contextoDesenho.createLinearGradient(amanhecerX, 0, nascerX, 0);
            crepusculo.addColorStop(0, "rgba(148, 163, 184, 0.24)");
            crepusculo.addColorStop(1, "rgba(251, 191, 36, 0.22)");
            contextoDesenho.fillStyle = crepusculo;
            contextoDesenho.fillRect(amanhecerX, areaDesenho.top, Math.max(0, nascerX - amanhecerX), areaDesenho.bottom - areaDesenho.top);

            const luzDiurna = contextoDesenho.createLinearGradient(nascerX, 0, porX, 0);
            luzDiurna.addColorStop(0, "rgba(251, 191, 36, 0.20)");
            luzDiurna.addColorStop(0.5, "rgba(254, 240, 138, 0.38)");
            luzDiurna.addColorStop(1, "rgba(251, 191, 36, 0.20)");
            contextoDesenho.fillStyle = luzDiurna;
            contextoDesenho.fillRect(nascerX, areaDesenho.top, Math.max(0, porX - nascerX), areaDesenho.bottom - areaDesenho.top);

            const periodoNoturno = contextoDesenho.createLinearGradient(porX, 0, anoitecerX, 0);
            periodoNoturno.addColorStop(0, "rgba(251, 146, 60, 0.24)");
            periodoNoturno.addColorStop(1, "rgba(129, 140, 248, 0.18)");
            contextoDesenho.fillStyle = periodoNoturno;
            contextoDesenho.fillRect(porX, areaDesenho.top, Math.max(0, anoitecerX - porX), areaDesenho.bottom - areaDesenho.top);

            contextoDesenho.strokeStyle = "rgba(251, 191, 36, 0.35)";
            contextoDesenho.lineWidth = 1;
            contextoDesenho.beginPath();
            contextoDesenho.moveTo(zeniteX, areaDesenho.top);
            contextoDesenho.lineTo(zeniteX, areaDesenho.bottom);
            contextoDesenho.stroke();
            contextoDesenho.restore();
        }
    };

    function obterOpcoesSolarDia({ tickSize: tamanhoMarcador = 11, labelSize: tamanhoRotulo = 11, defaults: padroes, colors: cores } = {}) {
        registrarPosicionadorTooltipSolar();

        return {
            responsive: true,
            maintainAspectRatio: false,
            animation: { duration: 600 },
            interaction: {
                mode: "nearest",
                intersect: true
            },
            hover: {
                mode: "nearest",
                intersect: true
            },
            plugins: {
                legend: {
                    display: true,
                    position: "top",
                    labels: { color: cores.text, font: { size: tamanhoRotulo }, boxWidth: 12, padding: 16 }
                },
                tooltip: {
                    ...padroes.plugins.tooltip,
                    mode: "nearest",
                    intersect: true,
                    position: "solarEvent",
                    filter: contexto => contexto.dataset.label === "Eventos solares",
                    callbacks: {
                        title: itens => itens[0]?.raw?.label || "",
                        label: contexto => {
                            const bruto = contexto.raw;
                            return bruto && bruto.timeLabel ? bruto.timeLabel : ClimateData.formatTime(contexto.parsed.x);
                        }
                    }
                }
            },
            scales: {
                x: {
                    type: "linear",
                    min: 0,
                    max: 24,
                    grid: { color: "rgba(99,132,200,0.13)", drawBorder: false },
                    ticks: {
                        stepSize: 2,
                        color: cores.text,
                        font: { size: tamanhoMarcador },
                        callback: valor => `${valor}h`
                    }
                },
                y: {
                    min: 0,
                    max: 1.12,
                    grid: { color: "rgba(99,132,200,0.10)", drawBorder: false },
                    ticks: { display: false }
                }
            }
        };
    }

    function registrarPosicionadorTooltipSolar() {
        const posicionadores = window.Chart?.Tooltip?.positioners;
        if (!posicionadores || posicionadores.solarEvent) return;

        posicionadores.solarEvent = function (elementos, posicaoEvento) {
            const elementoEvento = elementos.find(item => {
                const serieGrafico = this.chart?.data?.datasets?.[item.datasetIndex];
                return serieGrafico?.label === "Eventos solares";
            }) || elementos[0];

            return elementoEvento?.element?.tooltipPosition?.() || posicaoEvento;
        };
    }

    function formatarDuracaoDia(eventos) {
        const duracaoSegundos = Number(eventos?.daylightDuration);
        if (Number.isFinite(duracaoSegundos) && duracaoSegundos > 0) {
            return formatarTotalMinutos(Math.round(duracaoSegundos / 60));
        }

        const nascer = Number(eventos?.sunrise);
        const por = Number(eventos?.sunset);
        if (!Number.isFinite(nascer) || !Number.isFinite(por) || por < nascer) return null;

        return formatarTotalMinutos(Math.round((por - nascer) * 60));
    }

    function formatarTotalMinutos(totalMinutos) {
        const horas = Math.floor(totalMinutos / 60);
        const minutos = totalMinutos % 60;
        return `${horas}h${String(minutos).padStart(2, "0")}`;
    }

    function criarGraficoSolarDia({ data: dados, selectedDate: dataSelecionada, ctx: contextoDesenho, existingChart: graficoExistente, defaults: padroes, colors: cores, onEmpty: aoEstarVazio }) {
        const eventos = obterEventosSolaresDataSelecionada(dados, dataSelecionada);
        if (graficoExistente) graficoExistente.destroy();

        if (!eventos) {
            if (aoEstarVazio) aoEstarVazio();
            return null;
        }

        const pontosLuzDiurna = [
            { x: 0, y: 0 },
            { x: eventos.dawn, y: 0.08, label: "Amanhecer", timeLabel: ClimateData.formatTime(eventos.dawn) },
            { x: eventos.sunrise, y: 0.52, label: "Nascer do sol", timeLabel: ClimateData.formatTime(eventos.sunrise) },
            { x: eventos.zenith, y: 1, label: "Zenite", timeLabel: ClimateData.formatTime(eventos.zenith) },
            { x: eventos.sunset, y: 0.52, label: "Pôr do sol", timeLabel: ClimateData.formatTime(eventos.sunset) },
            { x: eventos.dusk, y: 0.08, label: "Anoitecer", timeLabel: ClimateData.formatTime(eventos.dusk) },
            { x: 24, y: 0 }
        ];
        const pontosEventos = [
            pontosLuzDiurna[1],
            pontosLuzDiurna[2],
            pontosLuzDiurna[3],
            pontosLuzDiurna[4],
            pontosLuzDiurna[5]
        ];

        const grafico = new Chart(contextoDesenho, {
            type: "line",
            data: {
                datasets: [
                    {
                        label: "Luz do dia",
                        data: pontosLuzDiurna,
                        borderColor: "#facc15",
                        backgroundColor: "rgba(250, 204, 21, 0.22)",
                        fill: true,
                        tension: 0.42,
                        pointRadius: 0,
                        pointHitRadius: 0,
                        pointHoverRadius: 0,
                        order: 2
                    },
                    {
                        type: "scatter",
                        label: "Eventos solares",
                        data: pontosEventos,
                        borderColor: "#f8fafc",
                        backgroundColor: ["#fde68a", "#fb923c", "#facc15", "#f87171", "#818cf8"],
                        pointBorderColor: "#0b1120",
                        pointBorderWidth: 2,
                        pointRadius: 5,
                        pointHitRadius: 18,
                        pointHoverRadius: 7,
                        order: 1
                    }
                ]
            },
            options: obterOpcoesSolarDia({ defaults: padroes, colors: cores }),
            plugins: [pluginFundoDiaSolar]
        });

        grafico.$solarDayTimes = eventos;
        return grafico;
    }

    window.ClimateSolar = {
        createSunriseSunsetChart: criarGraficoNascerPorSol,
        createSolarTodayChart: criarGraficoSolarDia,
        getSolarEventsForSelectedDate: obterEventosSolaresDataSelecionada,
        formatarDuracaoDia,
        getSunHistoryOptions: obterOpcoesHistoricoSolar,
        getSolarTodayOptions: obterOpcoesSolarDia,
        solarDayBackgroundPlugin: pluginFundoDiaSolar,
    };
})();
