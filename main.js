// Variaveis globais
// Quarto
var chartTemp;
var chartTempST;
var chartUmidade;
var dadostemp = [];
var dadostempF = [];
var dadosST = [];
var dadosSTF = [];
var dadosUmidade = [];

// Nascer e por do sol
var chartSol;
var sunriseTimes = [];
var sunsetTimes = [];
var amanhecerTimes = [];
var anoitecerTimes = [];

// Aquario
var chartTempAquario;
var chartPH;
var chartTDS;
var chartTurbidez;
var dadostempAquario = [];
var dadostempAquarioF = [];
var dadosPH = [];
var dadosTDS = [];
var dadosTurbidez = [];

// Sala
var chartTempSala;
var chartTempSTSala;
var chartUmidadeSala;
var dadosTemperaturaBMP180Sala = [];
var dadostempFSala = [];
var dadosSensacaoTermicaBMP180Sala = [];
var dadosSTFSala = [];
var dadosUmidadeBMP180Sala = [];
var dadosAceton = [];
var dadosAlcohol = [];
var dadosCO = [];
var dadosCO2 = [];
var dadosNH4 = [];

// Gerais
var lastDate = "";
var isCelsius = true;
const alturaGrafico = "250px";
const currentDate = dataAtual();
const yesterdayDate = dataOntem();
const plots = document.querySelectorAll(".plot");

// Configura o Firebase
const firebaseConfig = {
    apiKey: "AIzaSyD5gYEvLzvZItMrXGRlNbhfOPgNMj756_I",
    authDomain: "estacaometereologicaesp32.firebaseapp.com",
    databaseURL: "https://estacaometereologicaesp32-default-rtdb.firebaseio.com",
    projectId: "estacaometereologicaesp32",
    storageBucket: "estacaometereologicaesp32.appspot.com",
    messagingSenderId: "589754957740",
    appId: "1:589754957740:web:6299b8ce6763127b600409",
    measurementId: "G-8GE5G3X1Y9"
};
firebase.initializeApp(firebaseConfig);


// Graficos
// Get the HTML canvas by its id (Quarto)
plotsTemp = document.getElementById("plotsTemp").getContext("2d");
plotsST = document.getElementById("plotsST").getContext("2d");
plotsUmidade = document.getElementById("plotsUmidade").getContext("2d");
plotSunriseSunset = document.getElementById("plotSunriseSunset").getContext("2d");

// Get the HTML canvas by its id (Aquario)
plotsTempAquario = document.getElementById("plotsTempAquario").getContext("2d");
plotsPH = document.getElementById("plotsPH").getContext("2d");
plotsTDS = document.getElementById("plotsTDS").getContext("2d");
plotsTurbidez = document.getElementById("plotsTurbidez").getContext("2d");

// Get the HTML canvas by its id (Sala)
plotsTempSala = document.getElementById("plotsTempSala").getContext("2d");
plotsSTSala = document.getElementById("plotsSTSala").getContext("2d");
plotsUmidadeSala = document.getElementById("plotsUmidadeSala").getContext("2d");


// Obtencao de dados
// Obtencao de dados do Quarto
const dbRef = firebase.database().ref("historico/Temperatura");
dbRef.on("value", snapshot => {
    const data = snapshot.val();
    const table = createTable(data);
    createTemperatureChart(data);
    createSTChart(data);
    createUmidadeChart(data);

    // Adiciona a tabela e o gráfico ao elemento "data" da página HTML
    const dataElement = document.getElementById("data");
    dataElement.innerHTML = "";
    dataElement.appendChild(table);
});

// Obtencao de dados do nascer e por do sol
const dbRefSunriseSunset = firebase.database().ref("historico/NascePorDoSol");
dbRefSunriseSunset.on("value", snapshot => {
    const data = snapshot.val();
    createSunriseSunsetChart(data);
});

// Obtencao de dados do Aquario
const dbRefAquario = firebase.database().ref("historico/Aquario");
dbRefAquario.on("value", snapshot => {
    const dataAquario = snapshot.val();
    const tableAquario = createTableAquario(dataAquario);
    createTemperatureChartAquario(dataAquario);
    createPHChartAquario(dataAquario);
    createTDSChartAquario(dataAquario);
    createTurbidezChartAquario(dataAquario);

    // Adiciona a tabela e o gráfico ao elemento "data" da página HTML
    const dataElement = document.getElementById("dataAquario");
    dataElement.innerHTML = "";
    dataElement.appendChild(tableAquario);
});

