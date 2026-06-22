'use strict';

(function () {
    const firebaseSdkVersion = "12.13.0";
    const debugParams = new URLSearchParams(window.location.search);

    function deveRegistrarDiagnostico() {
        try {
            return debugParams.has("debug") || window.localStorage.getItem("climateDebug") === "1";
        } catch (erro) {
            return debugParams.has("debug");
        }
    }

    function registrarDiagnostico(nivel, mensagem, detalhe) {
        if (!deveRegistrarDiagnostico()) return;
        const metodo = console[nivel] || console.log;
        if (detalhe !== undefined) {
            metodo.call(console, `[Estação Climática] ${mensagem}`, detalhe);
            return;
        }
        metodo.call(console, `[Estação Climática] ${mensagem}`);
    }

    window.ClimateDiagnostics = {
        depurar: (mensagem, detalhe) => registrarDiagnostico("debug", mensagem, detalhe),
        informar: (mensagem, detalhe) => registrarDiagnostico("info", mensagem, detalhe),
        avisar: (mensagem, detalhe) => registrarDiagnostico("warn", mensagem, detalhe),
        erro: (mensagem, detalhe) => {
            if (detalhe !== undefined) {
                console.error(`[Estação Climática] ${mensagem}`, detalhe);
                return;
            }
            console.error(`[Estação Climática] ${mensagem}`);
        },
    };

    window.AppConfig = {
        firebase: {
            sdkVersion: firebaseSdkVersion,
            appUrl: `https://www.gstatic.com/firebasejs/${firebaseSdkVersion}/firebase-app.js`,
            databaseUrl: `https://www.gstatic.com/firebasejs/${firebaseSdkVersion}/firebase-database.js`,
            appCheckUrl: `https://www.gstatic.com/firebasejs/${firebaseSdkVersion}/firebase-app-check.js`,
            aiUrl: `https://www.gstatic.com/firebasejs/${firebaseSdkVersion}/firebase-ai.js`,
            recaptchaEnterpriseSiteKey: "6Le5eg0tAAAAAAtn_VdxKOV82oq1sNr2tJlFiULj",
            aiModel: "gemini-3.5-flash",
            options: {
                apiKey: "AIzaSyD5gYEvLzvZItMrXGRlNbhfOPgNMj756_I",
                authDomain: "estacaometereologicaesp32.firebaseapp.com",
                databaseURL: "https://estacaometereologicaesp32-default-rtdb.firebaseio.com",
                projectId: "estacaometereologicaesp32",
                storageBucket: "estacaometereologicaesp32.appspot.com",
                messagingSenderId: "589754957740",
                appId: "1:589754957740:web:6299b8ce6763127b600409",
                measurementId: "G-8GE5G3X1Y9"
            }
        },
        colors: {
            blue: '#38bdf8',
            green: '#34d399',
            purple: '#a78bfa',
            amber: '#fbbf24',
            teal: '#2dd4bf',
            rose: '#fb7185',
            grid: 'rgba(99,132,200,0.1)',
            text: '#94a3b8',
        },
        comfortBand: {
            min: 20,
            max: 26,
            label: "Faixa de conforto",
        },
        humidityComfortBand: {
            min: 40,
            max: 60,
            label: "Faixa de conforto da umidade",
        },
        aquariumComfortBand: {
            min: 25,
            max: 27,
            label: "Faixa de conforto do aquário",
        },
        measurementUnits: {
            Temperatura: "°C",
            "Sensacao termica": "°C",
            temperatura: "°C",
            sensacaoTermica: "°C",
            temperaturaDS18B20: "°C",
            Umidade: "%",
            umidade: "%",
            pressao: "hPa",
            CO: "ppm",
            CO2: "ppm",
            Aceton: "ppm",
            Alcohol: "ppm",
            NH4: "ppm",
            Toluen: "ppm",
            TDS: "ppm",
            Turbidez: "NTU",
        },
        firebasePaths: {
            room: "historico/Temperatura",
            solar: "historico/NascePorDoSol",
            aquarium: "historico/Aquario",
            livingRoom: "historico/AirQuality",
        },
        ids: {
            tables: {
                room: "data",
                aquarium: "dataAquario",
                livingRoom: "dataSala",
            },
            chartContainers: {
                roomTemperature: "chart-container-temp",
                roomFeelsLike: "chart-container-st",
                roomHumidity: "chart-container-umidade",
                sunHistory: "chart-container-sun",
                solarToday: "chart-container-sun-today",
                aquariumTemperature: "chart-container-temp-aquario",
                aquariumPh: "chart-container-ph",
                aquariumTds: "chart-container-tds",
                aquariumTurbidity: "chart-container-turbidez",
                livingRoomTemperature: "chart-container-temp-sala",
                livingRoomFeelsLike: "chart-container-st-sala",
                livingRoomHumidity: "chart-container-umidade-sala",
                livingRoomPressure: "chart-container-pressao-sala",
                globalTemperature: "chart-container-global-temp",
                globalHumidity: "chart-container-global-umidade",
            },
            charts: {
                roomTemperature: "plotsTemp",
                roomFeelsLike: "plotsST",
                roomHumidity: "plotsUmidade",
                sunHistory: "plotSunriseSunset",
                solarToday: "plotSolarToday",
                aquariumTemperature: "plotsTempAquario",
                aquariumPh: "plotsPH",
                aquariumTds: "plotsTDS",
                aquariumTurbidity: "plotsTurbidez",
                livingRoomTemperature: "plotsTempSala",
                livingRoomFeelsLike: "plotsSTSala",
                livingRoomHumidity: "plotsUmidadeSala",
                livingRoomPressure: "plotsPressaoSala",
                globalTemperature: "plotGlobalTemperature",
                globalHumidity: "plotGlobalHumidity",
            },
            advancedViews: {
                room: {
                    monthlyCalendar: "monthlyClimateCalendar",
                    hourlyHeatmap: "hourlyHeatmap",
                    weeklyHeatmap: "weeklyHeatmap",
                },
                livingRoom: {
                    monthlyCalendar: "monthlyClimateCalendarSala",
                    hourlyHeatmap: "hourlyHeatmapSala",
                    weeklyHeatmap: "weeklyHeatmapSala",
                },
            }
        },
        fields: {
            room: {
                date: "Data",
                time: "Hora",
                temperature: "Temperatura",
                feelsLike: "Sensacao termica",
                humidity: "Umidade",
            },
            aquarium: {
                date: "Data",
                time: "Hora",
                temperature: "temperaturaDS18B20",
                ph: "PH",
                tds: "TDS",
                turbidity: "Turbidez",
            },
            livingRoom: {
                date: "Data",
                time: "Hora",
                co: "CO",
                co2: "CO2",
                acetone: "Aceton",
                alcohol: "Alcohol",
                nh4: "NH4",
                toluene: "Toluen",
                temperature: "temperatura",
                feelsLike: "sensacaoTermica",
                humidity: "umidade",
                pressure: "pressao",
            }
        }
    };
})();
