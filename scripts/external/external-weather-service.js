'use strict';

(function () {
    const config = () => window.AppConfig.externalApis;

    function limparCep(cep) {
        return String(cep || "").replace(/\D/g, "");
    }

    async function buscarPorCep(cepInformado) {
        const cep = limparCep(cepInformado);
        if (cep.length !== 8) throw new Error("Informe um CEP com 8 dígitos.");

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
        if (dados.erro) throw new Error("CEP não encontrado.");
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
        const url = new URL(config().openMeteoGeocodingUrl);
        url.searchParams.set("name", termo);
        url.searchParams.set("count", "1");
        url.searchParams.set("language", "pt");
        url.searchParams.set("format", "json");
        url.searchParams.set("countryCode", "BR");

        const resposta = await fetch(url);
        if (!resposta.ok) return null;
        const dados = await resposta.json();
        return dados.results?.[0] || null;
    }

    async function buscarClima(latitude, longitude) {
        const url = new URL(config().openMeteoForecastUrl);
        url.searchParams.set("latitude", latitude);
        url.searchParams.set("longitude", longitude);
        url.searchParams.set("timezone", "auto");
        url.searchParams.set("past_days", "1");
        url.searchParams.set("forecast_days", "1");
        url.searchParams.set("current", "temperature_2m,relative_humidity_2m,apparent_temperature,pressure_msl");
        url.searchParams.set("hourly", "temperature_2m,relative_humidity_2m,apparent_temperature,pressure_msl");
        url.searchParams.set("daily", "sunrise,sunset,daylight_duration");

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

    function montarRotuloEndereco(endereco) {
        return [endereco.cidade, endereco.estado].filter(Boolean).join(" - ") || `CEP ${endereco.cep}`;
    }

    function normalizarRespostaPublica({ clima, qualidadeAr, origem }) {
        const atual = clima.current || {};
        const horarioAtual = atual.time ? new Date(atual.time) : new Date();
        const eventosSolares = obterEventosSolares(clima.daily);

        return {
            origem,
            atualizadoEm: horarioAtual,
            climaAtual: {
                temperatura: numeroOuNulo(atual.temperature_2m),
                sensacaoTermica: numeroOuNulo(atual.apparent_temperature),
                umidade: numeroOuNulo(atual.relative_humidity_2m),
                pressao: numeroOuNulo(atual.pressure_msl),
            },
            seriesHorarias: {
                horarios: clima.hourly?.time || [],
                temperatura: normalizarSerie(clima.hourly?.temperature_2m),
                sensacaoTermica: normalizarSerie(clima.hourly?.apparent_temperature),
                umidade: normalizarSerie(clima.hourly?.relative_humidity_2m),
                pressao: normalizarSerie(clima.hourly?.pressure_msl),
            },
            aqi: {
                valor: numeroOuNulo(qualidadeAr?.current?.us_aqi),
                horarios: qualidadeAr?.hourly?.time || [],
                serie: normalizarSerie(qualidadeAr?.hourly?.us_aqi),
            },
            cicloSolar: eventosSolares,
        };
    }

    function obterEventosSolares(daily) {
        const nascer = daily?.sunrise?.[0] ? new Date(daily.sunrise[0]) : null;
        const por = daily?.sunset?.[0] ? new Date(daily.sunset[0]) : null;
        if (!nascer || !por || Number.isNaN(nascer.getTime()) || Number.isNaN(por.getTime())) return null;

        const sunrise = horaDecimal(nascer);
        const sunset = horaDecimal(por);
        const dawn = Math.max(0, sunrise - 1);
        const dusk = Math.min(24, sunset + 1);
        const zenith = sunrise + ((sunset - sunrise) / 2);
        const daylightDuration = Number(daily?.daylight_duration?.[0]);

        return {
            dawn,
            sunrise,
            zenith,
            sunset,
            dusk,
            daylightDuration: Number.isFinite(daylightDuration) ? daylightDuration : (sunset - sunrise) * 3600,
        };
    }

    function horaDecimal(data) {
        return data.getHours() + data.getMinutes() / 60 + data.getSeconds() / 3600;
    }

    function normalizarSerie(valores) {
        return (valores || []).map(numeroOuNulo);
    }

    function numeroOuNulo(valor) {
        const numero = Number(valor);
        return Number.isFinite(numero) ? numero : null;
    }

    window.ExternalWeatherService = {
        buscarPorCep,
        buscarPorCoordenadas,
    };
})();
