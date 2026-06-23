'use strict';

(function () {
    const { ids, fields, colors } = window.AppConfig;
    const canvasTemperatura = document.getElementById(ids.charts.globalTemperature).getContext("2d");
    const canvasUmidade = document.getElementById(ids.charts.globalHumidity).getContext("2d");

    function render({ latestData, selectedDate, chartInstances, defaults, colors: cores, ui, ensureChart }) {
        renderizarResumoGlobal(latestData, selectedDate);
        renderizarLinhaEstacoes(selectedDate);
        renderizarResumoLua(selectedDate);
        renderizarGraficoComparativo({
            canvasCtx: canvasTemperatura,
            containerId: ids.chartContainers.globalTemperature,
            chartInstances,
            defaults,
            ui,
            ensureChart,
            titulo: "Temperatura",
            unidade: "°",
            eixoY: "(°C)",
            series: [
                criarSerie("Sala", latestData.livingRoom, fields.livingRoom.temperature, cores.blue),
                criarSerie("Quarto", latestData.room, fields.room.temperature, cores.green),
                criarSerie("Aquário", latestData.aquarium, fields.aquarium.temperature, cores.amber),
            ],
            selectedDate,
            mensagemVazia: `Sem dados comparativos de temperatura em ${selectedDate.replace(/-/g, "/")}.`,
        });
        renderizarGraficoComparativo({
            canvasCtx: canvasUmidade,
            containerId: ids.chartContainers.globalHumidity,
            chartInstances,
            defaults,
            ui,
            ensureChart,
            titulo: "Umidade",
            unidade: "%",
            eixoY: "%",
            series: [
                criarSerie("Sala", latestData.livingRoom, fields.livingRoom.humidity, cores.purple),
                criarSerie("Quarto", latestData.room, fields.room.humidity, cores.rose),
            ],
            selectedDate,
            mensagemVazia: `Sem dados comparativos de umidade em ${selectedDate.replace(/-/g, "/")}.`,
        });
        if (latestData.solar) {
            window.SolarView.render({
                data: latestData.solar,
                selectedDate,
                chartInstances,
                defaults,
                colors: cores,
                ensureChart,
                ui
            });
        } else {
            ui.renderChartMessage(ids.chartContainers.sunHistory, `Sem dados de nascer e pôr do sol em ${selectedDate.replace(/-/g, "/")}.`);
            ui.renderChartMessage(ids.chartContainers.solarToday, `Sem dados de ciclo solar em ${selectedDate.replace(/-/g, "/")}.`);
        }
    }

    function renderizarResumoGlobal(latestData, selectedDate) {
        const container = document.getElementById("statsEstacao");
        if (!container) return;

        container.innerHTML = "";
        const cards = [
            montarCardAqi(latestData.livingRoom),
            montarCardUltimaMedicao("Temp. Sala", latestData.livingRoom, fields.livingRoom.temperature, "°C"),
            montarCardUltimaMedicao("Temp. Quarto", latestData.room, fields.room.temperature, "°C"),
            montarCardUltimaMedicao("Temp. Aquário", latestData.aquarium, fields.aquarium.temperature, "°C"),
            montarCardUltimaMedicao("Umidade Sala", latestData.livingRoom, fields.livingRoom.humidity, "%"),
            montarCardUltimaMedicao("Umidade Quarto", latestData.room, fields.room.humidity, "%"),
        ];

        cards.forEach(card => container.appendChild(criarCardResumo(card)));

        if (!cards.some(card => card.temValor)) {
            const mensagem = document.createElement("p");
            mensagem.className = "state-message";
            mensagem.innerText = `Sem resumo global disponível para ${selectedDate.replace(/-/g, "/")}.`;
            container.replaceChildren(mensagem);
        }
    }

    function montarCardAqi(data) {
        const resultado = window.ClimateAqi.calculate(data);
        if (!resultado) {
            return {
                titulo: "AQI estimado",
                valor: "--",
                detalhePrincipal: "Sem dados suficientes",
                detalheSecundario: "Dominante: --",
                tendencia: "--",
                classe: "stable",
                temValor: false,
            };
        }

        return {
            titulo: "AQI estimado",
            valor: String(resultado.aqi),
            detalhePrincipal: resultado.category.label,
            detalheSecundario: `Dominante: ${resultado.dominant.label}`,
            tendencia: resultado.category.label,
            classe: resultado.category.className === "good" ? "stable" : "down",
            temValor: true,
        };
    }

    function montarCardUltimaMedicao(titulo, data, campo, unidade) {
        const registro = obterUltimoRegistro(data, campo);
        if (!registro) {
            return {
                titulo,
                valor: "--",
                detalhePrincipal: "Sem medição disponível",
                detalheSecundario: "--",
                tendencia: "--",
                classe: "stable",
                temValor: false,
            };
        }

        return {
            titulo,
            valor: formatarValor(registro.valor, unidade),
            detalhePrincipal: `${registro.data.replace(/-/g, "/")} · ${registro.horario}`,
            detalheSecundario: "Última medição",
            tendencia: "Atual",
            classe: "stable",
            temValor: true,
        };
    }

    function criarCardResumo(card) {
        const elemento = document.createElement("article");
        elemento.className = "stats-card station-summary-card";
        elemento.innerHTML = `
            <div class="stats-card__header">
                <span class="stats-card__label">${card.titulo}</span>
                <span class="stats-card__trend stats-card__trend--${card.classe}">${card.tendencia}</span>
            </div>
            <strong class="stats-card__value">${card.valor}</strong>
            <div class="station-summary-card__meta">
                <span>${card.detalhePrincipal}</span>
                <span>${card.detalheSecundario}</span>
            </div>
        `;
        return elemento;
    }

    function renderizarLinhaEstacoes(selectedDate) {
        const container = document.getElementById("seasonTimeline");
        if (!container) return;

        const estado = window.ClimateSeason?.getState?.();
        if (!estado) {
            container.innerHTML = "";
            return;
        }

        container.innerHTML = `
            <div class="season-timeline__track" aria-label="Progresso anual das estações">
                ${estado.estacoes.map(estacao => `
                    <span class="season-timeline__segment season-timeline__segment--${estacao.chave}">
                        <i>${estacao.nome}</i>
                    </span>
                `).join("")}
                <span class="season-timeline__marker" style="left: ${estado.progressoAno}%"></span>
            </div>
        `;
    }

    function renderizarResumoLua(selectedDate) {
        const container = document.getElementById("moonSummary");
        if (!container) return;

        const estado = window.ClimateMoon?.getState?.(selectedDate);
        if (!estado) {
            container.innerHTML = "";
            return;
        }

        container.innerHTML = `
            <div class="moon-summary__scene moon-summary__scene--${estado.fase.chave}" style="--moon-shadow: ${estado.sombra}%">
                <span class="moon-summary__orb" aria-hidden="true"></span>
            </div>
            <div class="moon-summary__content">
                <span>${estado.fase.nome}</span>
                <strong>${estado.iluminacao}% iluminada</strong>
            </div>
            <dl class="moon-summary__details">
                <div><dt>Idade</dt><dd>${estado.idade.toFixed(1)} dias</dd></div>
                <div><dt>Próx. cheia</dt><dd>${formatarDataCompleta(estado.proximaCheia)}</dd></div>
                <div><dt>Próx. nova</dt><dd>${formatarDataCompleta(estado.proximaNova)}</dd></div>
            </dl>
        `;
    }

    function criarSerie(nome, data, campo, cor) {
        return { nome, data, campo, cor };
    }

    function renderizarGraficoComparativo({
        canvasCtx,
        containerId,
        chartInstances,
        defaults,
        ui,
        ensureChart,
        titulo,
        unidade,
        eixoY,
        series,
        selectedDate,
        mensagemVazia,
    }) {
        const id = canvasCtx.canvas.id;
        if (chartInstances[id]) chartInstances[id].destroy();

        const seriesNormalizadas = series.map(serie => ({
            ...serie,
            pontos: extrairPontosSerie(serie.data, selectedDate, serie.campo),
        }));
        const chaves = [...new Set(seriesNormalizadas.flatMap(serie => serie.pontos.map(ponto => ponto.chave)))].sort();
        const temDados = seriesNormalizadas.some(serie => serie.pontos.length);

        if (!temDados) {
            delete chartInstances[id];
            canvasCtx.clearRect(0, 0, canvasCtx.canvas.width, canvasCtx.canvas.height);
            ui.renderChartMessage(containerId, mensagemVazia);
            return;
        }

        if (!window.Chart) {
            ui.renderChartMessage(containerId, "Carregando gráfico...", "loading");
            if (typeof ensureChart === "function") ensureChart();
            return;
        }

        ui.clearChartMessage(containerId);
        const labels = chaves.map(chave => chave.slice(11));
        const opcoes = ClimateCharts.mergeDeep(defaults, {
            plugins: {
                legend: {
                    display: true,
                    labels: { color: colors.text, boxWidth: 10, boxHeight: 10 },
                },
                tooltip: {
                    callbacks: {
                        label: context => {
                            const valor = Number(context.parsed.y);
                            const formatado = Number.isFinite(valor) ? valor.toFixed(2) : "--";
                            return `${context.dataset.label}: ${formatado}${unidade}`;
                        }
                    }
                }
            },
            scales: {
                y: {
                    title: {
                        display: true,
                        text: eixoY,
                        color: colors.text,
                        font: { size: 11 },
                    },
                    ticks: {
                        callback: valor => `${Number(valor).toFixed(unidade === "%" ? 0 : 1)}${unidade}`,
                    },
                },
            },
        });

        chartInstances[id] = new Chart(canvasCtx, {
            type: "line",
            data: {
                labels,
                datasets: seriesNormalizadas.map(serie => {
                    const mapa = new Map(serie.pontos.map(ponto => [ponto.chave, ponto.valor]));
                    return {
                        label: serie.nome,
                        data: chaves.map(chave => mapa.get(chave) ?? null),
                        borderColor: serie.cor,
                        backgroundColor: `${serie.cor}22`,
                        borderWidth: 2,
                        fill: false,
                        tension: 0.35,
                        pointRadius: 0,
                        pointHitRadius: 18,
                        pointHoverRadius: 5,
                    };
                }),
            },
            options: opcoes,
        });
        chartInstances[id].$comparisonTitle = titulo;
    }

    function extrairPontosSerie(data, selectedDate, campo) {
        const filtrado = ClimateData.filterDataByRollingHours(data || {}, selectedDate, 24);
        const pontosPorChave = new Map();

        for (const dataFirebase of Object.keys(filtrado).sort((a, b) => ClimateData.parseFirebaseDate(a) - ClimateData.parseFirebaseDate(b))) {
            const dadosData = filtrado[dataFirebase];
            if (!dadosData || typeof dadosData !== "object") continue;

            for (const horario of Object.keys(dadosData).sort()) {
                const valores = obterValoresDoHorario(dadosData[horario], campo);
                if (!valores.length) continue;

                const chave = `${formatarDataOrdenavel(dataFirebase)} ${formatarHorario(horario)}`;
                pontosPorChave.set(chave, media(valores));
            }
        }

        return [...pontosPorChave.entries()].map(([chave, valor]) => ({ chave, valor }));
    }

    function obterUltimoRegistro(data, campo) {
        let ultimo = null;

        for (const dataFirebase of Object.keys(data || {})) {
            const dadosData = data[dataFirebase];
            if (!dadosData || typeof dadosData !== "object") continue;

            for (const horario of Object.keys(dadosData)) {
                const valores = obterValoresDoHorario(dadosData[horario], campo);
                if (!valores.length) continue;

                const chave = `${formatarDataOrdenavel(dataFirebase)} ${formatarHorario(horario)}`;
                const valor = valores[valores.length - 1];
                if (!ultimo || chave > ultimo.chave) {
                    ultimo = {
                        chave,
                        valor,
                        data: dataFirebase,
                        horario: formatarHorario(horario),
                    };
                }
            }
        }

        return ultimo;
    }

    function obterValoresDoHorario(dadosHorario, campo) {
        const valores = [];
        if (!dadosHorario || typeof dadosHorario !== "object") return valores;

        for (const item of Object.values(dadosHorario)) {
            if (!item || typeof item !== "object") continue;
            const valor = ClimateData.normalizeMeasurementValue(campo, item[campo]);
            if (valor !== null) valores.push(valor);
        }

        return valores;
    }

    function formatarDataOrdenavel(dataFirebase) {
        const [dia, mes, ano] = String(dataFirebase || "").split("-");
        return `${ano}-${mes}-${dia}`;
    }

    function formatarHorario(horarioFirebase) {
        const [hora, minuto = "0"] = String(horarioFirebase || "").split("-");
        return `${String(hora).padStart(2, "0")}:${String(minuto).padStart(2, "0")}`;
    }

    function formatarValor(valor, unidade) {
        return Number.isFinite(valor) ? `${valor.toFixed(2)}${unidade}` : "--";
    }

    function formatarDataCompleta(data) {
        return `${String(data.getDate()).padStart(2, "0")}/${String(data.getMonth() + 1).padStart(2, "0")}/${data.getFullYear()}`;
    }

    function media(valores) {
        return valores.reduce((soma, valor) => soma + valor, 0) / valores.length;
    }

    window.EstacaoView = {
        render,
    };
})();