// Obtencao de dados da Sala
const dbRefSala = firebase.database().ref("historico/AirQuality");
dbRefSala.on("value", snapshot => {
    const dataSala = snapshot.val();
    const tableSala = createTableSala(dataSala);
    createTemperatureChartSala(dataSala);
    createSTChartSala(dataSala);
    createUmidadeChartSala(dataSala);

    // Adiciona a tabela e o gráfico ao elemento "dataSala" da página HTML
    const dataElement = document.getElementById("dataSala");
    dataElement.innerHTML = "";
    dataElement.appendChild(tableSala);
});

// Funcoes gerais
function handleZoom(plot) {
    var isMobile = window.innerWidth <= 768;

    if (isMobile) {
        // Se já estiver em zoom, remova o zoom
        if (plot.classList.contains("mobile-zoom")) {
            plot.classList.remove("mobile-zoom");
        }
        // Não faça nada se tentar dar zoom em dispositivos móveis
    } else {
        // Comportamento existente para dispositivos não móveis
        if (plot.classList.contains("zoom")) {
            plot.classList.remove("zoom");
        } else {
            plot.classList.add("zoom");
            window.scrollTo({ top: 0, behavior: "smooth" });
        }
    }
}

function dataAtual() {
    var data = new Date();
    var dia = String(data.getDate()).padStart(2, "0");
    var mes = String(data.getMonth() + 1).padStart(2, "0");
    var ano = data.getFullYear();
    var dataAtual = dia + "-" + mes + "-" + ano;
    return dataAtual;
}

function dataOntem() {
    var data = new Date();
    data.setDate(data.getDate() - 1); // Obtém o dia anterior
    var dia = String(data.getDate()).padStart(2, "0");
    var mes = String(data.getMonth() + 1).padStart(2, "0");
    var ano = data.getFullYear();
    var dataAnterior = dia + "-" + mes + "-" + ano;
    return dataAnterior;
}

function mapRange(value, in_min, in_max, out_min, out_max) {
    return (value - in_min) * (out_max - out_min) / (in_max - in_min) + out_min;
}

function formatTime(value) {
    const hours = Math.floor(value);
    const minutes = Math.round((value - hours) * 60);
    return `${hours}:${minutes < 10 ? "0" + minutes : minutes}`;
}

function tooltipLabel(context) {
    const label = context.dataset.label || "";
    return `${label}: ${formatTime(context.raw)}`;
}

function formatHoursArray(hours) {
    return hours.map(hour => formatTime(hour));
}

function updateChartDataAndUnit(chart, data, unit) {
    chart.data.datasets[0].data = data;
    chart.options.scales.y.title.text = `(${unit})`;
    chart.update();

    const temperatureUnitSpan = document.getElementById("temperature-unit");
    temperatureUnitSpan.innerText = unit;
}

function updateChart() {
    if (isCelsius) {
        updateChartDataAndUnit(chartTemp, dadostempF, "°F");
        updateChartDataAndUnit(chartTempST, dadosSTF, "°F");
    } else {
        updateChartDataAndUnit(chartTemp, dadostemp, "°C");
        updateChartDataAndUnit(chartTempST, dadosST, "°C");
    }
    isCelsius = !isCelsius;
}

function openTab(evt, tabName) {
    var i, tabcontent, tablinks;

    tabcontent = document.getElementsByClassName("tabcontent");
    for (i = 0; i < tabcontent.length; i++) {
        tabcontent[i].style.display = "none";
    }

    tablinks = document.getElementsByClassName("tablink");
    for (i = 0; i < tablinks.length; i++) {
        tablinks[i].classList.remove("active");
    }

    document.getElementById(tabName).style.display = "block";
    evt.currentTarget.classList.add("active");
}

document.addEventListener("DOMContentLoaded", function () {
    var defaultTab = document.querySelector(".tablink");
    openTab({ currentTarget: defaultTab }, "Tab1");
    defaultTab.classList.add("active");
});

