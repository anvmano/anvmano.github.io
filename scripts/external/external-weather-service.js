'use strict';

(function () {
    const config = () => window.AppConfig.externalApis;

    function limparCep(cep) {
        return String(cep || "").replace(/\D/g, "");
    }

    async function buscarPorCep(cepInformado) {
        const cep = limparCep(cepInformado);
        if (cep.length !== 8) throw criarErroEsperado("Informe um CEP com 8 dígitos.", "cep_invalido");

        const endereco = await buscarEnderecoPorCep(cep);
        const coordenadas = await buscarCoordenadasPorEndereco(endereco);
        return buscarPorCoordenadas({
            ...coordenadas,
            origem: {
                tipo: "cep",
                cep,
                rotulo: montarRotuloEndereco(endereco),
            },
        });
    }

    async function pesquisarCidades(nomeInformado) {
        const termo = normalizarTermoCidade(nomeInformado);
        if (termo.length < 2) {
            throw criarErroEsperado("Informe pelo menos 2 caracteres para pesquisar a cidade.", "cidade_invalida");
        }

        const resultados = await consultarGeocodificacao(termo, 5);
        const cidades = resultados
            .map(normalizarCidadeOpenMeteo)
            .filter(cidade => Number.isFinite(cidade.latitude) && Number.isFinite(cidade.longitude));

        const cidadesUnicas = Array.from(new Map(
            cidades.map(cidade => [`${cidade.id || ""}:${cidade.latitude}:${cidade.longitude}`, cidade])
        ).values());

        if (!cidadesUnicas.length) {
            throw criarErroEsperado("Cidade não encontrada. Confira o nome e tente novamente.", "cidade_nao_encontrada");
        }

        return cidadesUnicas;
    }

    async function buscarPorCidade(cidade) {
        const latitude = Number(cidade?.latitude);
        const longitude = Number(cidade?.longitude);
        if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
            throw criarErroEsperado("Selecione uma cidade válida.", "cidade_invalida");
        }

        return buscarPorCoordenadas({
            latitude,
            longitude,
            origem: {
                tipo: "cidade",
                rotulo: cidade.rotulo || montarRotuloCidade(cidade),
            },
        });
    }

    async function buscarPorCoordenadas({ latitude, longitude, origem = {} }) {
        if (!Number.isFinite(Number(latitude)) || !Number.isFinite(Number(longitude))) {
            throw new Error("Coordenadas inválidas.");
        }

        const [clima, qualidadeAr] = await Promise.all([
            buscarClima(latitude, longitude),
            buscarQualidadeAr(latitude, longitude).catch(() => null),
        ]);

        return normalizarRespostaPublica({
            clima,
            qualidadeAr,
            origem: {
                tipo: origem.tipo || "localizacao",
                rotulo: origem.rotulo || "Localização atual",
                latitude: Number(latitude),
                longitude: Number(longitude),
                precisao: origem.precisao,
            },
        });
    }

    async function buscarEnderecoPorCep(cep) {
        try {
            const resposta = await fetch(`${config().brasilApiCepUrl}/${cep}`);
            if (resposta.ok) return normalizarEnderecoBrasilApi(await resposta.json());
        } catch (erro) {
            window.ClimateDiagnostics?.depurar("BrasilAPI indisponível, tentando ViaCEP.", erro);
        }

        const resposta = await fetch(`${config().viaCepUrl}/${cep}/json/`);
        if (!resposta.ok) throw new Error("Não foi possível consultar o CEP.");
        const dados = await resposta.json();
        if (dados.erro) throw criarErroEsperado("CEP não encontrado.", "cep_nao_encontrado");
        return normalizarEnderecoViaCep(dados);
    }

    async function buscarCoordenadasPorEndereco(endereco) {
        if (Number.isFinite(endereco.latitude) && Number.isFinite(endereco.longitude)) {
            return {
                latitude: endereco.latitude,
                longitude: endereco.longitude,
            };
        }

        const tentativas = [
            endereco.cidade,
            [endereco.cidade, endereco.estado].filter(Boolean).join(" "),
            [endereco.cidade, endereco.estado, "Brasil"].filter(Boolean).join(" "),
        ].filter(Boolean);

        let resultado = null;
        for (const termo of tentativas) {
            resultado = await buscarCoordenadaOpenMeteo(termo);
            if (resultado) break;
        }

        if (!resultado) throw new Error("Não foi possível encontrar coordenadas para o CEP.");

        return {
            latitude: Number(resultado.latitude),
            longitude: Number(resultado.longitude),
        };
    }

    async function buscarCoordenadaOpenMeteo(termo) {
        const resultados = await consultarGeocodificacao(termo, 1);
        return resultados[0] || null;
    }

    async function consultarGeocodificacao(termo, quantidade) {
        const url = new URL(config().openMeteoGeocodingUrl);
        url.searchParams.set("name", termo);
        url.searchParams.set("count", String(quantidade));
        url.searchParams.set("language", "pt");
        url.searchParams.set("format", "json");
        url.searchParams.set("countryCode", "BR");

        const resposta = await fetch(url);
        if (!resposta.ok) throw new Error("Não foi possível pesquisar a localização.");
        const dados = await resposta.json();
        return dados.results || [];
    }

    async function buscarClima(latitude, longitude) {
        const url = new URL(config().openMeteoForecastUrl);
        url.searchParams.set("latitude", latitude);
        url.searchParams.set("longitude", longitude);
        url.searchParams.set("timezone", "auto");
        url.searchParams.set("past_days", "1");
        url.searchParams.set("forecast_days", "2");
        url.searchParams.set("current", "temperature_2m,relative_humidity_2m,apparent_temperature,dew_point_2m,pressure_msl,precipitation,rain,weather_code,cloud_cover,wind_speed_10m,wind_gusts_10m,uv_index");
        url.searchParams.set("hourly", "temperature_2m,relative_humidity_2m,apparent_temperature,dew_point_2m,pressure_msl,precipitation_probability,precipitation,rain,showers,weather_code,cloud_cover,wind_speed_10m,wind_gusts_10m,uv_index");
        url.searchParams.set("daily", "sunrise,sunset,daylight_duration,uv_index_max,precipitation_probability_max,precipitation_sum,weather_code");

        const resposta = await fetch(url);
        if (!resposta.ok) throw new Error("Não foi possível consultar o clima externo.");
        return resposta.json();
    }

    async function buscarQualidadeAr(latitude, longitude) {
        const url = new URL(config().openMeteoAirQualityUrl);
        url.searchParams.set("latitude", latitude);
        url.searchParams.set("longitude", longitude);
        url.searchParams.set("timezone", "auto");
        url.searchParams.set("past_days", "1");
        url.searchParams.set("forecast_days", "1");
        url.searchParams.set("current", "us_aqi");
        url.searchParams.set("hourly", "us_aqi");

        const resposta = await fetch(url);
        if (!resposta.ok) throw new Error("Não foi possível consultar AQI externo.");
        return resposta.json();
    }

    function normalizarEnderecoBrasilApi(dados) {
        return {
            cep: dados.cep,
            cidade: dados.city,
            estado: dados.state,
            bairro: dados.neighborhood,
            rua: dados.street,
            latitude: numeroOuNulo(dados.location?.coordinates?.latitude || dados.location?.coordinates?.lat),
            longitude: numeroOuNulo(dados.location?.coordinates?.longitude || dados.location?.coordinates?.lng),
        };
    }

    function normalizarEnderecoViaCep(dados) {
        return {
            cep: dados.cep,
            cidade: dados.localidade,
            estado: dados.uf,
            bairro: dados.bairro,
            rua: dados.logradouro,
        };
    }

    function normalizarCidadeOpenMeteo(dados) {
        const cidade = {
            id: dados?.id,
            nome: String(dados?.name || "").trim(),
            estado: String(dados?.admin1 || "").trim(),
            regiao: String(dados?.admin2 || "").trim(),
            pais: String(dados?.country || "Brasil").trim(),
            codigoPais: String(dados?.country_code || "BR").trim(),
            latitude: numeroOuNulo(dados?.latitude),
            longitude: numeroOuNulo(dados?.longitude),
            fusoHorario: String(dados?.timezone || "").trim(),
        };
        cidade.rotulo = montarRotuloCidade(cidade);
        return cidade;
    }

    function montarRotuloCidade(cidade) {
        return [cidade?.nome, cidade?.estado].filter(Boolean).join(" - ") || "Cidade selecionada";
    }

    function normalizarTermoCidade(valor) {
        return String(valor || "").trim().replace(/\s+/g, " ");
    }

    function criarErroEsperado(mensagem, codigo) {
        const erro = new Error(mensagem);
        erro.name = "ErroConsultaPublica";
        erro.codigo = codigo;
        erro.esperado = true;
        return erro;
    }

    function montarRotuloEndereco(endereco) {
        return [endereco.cidade, endereco.estado].filter(Boolean).join(" - ") || `CEP ${endereco.cep}`;
    }

    function normalizarRespostaPublica({ clima, qualidadeAr, origem }) {
        const atual = clima.current || {};
        const horarioAtual = atual.time ? new Date(atual.time) : new Date();
        const eventosSolares = obterEventosSolares(clima.daily, atual.time);
        const indiceDiario = obterIndiceDiario(clima.daily, atual.time);

        return {
            origem,
            atualizadoEm: horarioAtual,
            climaAtual: {
                temperatura: numeroOuNulo(atual.temperature_2m),
                sensacaoTermica: numeroOuNulo(atual.apparent_temperature),
                umidade: numeroOuNulo(atual.relative_humidity_2m),
                pressao: numeroOuNulo(atual.pressure_msl),
                pontoOrvalho: numeroOuNulo(atual.dew_point_2m),
                precipitacao: numeroOuNulo(atual.precipitation),
                chuva: numeroOuNulo(atual.rain),
                codigoTempo: numeroOuNulo(atual.weather_code),
                nebulosidade: numeroOuNulo(atual.cloud_cover),
                velocidadeVento: numeroOuNulo(atual.wind_speed_10m),
                rajadaVento: numeroOuNulo(atual.wind_gusts_10m),
                indiceUv: numeroOuNulo(atual.uv_index),
            },
            seriesHorarias: {
                horarios: clima.hourly?.time || [],
                temperatura: normalizarSerie(clima.hourly?.temperature_2m),
                sensacaoTermica: normalizarSerie(clima.hourly?.apparent_temperature),
                umidade: normalizarSerie(clima.hourly?.relative_humidity_2m),
                pressao: normalizarSerie(clima.hourly?.pressure_msl),
                pontoOrvalho: normalizarSerie(clima.hourly?.dew_point_2m),
            },
            previsaoCurtoPrazo: montarPrevisaoCurtoPrazo(clima.hourly),
            previsaoDiaria: {
                indiceUvMaximo: numeroOuNulo(clima.daily?.uv_index_max?.[indiceDiario]),
                probabilidadeChuvaMaxima: numeroOuNulo(clima.daily?.precipitation_probability_max?.[indiceDiario]),
                precipitacaoTotal: numeroOuNulo(clima.daily?.precipitation_sum?.[indiceDiario]),
                codigoTempo: numeroOuNulo(clima.daily?.weather_code?.[indiceDiario]),
            },
            aqi: {
                valor: numeroOuNulo(qualidadeAr?.current?.us_aqi),
                horarios: qualidadeAr?.hourly?.time || [],
                serie: normalizarSerie(qualidadeAr?.hourly?.us_aqi),
            },
            cicloSolar: eventosSolares,
        };
    }

    function obterEventosSolares(daily, horarioAtual) {
        const indice = obterIndiceDiario(daily, horarioAtual);
        const nascer = daily?.sunrise?.[indice] ? new Date(daily.sunrise[indice]) : null;
        const por = daily?.sunset?.[indice] ? new Date(daily.sunset[indice]) : null;
        if (!nascer || !por || Number.isNaN(nascer.getTime()) || Number.isNaN(por.getTime())) return null;

        const sunrise = horaDecimal(nascer);
        const sunset = horaDecimal(por);
        const dawn = Math.max(0, sunrise - 1);
        const dusk = Math.min(24, sunset + 1);
        const zenith = sunrise + ((sunset - sunrise) / 2);
        const daylightDuration = Number(daily?.daylight_duration?.[indice]);

        return {
            dawn,
            sunrise,
            zenith,
            sunset,
            dusk,
            daylightDuration: Number.isFinite(daylightDuration) ? daylightDuration : (sunset - sunrise) * 3600,
        };
    }

    function obterIndiceDiario(daily, horarioAtual) {
        const dataAlvo = String(horarioAtual || "").slice(0, 10);
        const indice = (daily?.time || []).findIndex(data => String(data).slice(0, 10) === dataAlvo);
        return indice >= 0 ? indice : 0;
    }

    function montarPrevisaoCurtoPrazo(hourly) {
        return (hourly?.time || []).map((horario, indice) => ({
            horario,
            probabilidadeChuva: numeroOuNulo(hourly?.precipitation_probability?.[indice]),
            precipitacao: numeroOuNulo(hourly?.precipitation?.[indice]),
            chuva: numeroOuNulo(hourly?.rain?.[indice]),
            pancadas: numeroOuNulo(hourly?.showers?.[indice]),
            codigoTempo: numeroOuNulo(hourly?.weather_code?.[indice]),
            nebulosidade: numeroOuNulo(hourly?.cloud_cover?.[indice]),
            velocidadeVento: numeroOuNulo(hourly?.wind_speed_10m?.[indice]),
            rajadaVento: numeroOuNulo(hourly?.wind_gusts_10m?.[indice]),
            indiceUv: numeroOuNulo(hourly?.uv_index?.[indice]),
        }));
    }

    function horaDecimal(data) {
        return data.getHours() + data.getMinutes() / 60 + data.getSeconds() / 3600;
    }

    function normalizarSerie(valores) {
        return (valores || []).map(numeroOuNulo);
    }

    function numeroOuNulo(valor) {
        if (valor === null || valor === undefined || valor === "") return null;
        const numero = Number(valor);
        return Number.isFinite(numero) ? numero : null;
    }

    window.ExternalWeatherService = {
        buscarPorCep,
        pesquisarCidades,
        buscarPorCidade,
        buscarPorCoordenadas,
    };
})();
