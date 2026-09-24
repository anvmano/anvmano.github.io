'use strict';

(function () {
    const { ids, fields: campos, colors: cores } = window.AppConfig;
    const canvasTemperatura = document.getElementById(ids.charts.globalTemperature).getContext("2d");
    const canvasUmidade = document.getElementById(ids.charts.globalHumidity).getContext("2d");
    const canvasChuva = document.getElementById(ids.charts.rain);
    let dadosExternosAtuais = null;
    let estadoConsultaExterna = "ocioso";
    let mensagemConsultaExterna = "";
    let ultimosDadosInternos = null;
    let dependenciasGraficos = null;

    function renderizar({ latestData: dadosMaisRecentes, selectedDate: dataSelecionada, chartInstances: instanciasGraficos, defaults: padroes, colors: cores, ui: interfaceUsuario, ensureChart: garantirGrafico }) {
        dependenciasGraficos = { instanciasGraficos, padroes, cores, interfaceUsuario, garantirGrafico };
        ultimosDadosInternos = dadosMaisRecentes;
        renderizarResumoGlobal(dadosMaisRecentes, dataSelecionada);
        renderizarInsightsAmbientais(dadosMaisRecentes);
        renderizarGraficoChuvaExterna();
        renderizarLinhaEstacoes();
        renderizarResumoLua(dataSelecionada);
        renderizarGraficoComparativo({
            canvasCtx: canvasTemperatura,
            containerId: ids.chartContainers.globalTemperature,
            chartInstances: instanciasGraficos,
            defaults: padroes,
            ui: interfaceUsuario,
            ensureChart: garantirGrafico,
            titulo: "Temperatura",
            unidade: "°",
            eixoY: "(°C)",
            series: [
                criarSerie("Sala", dadosMaisRecentes.livingRoom, campos.livingRoom.temperature, cores.blue),
                criarSerie("Quarto", dadosMaisRecentes.room, campos.room.temperature, cores.green),
                criarSerie("Aquário", dadosMaisRecentes.aquarium, campos.aquarium.temperature, cores.amber),
            ],
            selectedDate: dataSelecionada,
            mensagemVazia: `Sem dados comparativos de temperatura em ${dataSelecionada.replace(/-/g, "/")}.`,
        });
        renderizarGraficoComparativo({
            canvasCtx: canvasUmidade,
            containerId: ids.chartContainers.globalHumidity,
            chartInstances: instanciasGraficos,
            defaults: padroes,
            ui: interfaceUsuario,
            ensureChart: garantirGrafico,
            titulo: "Umidade",
            unidade: "%",
            eixoY: "%",
            series: [
                criarSerie("Sala", dadosMaisRecentes.livingRoom, campos.livingRoom.humidity, cores.purple),
                criarSerie("Quarto", dadosMaisRecentes.room, campos.room.humidity, cores.rose),
            ],
            selectedDate: dataSelecionada,
            mensagemVazia: `Sem dados comparativos de umidade em ${dataSelecionada.replace(/-/g, "/")}.`,
        });
        if (dadosMaisRecentes.solar) {
            window.SolarView.render({
                data: dadosMaisRecentes.solar,
                selectedDate: dataSelecionada,
                chartInstances: instanciasGraficos,
                defaults: padroes,
                colors: cores,
                ensureChart: garantirGrafico,
                ui: interfaceUsuario
            });
        } else {
            interfaceUsuario.renderChartMessage(ids.chartContainers.sunHistory, `Sem dados de nascer e pôr do sol em ${dataSelecionada.replace(/-/g, "/")}.`);
            interfaceUsuario.renderChartMessage(ids.chartContainers.solarToday, `Sem dados de ciclo solar em ${dataSelecionada.replace(/-/g, "/")}.`);
        }
    }

    function renderizarInsightsAmbientais(dadosMaisRecentes) {
        const recipiente = document.getElementById("environmentInsights");
        if (!recipiente) return;

        const temperaturaSala = obterUltimoRegistro(dadosMaisRecentes.livingRoom, campos.livingRoom.temperature)?.valor ?? null;
        const umidadeSala = obterUltimoRegistro(dadosMaisRecentes.livingRoom, campos.livingRoom.humidity)?.valor ?? null;
        const temperaturaQuarto = obterUltimoRegistro(dadosMaisRecentes.room, campos.room.temperature)?.valor ?? null;
        const umidadeQuarto = obterUltimoRegistro(dadosMaisRecentes.room, campos.room.humidity)?.valor ?? null;
        const aqi = window.ClimateAqi.calculate(dadosMaisRecentes.livingRoom)?.aqi ?? null;
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

        const descricaoVentilacao = dadosExternosAtuais
            ? ventilacao.descricao
            : ventilacao.descricao.replace(/\s*Consulte o clima externo[^.]*\./i, "").trim();

        recipiente.innerHTML = `
            <div class="environment-insights__grid">
                ${montarCardInsight({
                    titulo: "Ventilação da Sala",
                    valor: ventilacao.rotulo,
                    status: dadosExternosAtuais ? "Interior + exterior" : "Sensores internos",
                    classe: ventilacao.classe,
                    descricao: descricaoVentilacao,
                    detalhe: dadosExternosAtuais ? `Clima externo: ${dadosExternosAtuais.origem.rotulo}` : "",
                })}
                ${montarCardPrevisaoChuva(chuva, dadosExternosAtuais?.climaAtual)}
                ${montarCardIndiceUv(indiceUv)}
                ${montarCardOrvalho("Sala", riscoSala)}
                ${montarCardOrvalho("Quarto", riscoQuarto)}
            </div>
        `;

        const detalhes = document.getElementById("environmentDetails");
        if (detalhes) {
            // Apenas condicoes favoraveis podem sair da area sempre visivel.
            detalhes.replaceChildren();
            const acao = recipiente.querySelector(".environment-insight__action");
            if (acao) recipiente.appendChild(acao);
            recipiente.querySelectorAll(".environment-insight--favoravel").forEach(card => detalhes.appendChild(card));
            document.getElementById("stationEnvironmentDetails").hidden = !detalhes.childElementCount;
        }
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
        renderizarGraficoChuvaExterna();
    }

    function montarCardPrevisaoChuva(chuva, climaAtual) {
        if (!chuva) {
            return montarCardInsight({
                titulo: "Chuva · próximas 6h",
                valor: "--",
                status: "Localização necessária",
                classe: "indisponivel",
                descricao: "Probabilidade e intensidade nas próximas 6h.",
                detalhe: "",
                acao: montarAcaoLocalizacao(),
            });
        }

        const chuvaAtual = window.ClimateChuva.analisarAgora(climaAtual);
        return montarCardInsight({
            titulo: "Chuva · próximas 6h",
            valor: chuvaAtual.disponivel ? chuvaAtual.rotulo : "--",
            status: chuva.rotulo,
            classe: chuva.classe,
            descricao: chuva.descricao,
            detalhe: chuva.classe === "indisponivel" ? "Sem previsão horária" : `Maior chance ${Math.round(chuva.probabilidade)}% · ${chuva.acumulado.toFixed(1)} mm acumulados · pico ${chuva.intensidadeMaxima.toFixed(1)} mm/h`,
            acao: montarAcaoLocalizacao(),
        });
    }

    function renderizarGraficoChuvaExterna() {
        const recipiente = document.getElementById(ids.chartContainers.rain);
        const dependencias = dependenciasGraficos;
        if (!recipiente || !canvasChuva || !dependencias) return;

        const id = canvasChuva.id;
        if (!dadosExternosAtuais) {
            recipiente.hidden = true;
            if (dependencias.instanciasGraficos[id]) {
                window.ClimateChartSync?.desregistrar(dependencias.instanciasGraficos[id]);
                dependencias.instanciasGraficos[id].destroy();
                delete dependencias.instanciasGraficos[id];
            }
            return;
        }

        recipiente.hidden = false;
        window.ClimateUI.renderChartContext(ids.chartContainers.rain, `Consulta externa atualizada em ${new Date(dadosExternosAtuais.atualizadoEm).toLocaleString("pt-BR")} · independente da data selecionada`);
        if (!window.Chart) {
            dependencias.interfaceUsuario.renderChartMessage(ids.chartContainers.rain, "Carregando gráfico...", "loading");
            dependencias.garantirGrafico?.();
            return;
        }

        dependencias.interfaceUsuario.clearChartMessage(ids.chartContainers.rain);
        const janela = window.ClimateChuva.montarJanela(
            dadosExternosAtuais.previsaoCurtoPrazo,
            dadosExternosAtuais.atualizadoEm
        );
        const grafico = window.ClimateChuva.criarGrafico({
            canvas: canvasChuva,
            janela,
            graficoExistente: dependencias.instanciasGraficos[id],
            cores: dependencias.cores,
            grupoSincronizacao: "estacao",
        });
        if (grafico) {
            dependencias.instanciasGraficos[id] = grafico;
        } else {
            delete dependencias.instanciasGraficos[id];
            dependencias.interfaceUsuario.renderChartMessage(ids.chartContainers.rain, "Sem dados horários de chuva para a localização.");
        }
    }

    function montarCardIndiceUv(indiceUv) {
        if (!indiceUv) {
            return montarCardInsight({
                titulo: "Índice UV",
                valor: "--",
                status: "Localização necessária",
                classe: "indisponivel",
                descricao: "Índice atual e recomendação solar.",
                detalhe: "",
            });
        }

        return montarCardInsight({
            titulo: "Índice UV atual",
            valor: Number.isFinite(indiceUv.valor) ? indiceUv.valor.toFixed(1) : "--",
            status: indiceUv.rotulo,
            classe: indiceUv.classe,
            descricao: indiceUv.descricao,
            detalhe: Number.isFinite(indiceUv.maximo) ? `Máxima prevista hoje: ${indiceUv.maximo.toFixed(1)}` : "Valor atual",
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

    function montarCardInsight({ titulo, valor, status: estado, classe, descricao, detalhe, acao = "" }) {
        const detalheHtml = detalhe ? `<span class="environment-insight__detail">${detalhe}</span>` : "";
        return `
            <article class="environment-insight environment-insight--${classe}">
                <div class="environment-insight__header">
                    <span>${titulo}</span>
                    <small>${estado}</small>
                </div>
                <strong>${valor}</strong>
                <p>${descricao}</p>
                ${detalheHtml}
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

    function formatarHoraData(dados) {
        if (!(dados instanceof Date) || Number.isNaN(dados.getTime())) return "--:--";
        return `${String(dados.getHours()).padStart(2, "0")}:${String(dados.getMinutes()).padStart(2, "0")}`;
    }

    function renderizarResumoGlobal(dadosMaisRecentes, dataSelecionada) {
        const recipiente = document.getElementById("statsEstacao");
        if (!recipiente) return;

        recipiente.innerHTML = "";
        const cards = [
            montarCardAqi(dadosMaisRecentes.livingRoom),
            montarCardUltimaMedicao("Temp. Sala", dadosMaisRecentes.livingRoom, campos.livingRoom.temperature, "°C"),
            montarCardUltimaMedicao("Temp. Quarto", dadosMaisRecentes.room, campos.room.temperature, "°C"),
            montarCardUltimaMedicao("Temp. Aquário", dadosMaisRecentes.aquarium, campos.aquarium.temperature, "°C"),
            montarCardUltimaMedicao("Umidade Sala", dadosMaisRecentes.livingRoom, campos.livingRoom.humidity, "%"),
            montarCardUltimaMedicao("Umidade Quarto", dadosMaisRecentes.room, campos.room.humidity, "%"),
        ];

        cards.forEach(card => recipiente.appendChild(criarCardResumo(card)));

        if (!cards.some(card => card.temValor)) {
            const mensagem = document.createElement("p");
            mensagem.className = "state-message";
            mensagem.innerText = `Sem resumo global disponível para ${dataSelecionada.replace(/-/g, "/")}.`;
            recipiente.replaceChildren(mensagem);
        }
    }

    function montarCardAqi(dados) {
        const resultado = window.ClimateAqi.calculate(dados);
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
            detalheSecundario: `Dominante: ${resultado.dominant.label} · Última leitura: ${new Date(resultado.timestamp).toLocaleString("pt-BR")}`,
            tendencia: resultado.category.label,
            classe: resultado.category.className === "good" ? "stable" : "down",
            temValor: true,
        };
    }

    function montarCardUltimaMedicao(titulo, dados, campo, unidade) {
        const registro = obterUltimoRegistro(dados, campo);
        const dadosHoje = ClimateData.filterDataByDays(dados || {}, 1, ClimateData.dataAtual());
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
            detalhePrincipal: `Última leitura: ${registro.data.replace(/-/g, "/")} · ${registro.horario}`,
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
        const recipiente = document.getElementById("seasonTimeline");
        if (!recipiente) return;

        const estado = window.ClimateSeason?.getState?.();
        if (!estado) {
            recipiente.innerHTML = "";
            return;
        }

        recipiente.innerHTML = `
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

    function renderizarResumoLua(dataSelecionada) {
        const recipiente = document.getElementById("moonSummary");
        if (!recipiente) return;

        const estado = window.ClimateMoon?.getState?.(dataSelecionada);
        if (!estado) {
            recipiente.innerHTML = "";
            return;
        }

        recipiente.innerHTML = `
            <span class="station-context-badge" title="A fase lunar segue a data escolhida no calendário.">Data consultada: ${dataSelecionada.replace(/-/g, "/")}</span>
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

    function criarSerie(nome, dados, campo, cor) {
        return { nome, data: dados, campo, cor };
    }

    function renderizarGraficoComparativo({
        canvasCtx: contextoCanvas,
        containerId: idRecipiente,
        chartInstances: instanciasGraficos,
        defaults: padroes,
        ui: interfaceUsuario,
        ensureChart: garantirGrafico,
        titulo,
        unidade,
        eixoY,
        series: seriesDados,
        selectedDate: dataSelecionada,
        mensagemVazia,
    }) {
        const id = contextoCanvas.canvas.id;
        window.ClimateUI.renderRollingPeriod(idRecipiente, dataSelecionada);
        if (instanciasGraficos[id]) {
            window.ClimateChartSync?.desregistrar(instanciasGraficos[id]);
            instanciasGraficos[id].destroy();
        }

        const seriesNormalizadas = seriesDados.map(serie => ({
            ...serie,
            pontos: extrairPontosSerie(serie.data, dataSelecionada, serie.campo),
        }));
        const chaves = [...new Set(seriesNormalizadas.flatMap(serie => serie.pontos.map(ponto => ponto.chave)))].sort();
        const temDados = seriesNormalizadas.some(serie => serie.pontos.length);

        if (!temDados) {
            delete instanciasGraficos[id];
            contextoCanvas.clearRect(0, 0, contextoCanvas.canvas.width, contextoCanvas.canvas.height);
            interfaceUsuario.renderChartMessage(idRecipiente, mensagemVazia);
            return;
        }

        if (!window.Chart) {
            interfaceUsuario.renderChartMessage(idRecipiente, "Carregando gráfico...", "loading");
            if (typeof garantirGrafico === "function") garantirGrafico();
            return;
        }

        interfaceUsuario.clearChartMessage(idRecipiente);
        const rotulos = chaves.map(chave => chave.slice(11));
        const opcoes = ClimateCharts.mergeDeep(padroes, {
            plugins: {
                legend: {
                    display: true,
                    labels: { color: cores.text, boxWidth: 10, boxHeight: 10 },
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
                        label: contexto => {
                            const valor = Number(contexto.parsed.y);
                            const formatado = Number.isFinite(valor) ? valor.toFixed(2) : "--";
                            return `${contexto.dataset.label}: ${formatado}${unidade}`;
                        }
                    }
                }
            },
            scales: {
                y: {
                    title: {
                        display: true,
                        text: eixoY,
                        color: cores.text,
                        font: { size: 11 },
                    },
                    ticks: {
                        callback: valor => `${Number(valor).toFixed(unidade === "%" ? 0 : 1)}${unidade}`,
                    },
                },
            },
        });

        instanciasGraficos[id] = new Chart(contextoCanvas, {
            type: "line",
            data: {
                labels: rotulos,
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
        instanciasGraficos[id].$comparisonTitle = titulo;
        instanciasGraficos[id].$chavesSincronizacao = chaves.map(chave => chave.replace(" ", "T"));
        window.ClimateChartSync?.registrar(instanciasGraficos[id], "estacao");
    }

    function extrairPontosSerie(dados, dataSelecionada, campo) {
        const filtrado = ClimateData.filterDataByRollingHours(dados || {}, dataSelecionada, 24);
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

    function obterUltimoRegistro(dados, campo) {
        let ultimo = null;

        for (const dataFirebase of Object.keys(dados || {})) {
            const dadosData = dados[dataFirebase];
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

    function formatarDataCompleta(dados) {
        return `${String(dados.getDate()).padStart(2, "0")}/${String(dados.getMonth() + 1).padStart(2, "0")}/${dados.getFullYear()}`;
    }

    function media(valores) {
        return valores.reduce((soma, valor) => soma + valor, 0) / valores.length;
    }

    window.EstacaoView = {
        render: renderizar,
        obterDadosExternosAtuais: () => dadosExternosAtuais,
    };
})();