// Percorre cada gráfico - menos nascer e por do sol
plots.forEach((plot, index) => {
    // Verifica se o gráfico não é de nascer e pôr do sol
    if (index !== 3) {
        plot.addEventListener("click", () => handleZoom(plot));
    }
});

// Reutilizacao de codigo - graficos
function createChart(canvas, label, data, borderColor, yAxisLabel, yAxisSuffix) {
    const { hours, dados: chartData } = hourAndData(data);
    return new Chart(canvas, {
        type: "line",
        data: {
            labels: formatHoursArray(hours),
            datasets: [{
                label: label,
                data: chartData,
                borderColor: borderColor,
                tension: 0.5
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                x: { display: true, title: { display: true } },
                y: {
                    display: true,
                    title: {
                        display: yAxisLabel !== undefined,
                        text: yAxisLabel
                    },
                    ticks: {
                        callback: function (value, index, values) {
                            return value.toFixed(2) + yAxisSuffix;
                        }
                    }
                }
            }
        },
    });
}

// Reutilizacao de codigo - tabelas
function createTable(headers, data) {
    const table = document.createElement("table");

    // Cria o cabeçalho da tabela
    const headerRow = table.insertRow();
    for (let i = 0; i < headers.length; i++) {
        const headerCell = document.createElement("th");
        headerCell.innerText = headers[i];
        headerRow.appendChild(headerCell);
    }

    const allDates = Object.keys(data);

    let lastDate = null;

    // Preenche a tabela com os dados
    for (const date of allDates.reverse()) {
        const dateData = data[date];
        const allTimes = Object.keys(dateData).sort().reverse();

        for (const time of allTimes) {
            const timeData = dateData[time];

            for (const key in timeData) {
                const item = timeData[key];

                const row = table.insertRow();
                const dateCell = row.insertCell();
                const timeCell = row.insertCell();

                // Formatacao de data (dd/mm/yyyy)
                const formattedDate = date.replace(/-/g, "/");
                dateCell.innerText = date !== lastDate ? formattedDate : "";
                // Formatação da coluna "Hora" (HH:mm)
                const formattedTime = time.replace("-", ":");
                timeCell.innerText = formattedTime;

                for (let i = 0; i < headers.length - 2; i++) {
                    const cell = row.insertCell();
                    const value = item[headers[i + 2]];
                    cell.innerText = value ? value.toFixed(2) : "";
                }

                lastDate = date;
            }
        }
    }
    return table;
}

// Reutilizacao de codigo - obter dados
function extractData(data, keys, todasDatas) {
    let allDates;
    if (todasDatas) {
        allDates = Object.keys(data);
    } else {
        allDates = Object.keys(data).filter(
            (date) => date === currentDate || date === yesterdayDate
        );
    }

    var hours = [];
    var extractedData = {};
    keys.forEach(key => {
        extractedData[key] = [];
    });

    for (const date of allDates) {
        var dateData = data[date];
        var allTimes = Object.keys(dateData).sort();

        for (const time of allTimes) {
            var timeData = dateData[time];
            var hour = time.split("-")[0];
            hours.push(hour);

            keys.forEach(key => {
                var item = timeData[key];
                if (item !== undefined) {
                    extractedData[key].push(item);
                }
            });
        }
    }

    return { hours, ...extractedData };
}

// Quarto
function hourAndData(data) {
    var hours = [];

    const allDates = Object.keys(data).filter(
        (date) => date === currentDate || date === yesterdayDate
    );

    for (const date of allDates) {
        const dateData = data[date];
        const allTimes = Object.keys(dateData).sort();

        for (const time of allTimes) {
            const timeData = dateData[time];
            const hour = time.split("-")[0];
            hours.push(hour);

            for (const key in timeData) {
                const item = timeData[key];
                const temperatureCelsius = item.Temperatura;
                const temperatureFahrenheit = (temperatureCelsius * 9 / 5) + 32;
                const temperatureSTCelsius = item["Sensacao termica"];
                const temperatureSTFahrenheit = (temperatureSTCelsius * 9 / 5) + 32;
                dadostemp.push(temperatureCelsius);
                dadostempF.push(temperatureFahrenheit);
                dadosST.push(temperatureSTCelsius);
                dadosSTF.push(temperatureSTFahrenheit);
                dadosUmidade.push(item.Umidade);
            }
        }
    }

    return { hours, dadostemp, dadostempF, dadosST, dadosSTF, dadosUmidade };
}

function getSunriseSunsetData(data) {
    var dates = [];

    const allDates = Object.keys(data).sort((a, b) => {
        const [dayA, monthA, yearA] = a.split("-").map(Number);
        const [dayB, monthB, yearB] = b.split("-").map(Number);

        const dateA = new Date(yearA, monthA - 1, dayA);
        const dateB = new Date(yearB, monthB - 1, dayB);

        return dateA - dateB;
    });

    for (const date of allDates) {
        const dateData = data[date];
        dates.push(date);

        for (const key in dateData) {
            const item = dateData[key];
            const sunriseTimeInSeconds = item.HourNascerDoSol * 3600 + item.MinuteNascerDoSol * 60;
            const sunsetTimeInSeconds = item.HoraPorDoSol * 3600 + item.MinutePorDoSol * 60;
            const amanhecerTimeInSeconds = item.HoraAmanhecer * 3600 + item.MinuteAmanhecer * 60;
            const anoitecerTimeInSeconds = item.HourAnoitecer * 3600 + item.MinuteAnoitecer * 60;
            sunriseTimes.push(sunriseTimeInSeconds);
            sunsetTimes.push(sunsetTimeInSeconds);
            amanhecerTimes.push(amanhecerTimeInSeconds);
            anoitecerTimes.push(anoitecerTimeInSeconds);
        }
    }

    return { dates, sunriseTimes, sunsetTimes, amanhecerTimes, anoitecerTimes };
}

// const keys1 = ["Temperatura"];
// const { hours, dadostemp: temperatureData } = extractData(data, keys1, false);
// função para criar o gráfico de temperatura
function createTemperatureChart(data) {
    const { hours, dadostemp: temperatureData } = hourAndData(data);

    chartTemp = new Chart(plotsTemp, {
        type: 'line',
        data: {
            labels: formatHoursArray(hours), // Usa as horas formatadas
            datasets: [{
                label: 'Temperatura',
                data: temperatureData,
                borderColor: 'blue',
                tension: 0.5
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                x: { display: true, title: { display: true } },
                y: {
                    display: true,
                    title: {
                        display: true,
                        text: '(°C)'
                    },
                    ticks: {
                        callback: function (value, index, values) {
                            return value.toFixed(2) + '°';
                        }
                    }
                }
            }
        },
    });
}

// função para criar o gráfico de sensaocao termica
// const keys1 = ["Sensacao termica"];
// const { hours, dadosST: STData } = extractData(data, keys1, false);
function createSTChart(data) {
    const { hours, dadosST: STData } = hourAndData(data);

    chartTempST = new Chart(plotsST, {
        type: 'line',
        data: {
            labels: formatHoursArray(hours),
            datasets: [{
                label: 'Sensacao termica',
                data: STData,
                borderColor: 'green',
                tension: 0.5
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                x: { display: true, title: { display: true } },
                y: {
                    display: true,
                    title: {
                        display: true,
                        text: '(°C)'
                    },
                    ticks: {
                        callback: function (value, index, values) {
                            return value.toFixed(2) + '°';
                        }
                    }
                }
            }
        },
    });
}

// função para criar o gráfico de umidade
function createUmidadeChart(data) {
    // const keys1 = ["Umidade"];
    // const { hours, dadosUmidade: dadosUmidade2 } = extractData(data, keys1, false);
    const { hours, dadosUmidade: dadosUmidade2 } = hourAndData(data);

    chartUmidade = new Chart(plotsUmidade, {
        type: "line",
        data: {
            labels: formatHoursArray(hours),
            datasets: [{
                label: "Umidade",
                data: dadosUmidade2,
                borderColor: "#36A2EB",
                tension: 0.5
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                x: { display: true, title: { display: true } },
                y: {
                    display: true,
                    title: {
                        display: false,
                    },
                    ticks: {
                        callback: function (value, index, values) {
                            return value + "%";
                        }
                    }
                }
            }
        },
    });
}

// função para criar o gráfico de nascer e por do sol
function createSunriseSunsetChart(data, chartElement) {
    const { dates, sunriseTimes, sunsetTimes, amanhecerTimes, anoitecerTimes } = getSunriseSunsetData(data);
    const formattedDates = dates.map(date => {
        const parts = date.split("-");
        return `${parts[0]}/${parts[1]}/${parts[2]}`;
    });
    const sunriseTimesMapped = sunriseTimes.map(time => mapRange(time, 14400, 25200, 4, 7));
    const sunsetTimesMapped = sunsetTimes.map(time => mapRange(time, 61200, 75600, 17, 21));
    const amanhecerTimesMapped = amanhecerTimes.map(time => mapRange(time, 14400, 25200, 4, 7));
    const anoitecerTimesMapped = anoitecerTimes.map(time => mapRange(time, 61200, 75600, 17, 21));

    const chartData = {
        labels: formattedDates,
        datasets: [{
            label: "Amanhecer",
            yAxisID: "yLeft",
            data: amanhecerTimesMapped,
            borderColor: "#FAD6A5",
            backgroundColor: "#FAD6A5",
            tension: 0.4,
            order: 1
        }, {
            label: "Nascer do sol",
            yAxisID: "yLeft",
            data: sunriseTimesMapped,
            borderColor: "#ffc966",
            backgroundColor: "#ffc966",
            tension: 0.4,
            order: 2
        }, {
            label: "Pôr do sol",
            yAxisID: "yRight",
            data: sunsetTimesMapped,
            borderColor: "#FF4500",
            backgroundColor: "#FF4500",
            tension: 0.4,
            order: 3
        }, {
            label: "Anoitecer",
            yAxisID: "yRight",
            data: anoitecerTimesMapped,
            borderColor: "#483D8B",
            backgroundColor: "#483D8B",
            tension: 0.4,
            order: 4
        }]
    };

    const chartOptions = {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
            yLeft: {
                type: "linear",
                position: "right",
                min: 4,
                max: 21,
                reverse: false,
                ticks: {
                    callback: formatTime
                }
            },
            yRight: {
                type: "linear",
                position: "left",
                min: 4,
                max: 21,
                reverse: false,
                grid: {
                    drawOnChartArea: false
                },
                ticks: {
                    callback: formatTime
                }
            }
        },
        plugins: {
            tooltip: {
                callbacks: {
                    label: tooltipLabel
                }
            }
        }
    };

    chartSol = new Chart(chartElement || plotSunriseSunset, {
        type: "line",
        data: chartData,
        options: chartOptions
    });
}

// função para criar o tabela
function createTable(data) {
    const table = document.createElement("table");

    // Cria o cabeçalho da tabela
    const headerRow = table.insertRow();
    const headers = ["Data", "Hora", "Temperatura", "Sensação Térmica", "Umidade"];
    for (let i = 0; i < headers.length; i++) {
        const headerCell = document.createElement("th");
        headerCell.innerText = headers[i];
        headerRow.appendChild(headerCell);
    }

    const allDates = Object.keys(data).filter(
        (date) => date === currentDate || date === yesterdayDate
    );

    let count = 0; // Variável para controlar o número de registros inseridos na tabela
    let lastDate = null; // Variável para armazenar a última data exibida

    // Preenche a tabela com os dados
    for (const date of allDates.reverse()) {
        const dateData = data[date];
        const allTimes = Object.keys(dateData).sort().reverse();

        for (const time of allTimes) {
            const timeData = dateData[time];

            for (const key in timeData) {
                const item = timeData[key];
                const temperature = item.Temperatura.toFixed(2);
                const thermalSensation = item["Sensacao termica"].toFixed(2);
                const humidity = item.Umidade.toFixed(2);

                const row = table.insertRow();
                const dateCell = row.insertCell();
                const timeCell = row.insertCell();
                const temperatureCell = row.insertCell();
                const thermalSensationCell = row.insertCell();
                const humidityCell = row.insertCell();

                // Formatacao de data (dd/mm/yyyy)
                const formattedDate = date.replace(/-/g, "/");
                dateCell.innerText = date !== lastDate ? formattedDate : "";
                // Formatação da coluna "Hora" (HH:mm)
                const formattedTime = time.replace("-", ":");
                timeCell.innerText = time !== lastDate ? formattedTime : "";
                temperatureCell.innerText = temperature;
                thermalSensationCell.innerText = thermalSensation;
                humidityCell.innerText = humidity;

                count++; // Incrementa o contador de registros inseridos

                if (count === 24) {
                    return table; // Retorna a tabela após inserir os 24 registros
                }
            }
            lastDate = date; // Atualiza a variável com a última data exibida
        }
    }
    return table;
}

// Aquario
function hourAndDataAgua(dataAquario) {
    var hours = [];

    // let allDates = Object.keys(dataAquario).filter(
    //     (date) => date === currentDate || date === yesterdayDate
    // );
    let allDates = Object.keys(dataAquario);

    for (const date of allDates) {
        const dateData = dataAquario[date];
        const allTimes = Object.keys(dateData).sort();

        for (const time of allTimes) {
            const timeData = dateData[time];
            const hour = time.split("-")[0]; // Pega somente a hora (segundo elemento do array)
            hours.push(hour);

            for (const key in timeData) {
                const item = timeData[key];
                const temperatureCelsius = item.temperaturaDS18B20;
                const PH = item.PH;
                const TDS = item.TDS;
                const Turbidez = item.Turbidez;
                dadostempAquario.push(temperatureCelsius);
                dadosPH.push(PH);
                dadosTDS.push(TDS);
                dadosTurbidez.push(Turbidez);
            }
        }
    }

    return { hours, dadostempAquario, dadosPH, dadosTDS, dadosTurbidez };
}

// função para criar o gráfico de temperatura
function createTemperatureChartAquario(dataAquario) {
    const { hours, dadostempAquario: temperatureData } = hourAndDataAgua(dataAquario);
    // const keys2 = ["temperaturaDS18B20"];
    // const { hours, dadostempAquario: temperatureData } = extractData(dataAquario, keys2, true);
    chartTempAquario = new Chart(plotsTempAquario, {
        type: "line",
        data: {
            labels: formatHoursArray(hours), // Usa as horas formatadas
            datasets: [{
                label: "Temperatura",
                data: temperatureData,
                borderColor: "blue",
                tension: 0.5
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                x: { display: true, title: { display: true } },
                y: {
                    display: true,

                    ticks: {
                        callback: function (value, index, values) {
                            return value.toFixed(2) + "°C";
                        }
                    }
                }
            }
        },
    });
}

// função para criar o gráfico de PH
function createPHChartAquario(dataAquario) {
    const { hours, dadosPH: PHData } = hourAndDataAgua(dataAquario);
    // const keys2 = ["PH"];
    // const { hours, dadosPH: PHData } = extractData(dataAquario, keys2, true);

    chartPH = new Chart(plotsPH, {
        type: "line",
        data: {
            labels: formatHoursArray(hours),
            datasets: [{
                label: "PH",
                data: PHData,
                borderColor: "#00A896",
                tension: 0.5
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                x: { display: true, title: { display: true } },
                y: {
                    display: true,
                }
            }
        },
    });
}

// função para criar o gráfico de TDS
function createTDSChartAquario(dataAquario) {
    const { hours, dadosTDS: TDSData } = hourAndDataAgua(dataAquario);
    // const keys2 = ["TDS"];
    // const { hours, dadosTDS: TDSData } = extractData(dataAquario, keys2, true);
    chartPH = new Chart(plotsTDS, {
        type: "line",
        data: {
            labels: formatHoursArray(hours),
            datasets: [{
                label: "TDS",
                data: TDSData,
                borderColor: "#7D4427",
                tension: 0.5
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                x: { display: true, title: { display: true } },
                y: {
                    display: true,
                }
            }
        },
    });
}

// função para criar o gráfico de turbidez
function createTurbidezChartAquario(dataAquario) {
    const { hours, dadosTurbidez: TurbidezData } = hourAndDataAgua(dataAquario);
    // const keys2 = ["Turbidez"];
    // const { hours, dadosTurbidez: TurbidezData } = extractData(dataAquario, keys2, true);

    chartPH = new Chart(plotsTurbidez, {
        type: "line",
        data: {
            labels: formatHoursArray(hours),
            datasets: [{
                label: "Turbidez",
                data: TurbidezData,
                borderColor: "#B2B2B2",
                tension: 0.5
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                x: { display: true, title: { display: true } },
                y: {
                    display: true,
                }
            }
        },
    });
}

// função para criar o tabela
function createTableAquario(dataAquario) {
    const tableAquario = document.createElement("table");

    // Cria o cabeçalho da tabela
    const headerRow = tableAquario.insertRow();
    const headers = ["Data", "Hora", "Temperatura", "PH", "TDS", "Turbidez"];
    for (let i = 0; i < headers.length; i++) {
        const headerCell = document.createElement("th");
        headerCell.innerText = headers[i];
        headerRow.appendChild(headerCell);
    }

    const allDates = Object.keys(dataAquario);

    let lastDate = null; // Variável para armazenar a última data exibida

    // Preenche a tabela com os dados
    for (const date of allDates.reverse()) {
        const dateData = dataAquario[date];
        const allTimes = Object.keys(dateData).sort().reverse();

        for (const time of allTimes) {
            const timeData = dateData[time];

            for (const key in timeData) {
                const item = timeData[key];
                const temperature = item.temperaturaDS18B20.toFixed(2);
                const PH = item.PH.toFixed(2);
                const TDS = item.TDS.toFixed(2);
                const Turbidez = item.Turbidez.toFixed(2);

                const row = tableAquario.insertRow();
                const dateCell = row.insertCell();
                const timeCell = row.insertCell();
                const temperatureCell = row.insertCell();
                const PHCell = row.insertCell();
                const TDSCell = row.insertCell();
                const TurbidezCell = row.insertCell();

                // Formatacao de data (dd/mm/yyyy)
                const formattedDate = date.replace(/-/g, "/");
                dateCell.innerText = date !== lastDate ? formattedDate : "";
                // Formatação da coluna "Hora" (HH:mm)
                const formattedTime = time.replace("-", ":");
                timeCell.innerText = formattedTime;
                temperatureCell.innerText = temperature;
                PHCell.innerText = PH;
                TDSCell.innerText = TDS;
                TurbidezCell.innerText = Turbidez;

                lastDate = date;
            }
        }
    }
    return tableAquario;
}

// Sala
function hourAndDataSala(dataSala) {
    var hours = [];

    // let allDates = Object.keys(dataAquario).filter(
    //     (date) => date === currentDate || date === yesterdayDate
    // );
    let allDates = Object.keys(dataSala);

    for (const date of allDates) {
        const dateData = dataSala[date];
        const allTimes = Object.keys(dateData).sort();

        for (const time of allTimes) {
            const timeData = dateData[time];
            const hour = time.split("-")[0];
            hours.push(hour);

            for (const key in timeData) {
                const item = timeData[key];
                const TemperaturaBMP180 = item.TemperaturaBMP180;
                const SensacaoTermicaBMP180 = item.SensacaoTermicaBMP180;
                const UmidadeBMP180 = item.UmidadeBMP180;
                const Aceton = item.Aceton;
                const Alcohol = item.Alcohol;
                const CO = item.CO;
                const CO2 = item.CO2;
                const NH4 = item.NH4;
                dadosTemperaturaBMP180Sala.push(TemperaturaBMP180);
                dadosSensacaoTermicaBMP180Sala.push(SensacaoTermicaBMP180);
                dadosUmidadeBMP180Sala.push(UmidadeBMP180);
                dadosAceton.push(Aceton);
                dadosAlcohol.push(Alcohol);
                dadosCO.push(CO);
                dadosCO2.push(CO2);
                dadosNH4.push(NH4);
            }
        }
    }

    return { hours, dadosTemperaturaBMP180Sala, dadosSensacaoTermicaBMP180Sala, dadosUmidadeBMP180Sala, dadosAceton, dadosAlcohol, dadosCO, dadosCO2, dadosNH4 };
}

function createTemperatureChartSala(dataSala) {
    const { hours, dadosTemperaturaBMP180Sala: temperatureData } = hourAndDataSala(dataSala);
    // const keys3 = ["temperaturaDS18B20"];
    // const { hours, dadosTemperaturaBMP180Sala: temperatureData } = extractData(dataSala, keys3, true);

    chartTempSala = new Chart(plotsTempSala, {
        type: "line",
        data: {
            labels: formatHoursArray(hours), // Usa as horas formatadas
            datasets: [{
                label: "Temperatura",
                data: temperatureData,
                borderColor: "blue",
                tension: 0.5
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                x: { display: true, title: { display: true } },
                y: {
                    display: true,

                    ticks: {
                        callback: function (value, index, values) {
                            return value.toFixed(2) + "°C";
                        }
                    }
                }
            }
        },
    });
}

function createSTChartSala(dataSala) {
    const { hours, dadosSensacaoTermicaBMP180Sala: temperatureSTData } = hourAndDataSala(dataSala);
    // const keys3 = ["SensacaoTermicaBMP180"];
    // const { hours, dadosSensacaoTermicaBMP180Sala: temperatureData } = extractData(dataSala, keys3, true);

    chartTempSTSala = new Chart(plotsSTSala, {
        type: "line",
        data: {
            labels: formatHoursArray(hours), // Usa as horas formatadas
            datasets: [{
                label: "Sensacao termica",
                data: temperatureSTData,
                borderColor: "green",
                tension: 0.5
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                x: { display: true, title: { display: true } },
                y: {
                    display: true,

                    ticks: {
                        callback: function (value, index, values) {
                            return value.toFixed(2) + "°C";
                        }
                    }
                }
            }
        },
    });
}

function createUmidadeChartSala(dataSala) {
    const { hours, dadosUmidadeBMP180Sala: dadosUmidadeBMP180Sala } = hourAndDataSala(dataSala);
    // const keys3 = ["UmidadeBMP180"];
    // const { hours, dadosUmidadeBMP180Sala: dadosUmidadeBMP180Sala2 } = extractData(dataSala, keys3, true);

    chartUmidadeSala = new Chart(plotsUmidadeSala, {
        type: "line",
        data: {
            labels: formatHoursArray(hours),
            datasets: [{
                label: "Umidade",
                data: dadosUmidadeBMP180Sala,
                borderColor: "#36A2EB",
                tension: 0.5
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                x: { display: true, title: { display: true } },
                y: {
                    display: true,
                    title: {
                        display: false,
                    },
                    ticks: {
                        callback: function (value, index, values) {
                            return value + "%";
                        }
                    }
                }
            }
        },
    });
}

// função para criar o tabela
function createTableSala(dataSala) {
    const tableSala = document.createElement("table");

    // Cria o cabeçalho da tabela
    const headerRow = tableSala.insertRow();
    const headers = ["Data", "Hora", "Aceton", "Alcohol", "CO", "CO2", "NH4"];
    for (let i = 0; i < headers.length; i++) {
        const headerCell = document.createElement("th");
        headerCell.innerText = headers[i];
        headerRow.appendChild(headerCell);
    }

    const allDates = Object.keys(dataSala);

    let lastDate = null; // Variável para armazenar a última data exibida

    // Preenche a tabela com os dados
    for (const date of allDates.reverse()) {
        const dateData = dataSala[date];
        const allTimes = Object.keys(dateData).sort().reverse();

        for (const time of allTimes) {
            const timeData = dateData[time];

            for (const key in timeData) {
                const item = timeData[key];
                const Aceton = item.Aceton ? item.Aceton.toFixed(2) : "";
                const Alcohol = item.Alcohol ? item.Alcohol.toFixed(2) : "";
                const CO = item.CO ? item.CO.toFixed(2) : "";
                const CO2 = item.CO2 ? item.CO2.toFixed(2) : "";
                const NH4 = item.NH4 ? item.CO2.toFixed(2) : "";

                const row = tableSala.insertRow();
                const dateCell = row.insertCell();
                const timeCell = row.insertCell();
                const AcetonCell = row.insertCell();
                const AlcoholCell = row.insertCell();
                const COCell = row.insertCell();
                const CO2Cell = row.insertCell();
                const NH4Cell = row.insertCell();

                // Formatacao de data (dd/mm/yyyy)
                const formattedDate = date.replace(/-/g, "/");
                dateCell.innerText = date !== lastDate ? formattedDate : "";
                // Formatação da coluna "Hora" (HH:mm)
                const formattedTime = time.replace("-", ":");
                timeCell.innerText = formattedTime;
                AcetonCell.innerText = Aceton;
                AlcoholCell.innerText = Alcohol;
                COCell.innerText = CO;
                CO2Cell.innerText = CO2;
                NH4Cell.innerText = NH4;

                lastDate = date;
            }
        }
    }
    return tableSala;
}
