'use strict';

(function () {
    const { ids, fields, colors } = window.AppConfig;
    const canvasTemperatura = document.getElementById(ids.charts.globalTemperature).getContext("2d");
    const canvasUmidade = document.getElementById(ids.charts.globalHumidity).getContext("2d");
    let dadosExternosAtuais = null;
    let estadoConsultaExterna = "ocioso";
    let mensagemConsultaExterna = "";
    let ultimosDadosInternos = null;

    function render({ latestData, selectedDate, chartInstances, defaults, colors: cores, ui, ensureChart }) {
        ultimosDadosInternos = latestData;
        renderizarResumoGlobal(latestData, selectedDate);
        renderizarInsightsAmbientais(latestData);
        renderizarLinhaEstacoes();
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

    function renderizarInsightsAmbientais(latestData) {
        const container = document.getElementById("environmentInsights");
        if (!container) return;

        const temperaturaSala = obterUltimoRegistro(latestData.livingRoom, fields.livingRoom.temperature)?.valor ?? null;
        const umidadeSala = obterUltimoRegistro(latestData.livingRoom, fields.livingRoom.humidity)?.valor ?? null;
        const temperaturaQuarto = obterUltimoRegistro(latestData.room, fields.room.temperature)?.valor ?? null;
        const umidadeQuarto = obterUltimoRegistro(latestData.room, fields.room.humidity)?.valor ?? null;
        const aqi = window.ClimateAqi.calculate(latestData.livingRoom)?.aqi ?? null;
        const riscoSala = window.ClimateInsightsAmbientais.avaliarRiscoMofo({
            temperatura: temperaturaSala,
            umidade: umidadeSala,
        });
        const riscoQuarto = window.ClimateInsightsAmbientais.avaliarRiscoMofo({
            temperatura: temperaturaQuarto,
            umidade: umidadeQuarto,
        });
        const ventilacaoInterna = window.ClimateInsightsAmbientais.recomendarVentilacaoInterna({
            temperatura: temperaturaSala,
            umidade: umidadeSala,
            aqi,
            riscoMofo: riscoSala,
        });

        let chuva = null;
        let indiceUv = null;
        let ventilacao = ventilacaoInterna;
        if (dadosExternosAtuais) {
            chuva = window.ClimateInsightsAmbientais.resumirChuva(
                dadosExternosAtuais.previsaoCurtoPrazo,
                dadosExternosAtuais.atualizadoEm,
                6
            );
            indiceUv = window.ClimateInsightsAmbientais.analisarIndiceUv(
                dadosExternosAtuais.climaAtual.indiceUv,
                dadosExternosAtuais.previsaoDiaria.indiceUvMaximo
            );
            const ventilacaoExterna = window.ClimateInsightsAmbientais.recomendarVentilacaoExterna({
                climaAtual: dadosExternosAtuais.climaAtual,
                aqi: dadosExternosAtuais.aqi,
                chuva,
            });
            ventilacao = window.ClimateInsightsAmbientais.recomendarVentilacaoCombinada({
                interna: ventilacaoInterna,
                externa: ventilacaoExterna,
            });
        }

        container.innerHTML = `
            <div class="environment-insights__grid">
                ${montarCardInsight({
                    titulo: "Ventilação da Sala",
                    valor: ventilacao.rotulo,
                    status: dadosExternosAtuais ? "Interior + exterior" : "Sensores internos",
                    classe: ventilacao.classe,
                    descricao: ventilacao.descricao,
                    detalhe: dadosExternosAtuais ? `Clima externo: ${dadosExternosAtuais.origem.rotulo}` : "Consulte a localização para combinar o clima externo",
                })}
                ${montarCardPrevisaoChuva(chuva)}
                ${montarCardIndiceUv(indiceUv)}
                ${montarCardOrvalho("Sala", riscoSala)}
                ${montarCardOrvalho("Quarto", riscoQuarto)}
            </div>
        `;

        document.getElementById("environmentLocationButton")?.addEventListener("click", consultarClimaExterno);
    }

    async function consultarClimaExterno() {
        if (estadoConsultaExterna === "carregando") return;
        estadoConsultaExterna = "carregando";
        mensagemConsultaExterna = "Consultando clima da localização do navegador...";
        renderizarInsightsAmbientais(ultimosDadosInternos || {});

        try {
            const localizacao = await window.BrowserLocationService.obterLocalizacaoAtual();
            dadosExternosAtuais = await window.ExternalWeatherService.buscarPorCoordenadas({
                latitude: localizacao.latitude,
                longitude: localizacao.longitude,
                origem: {
                    tipo: "localizacao",
                    rotulo: "Localização atual",
                    precisao: localizacao.precisao,
                },
            });
            estadoConsultaExterna = "sucesso";
            mensagemConsultaExterna = `Clima externo atualizado às ${formatarHoraData(dadosExternosAtuais.atualizadoEm)}.`;
        } catch (erro) {
            estadoConsultaExterna = "erro";
            mensagemConsultaExterna = erro?.message || "Não foi possível consultar o clima externo.";
        }

        renderizarInsightsAmbientais(ultimosDadosInternos || {});
    }

    function montarCardPrevisaoChuva(chuva) {
        if (!chuva) {
            return montarCardInsight({
                titulo: "Chuva · próximas 6h",
                valor: "--",
                status: "Localização necessária",
                classe: "indisponivel",
                descricao: "Use a localização para carregar probabilidade e intensidade de chuva.",
                detalhe: "Nenhuma localização é armazenada",
                acao: montarAcaoLocalizacao(),
            });
        }

        return montarCardInsight({
            titulo: "Chuva · próximas 6h",
            valor: chuva.classe === "indisponivel" ? "--" : `${Math.round(chuva.probabilidade)}%`,
            status: chuva.rotulo,
            classe: chuva.classe,
            descricao: chuva.descricao,
            detalhe: chuva.classe === "indisponivel" ? "Sem previsão horária" : `${chuva.acumulado.toFixed(1)} mm acumulados · pico ${chuva.intensidadeMaxima.toFixed(1)} mm/h`,
            acao: montarAcaoLocalizacao(),
        });
    }

    function montarCardIndiceUv(indiceUv) {
        if (!indiceUv) {
            return montarCardInsight({
                titulo: "Índice UV",
                valor: "--",
                status: "Localização necessária",
                classe: "indisponivel",
                descricao: "Use a localização para carregar o índice UV e a recomendação solar.",
                detalhe: "Nenhuma localização é armazenada",
            });
        }

        return montarCardInsight({
            titulo: "Índice UV",
            valor: Number.isFinite(indiceUv.valor) ? indiceUv.valor.toFixed(1) : "--",
            status: indiceUv.rotulo,
            classe: indiceUv.classe,
            descricao: indiceUv.descricao,
            detalhe: Number.isFinite(indiceUv.maximo) ? `Máxima do dia: ${indiceUv.maximo.toFixed(1)}` : "Valor atual",
        });
    }

    function montarCardOrvalho(ambiente, risco) {
        const valor = Number.isFinite(risco.pontoOrvalho) ? `${risco.pontoOrvalho.toFixed(1)}°C` : "--";
        return montarCardInsight({
            titulo: `Ponto de orvalho · ${ambiente}`,
            valor,
            status: risco.rotulo,
            classe: risco.classe,
            descricao: risco.descricao,
            detalhe: "Risco estimado de condensação e mofo",
        });
    }

    function montarCardInsight({ titulo, valor, status, classe, descricao, detalhe, acao = "" }) {
        return `
            <article class="environment-insight environment-insight--${classe}">
                <div class="environment-insight__header">
                    <span>${titulo}</span>
                    <small>${status}</small>
                </div>
                <strong>${valor}</strong>
                <p>${descricao}</p>
                <span class="environment-insight__detail">${detalhe}</span>
                ${acao}
            </article>
        `;
    }

    function montarAcaoLocalizacao() {
        const mensagem = mensagemConsultaExterna
            ? `<span class="environment-insight__feedback environment-insight__feedback--${estadoConsultaExterna}" role="status">${mensagemConsultaExterna}</span>`
            : "";

        return `
            <div class="environment-insight__action">
                ${mensagem}
                <button class="environment-insights__location" id="environmentLocationButton" type="button" ${estadoConsultaExterna === "carregando" ? "disabled" : ""}>
                    ${textoBotaoLocalizacao()}
                </button>
            </div>
        `;
    }

    function textoBotaoLocalizacao() {
        if (estadoConsultaExterna === "carregando") return "Consultando...";
        return dadosExternosAtuais ? "Atualizar clima externo" : "Usar localização para chuva e UV";
    }

    function formatarHoraData(data) {
        if (!(data instanceof Date) || Number.isNaN(data.getTime())) return "--:--";
        return `${String(data.getHours()).padStart(2, "0")}:${String(data.getMinutes()).padStart(2, "0")}`;
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
        const dadosHoje = ClimateData.filterDataByDays(data || {}, 1, ClimateData.dataAtual());
        const qualidade = window.ClimateDataQuality?.analisarSerie?.(dadosHoje, campo) || null;
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
            detalheSecundario: montarDetalheQualidadeAtual(qualidade),
            tendencia: "",
            classe: "stable",
            temValor: true,
        };
    }

    function montarDetalheQualidadeAtual(qualidade) {
        if (!deveExibirQualidade(qualidade)) return "";
        const cobertura = qualidade.leiturasEsperadas > 0 ? `${qualidade.coberturaPercentual.toFixed(0)}%` : "0%";
        return `${qualidade.rotuloEstado} · ${qualidade.leiturasValidas}/${qualidade.leiturasEsperadas} · ${cobertura}`;
    }

    function deveExibirQualidade(qualidade) {
        if (!qualidade) return false;
        return qualidade.nivel !== "adequada" || qualidade.coberturaPercentual < 99.5;
    }

    function criarCardResumo(card) {
        const elemento = document.createElement("article");
        elemento.className = "stats-card station-summary-card";
        const tendencia = card.tendencia
            ? `<span class="stats-card__trend stats-card__trend--${card.classe}">${card.tendencia}</span>`
            : "";
        const detalheSecundario = card.detalheSecundario
            ? `<span>${card.detalheSecundario}</span>`
            : "";
        elemento.innerHTML = `
            <div class="stats-card__header">
                <span class="stats-card__label">${card.titulo}</span>
                ${tendencia}
            </div>
            <strong class="stats-card__value">${card.valor}</strong>
            <div class="station-summary-card__meta">
                <span>${card.detalhePrincipal}</span>
                ${detalheSecundario}
            </div>
        `;
        return elemento;
    }

    function renderizarLinhaEstacoes() {
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
            <span class="station-context-badge" title="A fase lunar segue a data escolhida no calendário.">Data consultada: ${selectedDate.replace(/-/g, "/")}</span>
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
                    itemSort: (a, b) => {
                        const valorA = Number(a.parsed.y);
                        const valorB = Number(b.parsed.y);
                        if (!Number.isFinite(valorA)) return 1;
                        if (!Number.isFinite(valorB)) return -1;
                        return valorB - valorA;
                    },
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
