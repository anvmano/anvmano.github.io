'use strict';

(function () {
    const LIMIARES = Object.freeze({
        umidadeAtencao: 60,
        umidadeAlta: 70,
        umidadeMuitoAlta: 80,
        diferencaOrvalhoAtencao: 4,
        diferencaOrvalhoAlta: 2,
        aqiAtencao: 100,
        chuvaProvavel: 60,
        chuvaPossivel: 35,
        rajadaForte: 40,
    });

    function calcularPontoOrvalho(temperatura, umidade) {
        const temperaturaNumero = Number(temperatura);
        const umidadeNumero = Number(umidade);
        if (!Number.isFinite(temperaturaNumero) || !Number.isFinite(umidadeNumero) || umidadeNumero <= 0 || umidadeNumero > 100) {
            return null;
        }

        // Equacao de Magnus: aproximacao adequada para ambientes residenciais.
        const constanteA = 17.62;
        const constanteB = 243.12;
        const gamma = Math.log(umidadeNumero / 100) + ((constanteA * temperaturaNumero) / (constanteB + temperaturaNumero));
        const pontoOrvalho = (constanteB * gamma) / (constanteA - gamma);
        return Number.isFinite(pontoOrvalho) ? pontoOrvalho : null;
    }

    function avaliarRiscoMofo({ temperatura, umidade, pontoOrvalho } = {}) {
        const temperaturaNumero = numeroOuNulo(temperatura);
        const umidadeNumero = numeroOuNulo(umidade);
        const orvalho = numeroOuNulo(pontoOrvalho) ?? calcularPontoOrvalho(temperaturaNumero, umidadeNumero);

        if (temperaturaNumero === null || umidadeNumero === null || orvalho === null) {
            return criarResultadoIndisponivel("Sem dados suficientes para estimar o risco de mofo.");
        }

        const margemCondensacao = temperaturaNumero - orvalho;
        if (umidadeNumero >= LIMIARES.umidadeMuitoAlta || margemCondensacao <= LIMIARES.diferencaOrvalhoAlta) {
            return {
                nivel: "alto",
                rotulo: "Risco alto",
                classe: "alerta",
                descricao: "Umidade elevada ou ar próximo da condensação. Ventile e acompanhe superfícies frias.",
                pontoOrvalho: orvalho,
                margemCondensacao,
            };
        }

        if (umidadeNumero >= LIMIARES.umidadeAlta || margemCondensacao <= LIMIARES.diferencaOrvalhoAtencao) {
            return {
                nivel: "moderado",
                rotulo: "Atenção",
                classe: "atencao",
                descricao: "Há condição favorável à condensação em superfícies mais frias.",
                pontoOrvalho: orvalho,
                margemCondensacao,
            };
        }

        if (umidadeNumero >= LIMIARES.umidadeAtencao) {
            return {
                nivel: "baixo",
                rotulo: "Monitorar",
                classe: "atencao",
                descricao: "Risco ainda baixo, mas a umidade já pede acompanhamento.",
                pontoOrvalho: orvalho,
                margemCondensacao,
            };
        }

        return {
            nivel: "muito_baixo",
            rotulo: "Risco baixo",
            classe: "favoravel",
            descricao: "O ar está distante da condensação e da faixa mais favorável ao mofo.",
            pontoOrvalho: orvalho,
            margemCondensacao,
        };
    }

    function analisarIndiceUv(valorAtual, valorMaximo = null) {
        const atual = numeroOuNulo(valorAtual);
        const maximo = numeroOuNulo(valorMaximo);
        const valor = atual ?? maximo;
        if (valor === null) return criarResultadoIndisponivel("Índice UV indisponível para esta localização.");

        if (valor < 3) {
            return criarResultado("Baixo", "favoravel", "Proteção básica em exposições prolongadas.", valor, maximo);
        }
        if (valor < 6) {
            return criarResultado("Moderado", "atencao", "Use protetor solar e prefira sombra perto do meio-dia.", valor, maximo);
        }
        if (valor < 8) {
            return criarResultado("Alto", "alerta", "Reduza a exposição direta e use proteção solar completa.", valor, maximo);
        }
        if (valor < 11) {
            return criarResultado("Muito alto", "alerta", "Evite exposição prolongada nos horários de pico.", valor, maximo);
        }
        return criarResultado("Extremo", "critico", "Evite o sol direto; pele e olhos podem sofrer dano rapidamente.", valor, maximo);
    }

    function resumirChuva(previsao = [], atualizadoEm = new Date(), quantidadeHoras = 6) {
        const inicio = dataValida(atualizadoEm) || new Date();
        const limite = new Date(inicio.getTime() + quantidadeHoras * 60 * 60 * 1000);
        const proximasHoras = previsao.filter(item => {
            const horario = dataValida(item?.horario);
            return horario && horario >= inicio && horario <= limite;
        });

        if (!proximasHoras.length) {
            return criarResultadoIndisponivel(`Previsão de chuva indisponível para as próximas ${quantidadeHoras}h.`);
        }

        const probabilidade = maximoNumerico(proximasHoras.map(item => item.probabilidadeChuva));
        const intensidadeMaxima = maximoNumerico(proximasHoras.map(item => item.precipitacao));
        const acumulado = proximasHoras.reduce((total, item) => total + (numeroOuNulo(item.precipitacao) ?? 0), 0);
        const horarioPico = proximasHoras.reduce((pico, item) => {
            const intensidade = numeroOuNulo(item.precipitacao) ?? 0;
            return !pico || intensidade > pico.intensidade ? { intensidade, horario: item.horario } : pico;
        }, null);

        let rotulo = "Sem chuva relevante";
        let classe = "favoravel";
        let descricao = "Baixa indicação de chuva nas próximas horas.";
        if ((probabilidade ?? 0) >= LIMIARES.chuvaProvavel || (intensidadeMaxima ?? 0) >= 2.5) {
            rotulo = (intensidadeMaxima ?? 0) >= 10 ? "Chuva forte" : (intensidadeMaxima ?? 0) >= 2.5 ? "Chuva moderada" : "Chuva provável";
            classe = (intensidadeMaxima ?? 0) >= 10 ? "critico" : "alerta";
            descricao = `Maior intensidade prevista perto de ${formatarHora(horarioPico?.horario)}.`;
        } else if ((probabilidade ?? 0) >= LIMIARES.chuvaPossivel || acumulado >= 0.1) {
            rotulo = "Possibilidade de chuva";
            classe = "atencao";
            descricao = `Pode chover perto de ${formatarHora(horarioPico?.horario)}.`;
        }

        return {
            rotulo,
            classe,
            descricao,
            probabilidade: probabilidade ?? 0,
            intensidadeMaxima: intensidadeMaxima ?? 0,
            acumulado,
            periodoHoras: quantidadeHoras,
            horarioPico: horarioPico?.horario || null,
        };
    }

    function recomendarVentilacaoExterna({ climaAtual = {}, aqi = {}, chuva = null } = {}) {
        const temperatura = numeroOuNulo(climaAtual.temperatura);
        const umidade = numeroOuNulo(climaAtual.umidade);
        const rajada = numeroOuNulo(climaAtual.rajadaVento);
        const valorAqi = numeroOuNulo(aqi.valor);
        const resumoChuva = chuva || criarResultadoIndisponivel("");

        if (temperatura === null && umidade === null && valorAqi === null) {
            return criarResultadoIndisponivel("Sem dados externos suficientes para recomendar ventilação.");
        }

        const impedimentos = [];
        if (valorAqi !== null && valorAqi > LIMIARES.aqiAtencao) impedimentos.push("qualidade do ar externa desfavorável");
        if (["alerta", "critico"].includes(resumoChuva.classe)) impedimentos.push("chuva provável");
        if (rajada !== null && rajada >= LIMIARES.rajadaForte) impedimentos.push("rajadas fortes");
        if (temperatura !== null && (temperatura < 12 || temperatura > 33)) impedimentos.push("temperatura externa extrema");

        if (impedimentos.length) {
            return {
                rotulo: "Evite por enquanto",
                classe: "alerta",
                descricao: `Condição externa limitante: ${impedimentos.join(", ")}.`,
            };
        }

        const ressalvas = [];
        if (umidade !== null && (umidade < 30 || umidade > 78)) ressalvas.push("umidade externa pouco favorável");
        if (temperatura !== null && (temperatura < 16 || temperatura > 30)) ressalvas.push("temperatura externa fora da faixa amena");
        if (resumoChuva.classe === "atencao") ressalvas.push("há possibilidade de chuva");

        if (ressalvas.length) {
            return {
                rotulo: "Ventile com atenção",
                classe: "atencao",
                descricao: `${ressalvas.join("; ")}. Prefira uma abertura curta e acompanhe o ambiente.`,
            };
        }

        return {
            rotulo: "Boa hora para ventilar",
            classe: "favoravel",
            descricao: "As condições externas estão favoráveis à renovação do ar.",
        };
    }

    function recomendarVentilacaoInterna({ temperatura, umidade, aqi, riscoMofo } = {}) {
        const temperaturaNumero = numeroOuNulo(temperatura);
        const umidadeNumero = numeroOuNulo(umidade);
        const aqiNumero = numeroOuNulo(aqi);
        if (temperaturaNumero === null && umidadeNumero === null && aqiNumero === null) {
            return criarResultadoIndisponivel("Sem leituras internas suficientes para avaliar ventilação.");
        }

        const motivos = [];
        if (aqiNumero !== null && aqiNumero > LIMIARES.aqiAtencao) motivos.push("AQI interno elevado");
        if (umidadeNumero !== null && umidadeNumero > 60) motivos.push("umidade acima da faixa de conforto");
        if (temperaturaNumero !== null && temperaturaNumero > 26) motivos.push("temperatura acima da faixa de conforto");
        if (["moderado", "alto"].includes(riscoMofo?.nivel)) motivos.push("risco de condensação/mofo");

        if (motivos.length) {
            return {
                rotulo: "Renovação recomendada",
                classe: "atencao",
                descricao: `${motivos.join("; ")}. Consulte o clima externo antes de abrir as janelas.`,
            };
        }

        return {
            rotulo: "Ambiente equilibrado",
            classe: "favoravel",
            descricao: "Os sensores internos não indicam necessidade urgente de ventilação.",
        };
    }

    function recomendarVentilacaoCombinada({ interna, externa } = {}) {
        if (!interna || interna.classe === "indisponivel") return externa;
        if (!externa || externa.classe === "indisponivel") return interna;
        if (["alerta", "critico"].includes(externa.classe)) return externa;

        if (interna.rotulo === "Renovação recomendada" && externa.classe === "favoravel") {
            return {
                rotulo: "Ventile agora",
                classe: "favoravel",
                descricao: "O ambiente pede renovação e as condições externas estão favoráveis.",
            };
        }

        if (interna.rotulo === "Renovação recomendada") {
            return {
                rotulo: "Ventile brevemente",
                classe: "atencao",
                descricao: "O ambiente pede renovação, mas há ressalvas no clima externo.",
            };
        }

        return externa.classe === "favoravel" ? interna : externa;
    }

    function criarResultado(rotulo, classe, descricao, valor, maximo) {
        return { rotulo, classe, descricao, valor, maximo };
    }

    function criarResultadoIndisponivel(descricao) {
        return { rotulo: "Indisponível", classe: "indisponivel", descricao };
    }

    function numeroOuNulo(valor) {
        if (valor === null || valor === undefined || valor === "") return null;
        const numero = Number(valor);
        return Number.isFinite(numero) ? numero : null;
    }

    function dataValida(valor) {
        const data = valor instanceof Date ? valor : new Date(valor);
        return Number.isNaN(data.getTime()) ? null : data;
    }

    function maximoNumerico(valores) {
        const numeros = valores.map(numeroOuNulo).filter(valor => valor !== null);
        return numeros.length ? Math.max(...numeros) : null;
    }

    function formatarHora(valor) {
        const data = dataValida(valor);
        if (!data) return "--:--";
        return `${String(data.getHours()).padStart(2, "0")}:${String(data.getMinutes()).padStart(2, "0")}`;
    }

    window.ClimateInsightsAmbientais = {
        calcularPontoOrvalho,
        avaliarRiscoMofo,
        analisarIndiceUv,
        resumirChuva,
        recomendarVentilacaoExterna,
        recomendarVentilacaoInterna,
        recomendarVentilacaoCombinada,
    };
})();
