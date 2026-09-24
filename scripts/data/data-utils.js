'use strict';

(function () {
    const ROTULOS_CABECALHOS = {
        temperaturaDS18B20: "Temperatura",
        "Sensacao termica": "Sensação térmica",
        sensacaoTermica: "Sensação térmica",
        PH: "pH",
        Aceton: "Acetona",
        Alcohol: "Álcool",
        NH4: "Amônia",
        Toluen: "Tolueno"
    };

    function obterUnidadeMedicao(chave) {
        return window.AppConfig?.measurementUnits?.[chave] || "";
    }

    function normalizarValorMedicao(chave, valor) {
        if (valor === null || valor === undefined || (typeof valor === "string" && valor.trim() === "")) {
            return null;
        }
        const valorNumerico = Number(valor);
        if (!Number.isFinite(valorNumerico)) return null;

        const esquema = window.AppConfig?.sensorSchemas?.[chave];
        if (esquema?.sentinels?.includes(valorNumerico)) return null;
        if (Number.isFinite(esquema?.divisor) && esquema.divisor !== 0) return valorNumerico / esquema.divisor;
        if (chave === "TDS") return valorNumerico / 10;
        if (chave === "Turbidez") return valorNumerico / 1000;
        return valorNumerico;
    }

    function formatarValorTabela(chave, valor) {
        const valorNumerico = normalizarValorMedicao(chave, valor);
        if (valorNumerico === null) return "--";

        const unidade = obterUnidadeMedicao(chave);
        return unidade ? `${valorNumerico.toFixed(2)}${unidade}` : valorNumerico.toFixed(2);
    }

    function dataAtual() {
        const d = new Date();
        return `${String(d.getDate()).padStart(2, "0")}-${String(d.getMonth() + 1).padStart(2, "0")}-${d.getFullYear()}`;
    }

    function interpretarDataFirebase(textoString) {
        const [d, m, y] = textoString.split("-").map(Number);
        return new Date(y, m - 1, d);
    }

    function filtrarDadosPorDias(dados, dias, dataSelecionada, usarDataSelecionada = true) {
        if (usarDataSelecionada && dataSelecionada) {
            const dadosSelecionados = dados[dataSelecionada];

            if (!dadosSelecionados) return {};

            return {
                [dataSelecionada]: dadosSelecionados
            };
        }

        const dataLimite = new Date();
        dataLimite.setDate(dataLimite.getDate() - dias);
        dataLimite.setHours(0, 0, 0, 0);

        const filtrado = {};

        for (const dataReferencia of Object.keys(dados).sort((a, b) => interpretarDataFirebase(a) - interpretarDataFirebase(b))) {
            if (interpretarDataFirebase(dataReferencia) >= dataLimite) {
                filtrado[dataReferencia] = dados[dataReferencia];
            }
        }

        return filtrado;
    }

    function obterJanelaHoras(dataSelecionada, horas = 24, dataReferenciaAtual = new Date()) {
        const partesDataSelecionada = interpretarPartesDataFirebase(dataSelecionada || dataAtual());
        if (!partesDataSelecionada) return null;

        const fimJanela = new Date(
            partesDataSelecionada.year,
            partesDataSelecionada.month - 1,
            partesDataSelecionada.day,
            dataReferenciaAtual.getHours(),
            dataReferenciaAtual.getMinutes(),
            dataReferenciaAtual.getSeconds(),
            dataReferenciaAtual.getMilliseconds()
        );
        const inicioJanela = new Date(fimJanela);
        inicioJanela.setHours(inicioJanela.getHours() - horas);
        return { inicio: inicioJanela, fim: fimJanela };
    }

    function filtrarDadosPorJanelaHoras(dados, dataSelecionada, horas = 24, dataReferenciaAtual = new Date()) {
        const janela = obterJanelaHoras(dataSelecionada, horas, dataReferenciaAtual);
        if (!janela) return {};
        const { inicio: inicioJanela, fim: fimJanela } = janela;

        const filtrado = {};

        for (const dataReferencia of Object.keys(dados || {}).sort((a, b) => interpretarDataFirebase(a) - interpretarDataFirebase(b))) {
            const dadosData = dados[dataReferencia];
            if (!dadosData || typeof dadosData !== "object") continue;

            for (const horario of Object.keys(dadosData).sort()) {
                const instanteRegistro = interpretarDataHoraFirebase(dataReferencia, horario);
                if (!instanteRegistro || instanteRegistro < inicioJanela || instanteRegistro > fimJanela) continue;

                filtrado[dataReferencia] ||= {};
                filtrado[dataReferencia][horario] = dadosData[horario];
            }
        }

        return filtrado;
    }

    function interpretarDataHoraFirebase(dataReferencia, horario) {
        const partesData = interpretarPartesDataFirebase(dataReferencia);
        if (!partesData) return null;

        const [textoHora, textoMinuto = "0"] = String(horario || "").split("-");
        const hora = Number(textoHora);
        const minuto = Number(textoMinuto);
        if (!Number.isInteger(hora) || !Number.isInteger(minuto)) return null;
        if (hora < 0 || hora > 23 || minuto < 0 || minuto > 59) return null;

        return new Date(partesData.year, partesData.month - 1, partesData.day, hora, minuto, 0, 0);
    }

    function interpretarPartesDataFirebase(dataReferencia) {
        const [dia, mes, ano] = String(dataReferencia || "").split("-").map(Number);
        if (!Number.isInteger(dia) || !Number.isInteger(mes) || !Number.isInteger(ano)) return null;
        if (mes < 1 || mes > 12 || dia < 1 || dia > 31) return null;
        return { day: dia, month: mes, year: ano };
    }

    function converterDataEntradaParaFirebase(textoData) {
        if (!textoData) return dataAtual();

        const [ano, mes, dia] = textoData.split("-");

        return `${dia}-${mes}-${ano}`;
    }

    function converterDataFirebaseParaEntrada(textoData) {
        const [dia, mes, ano] = textoData.split("-");

        return `${ano}-${mes}-${dia}`;
    }

    function criarTabelas(cabecalhos, dados) {
        const tabela = document.createElement("table");
        tabela.dataset.exportName = "estacao-climatica";
        const analisesQualidade = Object.fromEntries(cabecalhos.slice(2).map(campo => [
            campo,
            window.ClimateDataQuality?.analisarSerie?.(dados, campo) || null,
        ]));

        const linhaCabecalho = tabela.createTHead().insertRow();
        cabecalhos.forEach(chave => {
            const th = document.createElement("th");
            th.innerText = ROTULOS_CABECALHOS[chave] || chave;
            linhaCabecalho.appendChild(th);
        });

        const todasDatas = Object.keys(dados).sort((a, b) => interpretarDataFirebase(b) - interpretarDataFirebase(a));

        let ultimaData = null;
        let quantidadeLinhas = 0;
        const corpo = tabela.createTBody();

        for (const dataReferencia of todasDatas) {
            if (quantidadeLinhas >= 24) break;
            const dadosData = dados[dataReferencia];
            if (!dadosData || typeof dadosData !== "object") continue;
            const todosHorarios = Object.keys(dadosData).sort().reverse();

            for (const horario of todosHorarios) {
                const dadosHorario = dadosData[horario];
                if (!dadosHorario || typeof dadosHorario !== "object") continue;
                for (const chave in dadosHorario) {
                    if (quantidadeLinhas >= 24) break;
                    const item = dadosHorario[chave];
                    if (!item || typeof item !== "object") continue;
                    const linha = corpo.insertRow();
                    linha.dataset.timestamp = `${formatarDataOrdenavel(dataReferencia)}T${formatarHorarioOrdenavel(horario)}`;

                    linha.insertCell().innerText = dataReferencia !== ultimaData ? dataReferencia.replace(/-/g, "/") : "";
                    const [hora, minuto] = horario.split("-");
                    linha.insertCell().innerText = `${hora.padStart(2, "0")}:${minuto.padStart(2, "0")}`;

                    for (let i = 2; i < cabecalhos.length; i++) {
                        const campo = cabecalhos[i];
                        const valorAbreviado = item[campo];
                        const celula = linha.insertCell();
                        const qualidade = window.ClimateDataQuality?.obterQualidadeLeitura?.(
                            analisesQualidade[campo],
                            dataReferencia,
                            horario,
                            chave
                        );
                        celula.innerText = formatarValorTabela(campo, valorAbreviado);
                        if (qualidade && qualidade.nivel !== "normal") {
                            celula.classList.add(`table-cell--${qualidade.nivel}`);
                            celula.title = qualidade.motivos.join(" ");
                            celula.innerText += " ⚠";
                        }
                    }

                    quantidadeLinhas++;
                    ultimaData = dataReferencia;
                }
            }
        }

        return tabela;
    }

    function formatarDataOrdenavel(dados) {
        const [dia, mes, ano] = String(dados || "").split("-");
        return `${ano}-${mes}-${dia}`;
    }

    function formatarHorarioOrdenavel(horario) {
        const [hora, minuto = "0"] = String(horario || "").split("-");
        return `${String(hora).padStart(2, "0")}:${String(minuto).padStart(2, "0")}`;
    }

    function extrairDados(dados, chaves) {
        const todasDatas = Object.keys(dados || {});
        const horas = [];
        const dadosExtraidos = Object.fromEntries(chaves.map(k => [k, []]));

        for (const dataReferencia of todasDatas.sort((a, b) => interpretarDataFirebase(a) - interpretarDataFirebase(b))) {
            const dadosData = dados[dataReferencia];
            if (!dadosData || typeof dadosData !== "object") continue;
            const todosHorarios = Object.keys(dadosData).sort();
            for (const horario of todosHorarios) {
                const dadosHorario = dadosData[horario];
                if (!dadosHorario || typeof dadosHorario !== "object") continue;
                const [parteHora, parteMinuto = "0"] = horario.split("-");
                const hora = Number(parteHora);
                const minuto = Number(parteMinuto);
                const horaDecimal = hora + (Number.isFinite(minuto) ? minuto / 60 : 0);
                for (const chaveItem in dadosHorario) {
                    const item = dadosHorario[chaveItem];
                    if (!item || typeof item !== "object") continue;
                    horas.push(horaDecimal);
                    chaves.forEach(chaveDados => {
                        dadosExtraidos[chaveDados].push(normalizarValorMedicao(chaveDados, item[chaveDados]));
                    });
                }
            }
        }

        return { hours: horas, ...dadosExtraidos };
    }

    function mapearIntervalo(valor, minimoEntrada, maximoEntrada, minimoSaida, maximoSaida) {
        return (valor - minimoEntrada) * (maximoSaida - minimoSaida) / (maximoEntrada - minimoEntrada) + minimoSaida;
    }

    function formatarTempo(valor) {
        const valorNumerico = Number(valor);
        if (!Number.isFinite(valorNumerico)) return "--";

        const totalMinutosSolar = Math.round(valorNumerico * 60);
        const horas = Math.floor(totalMinutosSolar / 60) % 24;
        const minutos = ((totalMinutosSolar % 60) + 60) % 60;
        return `${String(horas).padStart(2, "0")}:${String(minutos).padStart(2, "0")}`;
    }

    function formatarListaHoras(horas) {
        return horas.map(h => formatarTempo(h));
    }

    function converterSegundosParaHoras(segundos) {
        return segundos / 3600;
    }

    window.ClimateData = {
        dataAtual,
        parseFirebaseDate: interpretarDataFirebase,
        parseFirebaseDateTime: interpretarDataHoraFirebase,
        filterDataByDays: filtrarDadosPorDias,
        filterDataByRollingHours: filtrarDadosPorJanelaHoras,
        getRollingWindow: obterJanelaHoras,
        convertInputDateToFirebase: converterDataEntradaParaFirebase,
        convertFirebaseDateToInput: converterDataFirebaseParaEntrada,
        createTables: criarTabelas,
        extractData: extrairDados,
        normalizeMeasurementValue: normalizarValorMedicao,
        mapRange: mapearIntervalo,
        formatTime: formatarTempo,
        formatHoursArray: formatarListaHoras,
        secondsToHours: converterSegundosParaHoras,
    };
})();
