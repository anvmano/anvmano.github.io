'use strict';

(function () {
    const firebaseSdkVersion = "12.13.0";

    window.AppConfig = {
        firebase: {
            sdkVersion: firebaseSdkVersion,
            appUrl: `https://www.gstatic.com/firebasejs/${firebaseSdkVersion}/firebase-app.js`,
            databaseUrl: `https://www.gstatic.com/firebasejs/${firebaseSdkVersion}/firebase-database.js`,
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
            TDS: "ppm",
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
                temperature: "temperatura",
                feelsLike: "sensacaoTermica",
                humidity: "umidade",
                pressure: "pressao",
            }
        }
    };
})();
