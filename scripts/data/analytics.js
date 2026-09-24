'use strict';

(function () {
    const CONFIGURACAO_ESTATISTICAS = {
        quarto: {
            containerId: "statsQuarto",
            metrics: [
                { key: "Temperatura", label: "Temperatura", suffix: "°C", chartContainerId: "chart-container-temp" },
                { key: "Sensacao termica", label: "Sensação térmica", suffix: "°C", chartContainerId: "chart-container-st" },
                { key: "Umidade", label: "Umidade", suffix: "%", chartContainerId: "chart-container-umidade" },
            ],
        },
        sala: {
            containerId: "statsSala",
            metrics: [
                { key: "temperatura", label: "Temperatura", suffix: "°C", chartContainerId: "chart-container-temp-sala" },
                { key: "sensacaoTermica", label: "Sensação térmica", suffix: "°C", chartContainerId: "chart-container-st-sala" },
                { key: "umidade", label: "Umidade", suffix: "%", chartContainerId: "chart-container-umidade-sala" },
                { key: "pressao", label: "Pressão", suffix: " hPa", chartContainerId: "chart-container-pressao-sala" },
            ],
        },
        aquario: {
            containerId: "statsAquario",
            metrics: [
                { key: "temperaturaDS18B20", label: "Temperatura", suffix: "°C", chartContainerId: "chart-container-temp-aquario" },
                { key: "PH", label: "pH", suffix: "", chartContainerId: "chart-container-ph" },
                { key: "TDS", label: "TDS", suffix: "ppm", chartContainerId: "chart-container-tds" },
                { key: "Turbidez", label: "Turbidez", suffix: "NTU", chartContainerId: "chart-container-turbidez" },
            ],
        },
    };

    function renderizarEstatisticas(tipo, dados, dataSelecionada) {
        const configuracao = CONFIGURACAO_ESTATISTICAS[tipo];
        if (!configuracao) return;

        const elementoDom = document.getElementById(configuracao.containerId);
        if (!elementoDom) return;
        configuracao.metrics.forEach(metrica => window.ClimateUI?.renderRollingPeriod(metrica.chartContainerId, dataSelecionada));

        elementoDom.innerHTML = "";
        const temAlgumDado = Object.keys(dados || {}).length > 0;
        if (!temAlgumDado) {
            const mensagem = document.createElement("p");
            mensagem.className = "state-message";
            mensagem.innerText = `Sem resumo disponível para ${formatarDataFirebaseRelatorio(dataSelecionada)}.`;
            elementoDom.appendChild(mensagem);
            return;
        }

        configuracao.metrics.forEach(metrica => {
            const qualidade = window.ClimateDataQuality?.analisarSerie?.(dados, metrica.key) || null;
            const valores = qualidade?.valores || extrairValoresMetrica(dados, metrica.key);
            const estatisticas = calcularEstatisticas(valores, qualidade);
            const card = criarCardEstatisticas(metrica, estatisticas, qualidade);
            const contexto = document.createElement("p");
            contexto.className = "stats-card__period";
            contexto.textContent = `Média do dia · ${formatarDataFirebaseRelatorio(dataSelecionada)}`;
            card.querySelector(".stats-card__value").after(contexto);
            elementoDom.appendChild(card);
            window.ClimateDataQuality?.aplicarAoGrafico?.(metrica.chartContainerId, qualidade);
        });
    }

    function extrairValoresMetrica(dados, chaveMetrica) {
        const valores = [];

        for (const dataReferencia of Object.keys(dados || {}).sort((a, b) => ClimateData.parseFirebaseDate(a) - ClimateData.parseFirebaseDate(b))) {
            const dadosData = dados[dataReferencia];
            if (!dadosData || typeof dadosData !== "object") continue;

            const horarios = Object.keys(dadosData).sort();
            for (const horario of horarios) {
                const dadosHorario = dadosData[horario];
                if (!dadosHorario || typeof dadosHorario !== "object") continue;

                for (const chaveItem of Object.keys(dadosHorario).sort()) {
                    const item = dadosHorario[chaveItem];
                    if (!item || typeof item !== "object") continue;

                    const valor = ClimateData.normalizeMeasurementValue(chaveMetrica, item[chaveMetrica]);
                    if (valor !== null) valores.push(valor);
                }
            }
        }

        return valores;
    }

    function calcularEstatisticas(valores, qualidade = null) {
        if (!valores.length) return null;

        const primeiro = valores[0];
        const ultimo = valores[valores.length - 1];
        const minimo = Math.min(...valores);
        const maximo = Math.max(...valores);
        const mediaCalculada = valores.reduce((soma, valor) => soma + valor, 0) / valores.length;
        const delta = valores.length >= 2 ? ultimo - primeiro : null;

        return {
            avg: mediaCalculada,
            min: minimo,
            max: maximo,
            delta,
            trend: obterTendencia(delta),
            leiturasValidas: qualidade?.leiturasValidas ?? valores.length,
            leiturasEsperadas: qualidade?.leiturasEsperadas ?? valores.length,
            qualidade,
        };
    }

    function obterTendencia(delta) {
        if (!Number.isFinite(delta)) {
            return { label: "Dados insuficientes", className: "insufficient", symbol: "!" };
        }
        if (Math.abs(delta) < 0.05) {
            return { label: "Estável", className: "stable", symbol: "→" };
        }
        if (delta > 0) {
            return { label: "Subindo", className: "up", symbol: "↗" };
        }
        return { label: "Caindo", className: "down", symbol: "↘" };
    }

    function criarCardEstatisticas(metrica, estatisticas, qualidade = null) {
        const card = document.createElement("article");
        card.className = "stats-card";

        if (!estatisticas) {
            card.innerHTML = `
                <div class="stats-card__header">
                    <span class="stats-card__label">${metrica.label}</span>
                    <span class="stats-card__trend stats-card__trend--stable">--</span>
                </div>
                <strong class="stats-card__value">--</strong>
                <dl class="stats-card__details">
                    <div><dt>Mín</dt><dd>--</dd></div>
                    <div><dt>Máx</dt><dd>--</dd></div>
                    <div><dt>Delta</dt><dd>--</dd></div>
                </dl>
                ${montarEstadoOperacional(qualidade)}
            `;
            return card;
        }

        const qualidadeEstatistica = estatisticas.qualidade;
        const tendencia = qualidadeEstatistica?.nivel === "critica"
            ? { label: "Leitura crítica", className: "critical", symbol: "!" }
            : qualidadeEstatistica?.nivel === "suspeita"
                ? { label: "Verificar sensor", className: "suspicious", symbol: "!" }
                : estatisticas.trend;
        const resumoQualidade = montarEstadoOperacional(qualidadeEstatistica);

        card.innerHTML = `
            <div class="stats-card__header">
                <span class="stats-card__label">${metrica.label}</span>
                <span class="stats-card__trend stats-card__trend--${tendencia.className}">${tendencia.symbol} ${tendencia.label}</span>
            </div>
            <strong class="stats-card__value">${formatarEstatistica(estatisticas.avg, metrica.suffix)}</strong>
            <dl class="stats-card__details">
                <div><dt>Mín</dt><dd>${formatarEstatistica(estatisticas.min, metrica.suffix)}</dd></div>
                <div><dt>Máx</dt><dd>${formatarEstatistica(estatisticas.max, metrica.suffix)}</dd></div>
                <div><dt>Delta</dt><dd>${Number.isFinite(estatisticas.delta) ? formatarDiferenca(estatisticas.delta, metrica.suffix) : "--"}</dd></div>
            </dl>
            ${resumoQualidade}
        `;
        return card;
    }

    function montarResumoQualidade(qualidade) {
        const cobertura = qualidade.leiturasEsperadas > 0
            ? `${qualidade.leiturasValidas}/${qualidade.leiturasEsperadas} leituras`
            : "sem leituras";
        return `${qualidade.rotulo}: ${cobertura}`;
    }

    function montarEstadoOperacional(qualidade) {
        if (!deveExibirQualidade(qualidade)) return "";
        const cobertura = qualidade.leiturasEsperadas > 0
            ? `${qualidade.coberturaPercentual.toFixed(0)}% · ${qualidade.leiturasValidas}/${qualidade.leiturasEsperadas} amostras`
            : "0 amostras";
        const ultima = qualidade.ultimaLeitura
            ? `${qualidade.ultimaLeitura.data.replace(/-/g, "/")} · ${formatarHorario(qualidade.ultimaLeitura.horario)}`
            : "sem leitura";
        const titulo = qualidade.avisos.join(" ") || montarResumoQualidade(qualidade);
        return `
            <p class="stats-card__quality stats-card__quality--${qualidade.nivel}" title="${titulo}">
                <strong>${qualidade.rotuloEstado}</strong>
                <span>${cobertura}</span>
                <span>Última: ${ultima}</span>
            </p>
        `;
    }

    function deveExibirQualidade(qualidade) {
        if (!qualidade) return false;
        return qualidade.nivel !== "adequada" || qualidade.coberturaPercentual < 99.5;
    }

    function formatarHorario(horario) {
        const [hora, minuto = "0"] = String(horario || "").split("-");
        return `${String(hora).padStart(2, "0")}:${String(minuto).padStart(2, "0")}`;
    }

    const RECIPIENTES_VISUALIZACOES_PADRAO = {
        monthlyCalendar: "monthlyClimateCalendar",
        hourlyHeatmap: "hourlyHeatmap",
        weeklyHeatmap: "weeklyHeatmap",
    };

    function renderizarVisualizacoesClimaticasAvancadas(dados, dataSelecionada, opcoes = {}) {
        const partesData = interpretarDataSelecionada(dataSelecionada);
        if (!partesData) return;

        const chaveMetrica = opcoes.metricKey || "Temperatura";
        const recipientes = {
            ...RECIPIENTES_VISUALIZACOES_PADRAO,
            ...(opcoes.containers || {}),
        };

        if (visualizacoesEstaoRecolhidas(recipientes)) return;

        const dataNormalizada = partesData.firebaseDate;
        const registrosMes = extrairRegistrosClimaticosMesSelecionado(dados, chaveMetrica, dataNormalizada);
        const registrosDia = registrosMes.filter(registro => registro.firebaseDate === dataNormalizada);

        try {
            renderizarCalendarioClimaticoMensal(registrosMes, dataNormalizada, recipientes.monthlyCalendar);
            renderizarMapaCalorHorario(registrosDia, dataNormalizada, recipientes.hourlyHeatmap);
            renderizarMapaCalorSemanal(registrosMes, dataNormalizada, recipientes.weeklyHeatmap);
        } catch (erro) {
            window.ClimateDiagnostics?.depurar("Falha ao renderizar visualizações climáticas avançadas.", erro);
        }
    }

    function visualizacoesEstaoRecolhidas(recipientes) {
        const ids = [recipientes.monthlyCalendar, recipientes.hourlyHeatmap, recipientes.weeklyHeatmap];
        const recipiente = ids
            .map(id => document.getElementById(id))
            .find(Boolean);
        const secao = recipiente?.closest?.(".collapsible-section");
        return !!secao?.classList.contains("is-collapsed");
    }

    function extrairRegistrosClimaticosMesSelecionado(dados, chaveMetrica, dataSelecionada) {
        const partesData = interpretarDataSelecionada(dataSelecionada);
        if (!partesData) return [];

        const mesSelecionado = preencherDigitos(partesData.month);
        const anoSelecionado = String(partesData.year);
        const registros = [];

        for (const dataFirebase of Object.keys(dados || {})) {
            const [dia, mes, ano] = dataFirebase.split("-");
            if (mes !== mesSelecionado || ano !== anoSelecionado) continue;

            const dadosData = dados[dataFirebase];
            if (!dadosData || typeof dadosData !== "object") continue;

            for (const horario of Object.keys(dadosData).sort()) {
                const dadosHorario = dadosData[horario];
                if (!dadosHorario || typeof dadosHorario !== "object") continue;

                const [parteHora, parteMinuto = "0"] = horario.split("-");
                const hora = Number(parteHora);
                const minuto = Number(parteMinuto);
                if (!Number.isFinite(hora)) continue;

                for (const chaveItem of Object.keys(dadosHorario).sort()) {
                    const item = dadosHorario[chaveItem];
                    if (!item || typeof item !== "object") continue;

                    const valor = ClimateData.normalizeMeasurementValue(chaveMetrica, item[chaveMetrica]);
                    if (valor === null) continue;

                    registros.push({
                        firebaseDate: dataFirebase,
                        day: Number(dia),
                        month: Number(mes),
                        year: Number(ano),
                        hour: hora,
                        minute: Number.isFinite(minuto) ? minuto : 0,
                        value: valor,
                    });
                }
            }
        }

        return registros;
    }

    function renderizarCalendarioClimaticoMensal(registros, dataSelecionada, idRecipiente) {
        const elementoDom = document.getElementById(idRecipiente);
        if (!elementoDom) return;

        elementoDom.innerHTML = "";

        const partesData = interpretarDataSelecionada(dataSelecionada);
        if (!partesData) return;

        const { day: diaSelecionado, month: mesSelecionado, year: anoSelecionado } = partesData;
        const diasNoMes = new Date(anoSelecionado, mesSelecionado, 0).getDate();
        const primeiroDiaSemana = new Date(anoSelecionado, mesSelecionado - 1, 1).getDay();
        const valoresPorDia = mediaGrupo(registros, registro => registro.day);
        const escala = obterEscalaValores(Object.values(valoresPorDia));

        adicionarCabecalhosDiasSemana(elementoDom);

        for (let i = 0; i < primeiroDiaSemana; i++) {
            const vazio = document.createElement("span");
            vazio.className = "heatmap-cell heatmap-cell--empty";
            elementoDom.appendChild(vazio);
        }

        for (let dia = 1; dia <= diasNoMes; dia++) {
            const valor = valoresPorDia[dia];
            const celula = document.createElement("span");
            celula.className = "heatmap-cell calendar-heatmap__day";
            if (dia === diaSelecionado) celula.classList.add("is-selected");
            celula.style.backgroundColor = obterCorMapaCalor(valor, escala);
            celula.classList.toggle("has-value", Number.isFinite(valor));
            celula.innerHTML = `<span>${dia}</span><strong>${formatarValorMapaCalor(valor)}</strong>`;
            celula.title = valor == null ? `${preencherDigitos(dia)}/${preencherDigitos(mesSelecionado)} sem dados` : `${preencherDigitos(dia)}/${preencherDigitos(mesSelecionado)} média ${valor.toFixed(1)}°C`;
            elementoDom.appendChild(celula);
        }
    }

    function renderizarMapaCalorHorario(registros, dataSelecionada, idRecipiente) {
        const elementoDom = document.getElementById(idRecipiente);
        if (!elementoDom) return;

        elementoDom.innerHTML = "";
        const valoresPorHora = mediaGrupo(registros, registro => registro.hour);
        const escala = obterEscalaValores(Object.values(valoresPorHora));
        const hoje = new Date();
        const deveDestacarHoraAtual = interpretarDataSelecionada(dataSelecionada)?.firebaseDate === ClimateData.dataAtual();
        const horaAtual = hoje.getHours();

        for (let hora = 0; hora < 24; hora++) {
            const valor = valoresPorHora[hora];
            const celula = document.createElement("span");
            celula.className = "heatmap-cell hourly-heatmap__cell";
            if (deveDestacarHoraAtual && hora === horaAtual) celula.classList.add("is-selected");
            celula.style.backgroundColor = obterCorMapaCalor(valor, escala);
            celula.classList.toggle("has-value", Number.isFinite(valor));
            celula.innerHTML = `<span>${preencherDigitos(hora)}h</span><strong>${formatarValorMapaCalor(valor)}</strong>`;
            celula.title = valor == null ? `${preencherDigitos(hora)}h sem dados` : `${preencherDigitos(hora)}h média ${valor.toFixed(1)}°C`;
            elementoDom.appendChild(celula);
        }
    }

    function renderizarMapaCalorSemanal(registros, dataSelecionada, idRecipiente) {
        const elementoDom = document.getElementById(idRecipiente);
        if (!elementoDom) return;

        const restaurarFoco = elementoDom.contains(document.activeElement);
        const indiceAnterior = Number(elementoDom.querySelector('[tabindex="0"]')?.dataset.indice);
        elementoDom.innerHTML = "";
        const partesData = interpretarDataSelecionada(dataSelecionada);
        if (!partesData) return;

        const registrosSemana = filtrarRegistrosDesdeInicioSemana(registros, partesData);
        const valores = {};
        registrosSemana.forEach(registro => {
            const diaSemana = new Date(registro.year, registro.month - 1, registro.day).getDay();
            const chave = `${diaSemana}-${registro.hour}`;
            if (!valores[chave]) valores[chave] = [];
            valores[chave].push(registro.value);
        });

        const mediasCalculadas = Object.fromEntries(
            Object.entries(valores).map(([chave, valoresDaChave]) => [chave, media(valoresDaChave)])
        );
        const escala = obterEscalaValores(Object.values(mediasCalculadas));
        const rotulosSemana = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
        const hoje = new Date();
        const deveDestacarFaixaAtual = partesData.firebaseDate === ClimateData.dataAtual();
        const diaSemanaAtual = hoje.getDay();
        const horaAtual = hoje.getHours();
        const inicioSemana = new Date(partesData.year, partesData.month - 1, partesData.day);
        inicioSemana.setDate(inicioSemana.getDate() - inicioSemana.getDay());
        const formatarData = data => `${preencherDigitos(data.getDate())}/${preencherDigitos(data.getMonth() + 1)}/${data.getFullYear()}`;
        const descricaoPeriodo = `Temperatura média horária, de ${formatarData(inicioSemana)} até ${formatarDataFirebaseRelatorio(dataSelecionada)}`;
        elementoDom.setAttribute("role", "group");
        elementoDom.setAttribute("aria-label", descricaoPeriodo);
        const celulas = [];

        const canto = document.createElement("span");
        canto.className = "weekly-heatmap__axis weekly-heatmap__axis--corner";
        elementoDom.appendChild(canto);

        for (let hora = 0; hora < 24; hora++) {
            const rotulo = document.createElement("span");
            rotulo.className = "weekly-heatmap__axis";
            rotulo.textContent = `${hora}h`;
            elementoDom.appendChild(rotulo);
        }

        for (let diaSemana = 0; diaSemana < 7; diaSemana++) {
            const rotuloLinha = document.createElement("span");
            rotuloLinha.className = "weekly-heatmap__axis weekly-heatmap__day";
            rotuloLinha.textContent = rotulosSemana[diaSemana];
            elementoDom.appendChild(rotuloLinha);

            for (let hora = 0; hora < 24; hora++) {
                const valor = mediasCalculadas[`${diaSemana}-${hora}`];
                const celula = document.createElement("button");
                celula.type = "button";
                celula.tabIndex = -1;
                celula.dataset.indice = String(diaSemana * 24 + hora);
                celula.className = "heatmap-cell weekly-heatmap__cell";
                if (deveDestacarFaixaAtual && diaSemana === diaSemanaAtual && hora === horaAtual) {
                    celula.classList.add("is-selected");
                }
                celula.style.backgroundColor = obterCorMapaCalor(valor, escala);
                const dataCelula = new Date(inicioSemana);
                dataCelula.setDate(inicioSemana.getDate() + diaSemana);
                const rotulo = `${rotulosSemana[diaSemana]}, ${formatarData(dataCelula)}, ${preencherDigitos(hora)}:00: ${Number.isFinite(valor) ? `média ${valor.toFixed(1)} °C` : "sem dados"}`;
                celula.title = rotulo;
                celula.setAttribute("aria-label", rotulo);
                celula.setAttribute("aria-pressed", "false");
                celulas.push(celula);
                elementoDom.appendChild(celula);
            }
        }
        let detalhe = document.getElementById(`${idRecipiente}Detalhe`);
        if (!detalhe) {
            detalhe = document.createElement("p");
            detalhe.id = `${idRecipiente}Detalhe`;
            detalhe.className = "heatmap-detail";
            detalhe.setAttribute("role", "status");
            elementoDom.after(detalhe);
        }
        let legenda = document.getElementById(`${idRecipiente}Legenda`);
        if (!legenda) {
            legenda = document.createElement("p");
            legenda.id = `${idRecipiente}Legenda`;
            legenda.className = "heatmap-legend";
            detalhe.after(legenda);
        }
        legenda.textContent = `${descricaoPeriodo}. ${Object.keys(mediasCalculadas).length ? `Escala relativa: azul ${escala.min.toFixed(1)} °C; verde intermediário; rosa ${escala.max.toFixed(1)} °C.` : "Sem leituras no período."} Células escuras: sem dados.`;

        function selecionar(indice, focar = false) {
            celulas.forEach((celula, posicao) => {
                celula.tabIndex = posicao === indice ? 0 : -1;
                celula.setAttribute("aria-pressed", String(posicao === indice));
            });
            const celula = celulas[indice];
            detalhe.textContent = celula.getAttribute("aria-label");
            if (focar) {
                celula.focus({ preventScroll: true });
                const area = elementoDom.getBoundingClientRect();
                const caixa = celula.getBoundingClientRect();
                const margemEsquerda = area.left + 56;
                if (caixa.left < margemEsquerda) elementoDom.scrollLeft -= margemEsquerda - caixa.left;
                else if (caixa.right > area.right - 4) elementoDom.scrollLeft += caixa.right - area.right + 4;
            }
        }
        elementoDom.onclick = evento => {
            const celula = evento.target.closest("button[data-indice]");
            if (celula && elementoDom.contains(celula)) selecionar(Number(celula.dataset.indice), true);
        };
        elementoDom.onkeydown = evento => {
            const celula = evento.target.closest("button[data-indice]");
            if (!celula) return;
            const indice = Number(celula.dataset.indice);
            const hora = indice % 24;
            const movimentos = {
                ArrowLeft: hora > 0 ? indice - 1 : indice,
                ArrowRight: hora < 23 ? indice + 1 : indice,
                ArrowUp: indice >= 24 ? indice - 24 : indice,
                ArrowDown: indice < 144 ? indice + 24 : indice,
                Home: evento.ctrlKey ? 0 : indice - hora,
                End: evento.ctrlKey ? 167 : indice - hora + 23,
            };
            if (!(evento.key in movimentos)) return;
            evento.preventDefault();
            selecionar(movimentos[evento.key], true);
        };
        selecionar(Number.isInteger(indiceAnterior) ? indiceAnterior : 0, restaurarFoco);
    }

    function filtrarRegistrosDesdeInicioSemana(registros, partesData) {
        const inicioSemana = new Date(partesData.year, partesData.month - 1, partesData.day);
        inicioSemana.setDate(inicioSemana.getDate() - inicioSemana.getDay());
        inicioSemana.setHours(0, 0, 0, 0);

        const fimDataSelecionada = new Date(partesData.year, partesData.month - 1, partesData.day);
        fimDataSelecionada.setHours(23, 59, 59, 999);

        return registros.filter(registro => {
            const dataRegistro = new Date(registro.year, registro.month - 1, registro.day);
            dataRegistro.setHours(12, 0, 0, 0);
            return dataRegistro >= inicioSemana && dataRegistro <= fimDataSelecionada;
        });
    }

    function interpretarDataSelecionada(valor) {
        const texto = String(valor || "").trim();
        let correspondencia = texto.match(/^(\d{2})-(\d{2})-(\d{4})$/);
        if (correspondencia) return montarPartesData(correspondencia[1], correspondencia[2], correspondencia[3]);

        correspondencia = texto.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
        if (correspondencia) return montarPartesData(correspondencia[1], correspondencia[2], correspondencia[3]);

        correspondencia = texto.match(/^(\d{4})-(\d{2})-(\d{2})$/);
        if (correspondencia) return montarPartesData(correspondencia[3], correspondencia[2], correspondencia[1]);

        return null;
    }

    function montarPartesData(textoDia, textoMes, textoAno) {
        const dia = Number(textoDia);
        const mes = Number(textoMes);
        const ano = Number(textoAno);
        if (!Number.isInteger(dia) || !Number.isInteger(mes) || !Number.isInteger(ano)) return null;
        if (mes < 1 || mes > 12 || dia < 1 || dia > 31) return null;

        return {
            day: dia,
            month: mes,
            year: ano,
            firebaseDate: `${preencherDigitos(dia)}-${preencherDigitos(mes)}-${ano}`,
        };
    }

    function adicionarCabecalhosDiasSemana(elementoDom) {
        ["D", "S", "T", "Q", "Q", "S", "S"].forEach(rotulo => {
            const cabecalho = document.createElement("span");
            cabecalho.className = "calendar-heatmap__weekday";
            cabecalho.textContent = rotulo;
            elementoDom.appendChild(cabecalho);
        });
    }

    function mediaGrupo(registros, obterChave) {
        const agrupado = {};
        registros.forEach(registro => {
            const chave = obterChave(registro);
            if (!agrupado[chave]) agrupado[chave] = [];
            agrupado[chave].push(registro.value);
        });

        return Object.fromEntries(
            Object.entries(agrupado).map(([chave, valores]) => [chave, media(valores)])
        );
    }

    function media(valores) {
        return valores.reduce((soma, valor) => soma + valor, 0) / valores.length;
    }

    function obterEscalaValores(valores) {
        const valoresValidos = valores.filter(Number.isFinite);
        if (!valoresValidos.length) return { min: 20, max: 30 };
        const minimo = Math.min(...valoresValidos);
        const maximo = Math.max(...valoresValidos);
        return minimo === maximo ? { min: minimo - 1, max: maximo + 1 } : { min: minimo, max: maximo };
    }

    function obterCorMapaCalor(valor, escala) {
        if (!Number.isFinite(valor)) return "rgba(71, 85, 105, 0.18)";

        const proporcao = Math.min(1, Math.max(0, (valor - escala.min) / (escala.max - escala.min)));
        if (proporcao < 0.5) {
            const proporcaoInferior = proporcao / 0.5;
            return interpolarCor([56, 189, 248], [52, 211, 153], proporcaoInferior);
        }

        const localAtual = (proporcao - 0.5) / 0.5;
        return interpolarCor([52, 211, 153], [251, 113, 133], localAtual);
    }

    function interpolarCor(de, ate, proporcao) {
        const cor = de.map((inicio, indice) => Math.round(inicio + (ate[indice] - inicio) * proporcao));
        return `rgb(${cor[0]}, ${cor[1]}, ${cor[2]})`;
    }

    function formatarEstatistica(valor, sufixo) {
        return `${valor.toFixed(2)}${sufixo}`;
    }

    function formatarDiferenca(valor, sufixo) {
        const sinal = valor > 0 ? "+" : "";
        return `${sinal}${valor.toFixed(2)}${sufixo}`;
    }

    function formatarDataFirebaseRelatorio(dataReferencia) {
        return dataReferencia ? dataReferencia.replace(/-/g, "/") : "--";
    }

    function formatarValorMapaCalor(valor) {
        return Number.isFinite(valor) ? `${valor.toFixed(1)}°` : "--";
    }

    function preencherDigitos(valor) {
        return String(valor).padStart(2, "0");
    }

    window.ClimateAnalytics = {
        renderStats: renderizarEstatisticas,
        renderAdvancedClimateViews: renderizarVisualizacoesClimaticasAvancadas,
        calculateStats: calcularEstatisticas,
    };
})();
