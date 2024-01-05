// Variaveis globais
var gasResistance = 0;
// Nascer e por do sol
var chartSol;
var amanhecerTimes = [];
var anoitecerTimes = [];
var sunriseTimes = [];
var sunsetTimes = [];

// Gerais
var lastDate = "";
var isCelsius = true;
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
plotsPressaoSala = document.getElementById("plotsPressaoSala").getContext("2d");

// Obtencao de dados
// Obtencao de dados do Quarto
const dbRefQuarto = firebase.database().ref("historico/Temperatura");
dbRefQuarto.on("value", snapshot => {
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
    createPressaoChartSala(dataSala);

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

function mapRange(value, inmin, inmax, outmin, outmax) {
    return (value - inmin) * (outmax - outmin) / (inmax - inmin) + outmin;
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

// function updateChartDataAndUnit(chart, data, unit) {
//     chart.data.datasets[0].data = data;
//     chart.options.scales.y.title.text = `(${unit})`;
//     chart.update();

//     const temperatureUnitSpan = document.getElementById("temperature-unit");
//     temperatureUnitSpan.innerText = unit;
// }

// function updateChart() {
//     if (isCelsius) {
//         updateChartDataAndUnit(chartTemp, dadostempF, "°F");
//         updateChartDataAndUnit(chartTempST, dadosSTF, "°F");
//     } else {
//         updateChartDataAndUnit(chartTemp, dadostemp, "°C");
//         updateChartDataAndUnit(chartTempST, dadosST, "°C");
//     }
//     isCelsius = !isCelsius;
// }

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

// Reutilizacao de codigo - graficos
function createChart(element, data, key, label, color, yAxisTitle, yAxisSuffix = "", todasDatas) {
    const { hours, [key]: chartData } = extractData(data, [key], todasDatas);

    return new Chart(element, {
        type: "line",
        data: {
            labels: formatHoursArray(hours),
            datasets: [{
                label: label,
                data: chartData,
                borderColor: color,
                tension: 0.4
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
                        display: yAxisTitle !== null,
                        text: yAxisTitle
                    },
                    ticks: {
                        precision: 0,
                        callback: function (value, index, values) {
                            return value + yAxisSuffix;
                        }
                    }
                }
            }
        },
    });
}

// Reutilizacao de codigo - tabelas
function createTables(headers, data) {
    const table = document.createElement("table");

    // Cria o cabeçalho da tabela
    const headerRow = table.insertRow();
    for (let i = 0; i < headers.length; i++) {
        const headerCell = document.createElement("th");
        headerCell.innerText = headers[i];
        switch (headerCell.innerText) {
            case "temperaturaDS18B20":
                headerCell.innerText = "Temperatura";
                break;
            case "Aceton":
                headerCell.innerText = "Acetona";
                break;
            case "Alcohol":
                headerCell.innerText = "Álcool";
                break;
            case "NH4":
                headerCell.innerText = "Amônia";
                break;
            // Adicione mais casos conforme necessário
            default:
                // Opcional: se nenhum caso corresponder, você pode deixar como está ou fazer outra ação
                break;
        }
        headerRow.appendChild(headerCell);
    }

    // Ordena as datas em ordem decrescente
    const allDates = Object.keys(data).sort((a, b) => {
        const [dayA, monthA, yearA] = a.split('-').map(Number);
        const [dayB, monthB, yearB] = b.split('-').map(Number);
        return new Date(yearB, monthB - 1, dayB) - new Date(yearA, monthA - 1, dayA);
    });

    let lastDate = null;
    let rowCount = 0;  // Contador de registros

    // Preenche a tabela com os dados
    for (const date of allDates) {
        if (rowCount >= 24) break;  // Limita para os últimos 24 registros

        const dateData = data[date];
        const allTimes = Object.keys(dateData).sort().reverse();

        for (const time of allTimes) {
            const timeData = dateData[time];

            for (const key in timeData) {
                if (rowCount >= 24) break;  // Limita para os últimos 24 registros

                const item = timeData[key];
                const row = table.insertRow();
                const dateCell = row.insertCell();
                const timeCell = row.insertCell();

                // Formatacao de data (dd/mm/yyyy)
                const formattedDate = date.replace(/-/g, "/");
                dateCell.innerText = date !== lastDate ? formattedDate : "";
                // Formatação da coluna "Hora" (HH:mm)
                const [hour, minute] = time.split("-");
                const formattedHour = hour.padStart(2, '0');
                const formattedMinute = minute.padStart(2, '0');
                timeCell.innerText = `${formattedHour}:${formattedMinute}`;

                for (let i = 0; i < headers.length - 2; i++) {
                    const cell = row.insertCell();
                    const value = item[headers[i + 2]];
                    cell.innerText = value ? value.toFixed(2) : "0";
                }

                rowCount++;
                lastDate = date;
            }
        }
    }

    return table;
}

// Reutilizacao de codigo - obter dados
function extractData(data, keys, todasDatas) {
    var hours = [];
    if (todasDatas) {
        allDates = Object.keys(data);
    } else {
        allDates = Object.keys(data).filter(
            (date) => date === currentDate || date === yesterdayDate
        );
    }

    var extractedData = {};
    keys.forEach(key => {
        extractedData[key] = [];
    });

    for (const date of allDates) {
        const dateData = data[date];
        const allTimes = Object.keys(dateData).sort();

        for (const time of allTimes) {
            const timeData = dateData[time];
            const hour = time.split("-")[0];
            hours.push(hour);

            for (const key in timeData) {
                const item = timeData[key];
                keys.forEach(key => {
                    extractedData[key].push(item[key]);
                });
            }
        }
    }
    return { hours, ...extractedData };
}

// Funcao para obter ultimo valor de uma determinada entrada
function getLastValue(dbRef, key, callback) {
    dbRef.once("value", snapshot => {
        const allData = snapshot.val();

        if (!allData) {
            callback(null, "No data found.");
            return;
        }

        const sortedDates = Object.keys(allData).sort((a, b) => {
            const [dayB, monthB, yearB] = b.split('/').map(Number);
            const [dayA, monthA, yearA] = a.split('/').map(Number);
            return new Date(yearB, monthB - 1, dayB) - new Date(yearA, monthA - 1, dayA);
        });

        const latestDate = sortedDates[0];
        const latestDateData = allData[latestDate];

        const sortedTimes = Object.keys(latestDateData).sort((a, b) => {
            const [hourB, minuteB] = b.split(':').map(Number);
            const [hourA, minuteA] = a.split(':').map(Number);
            return new Date(1970, 0, 1, hourB, minuteB) - new Date(1970, 0, 1, hourA, minuteA);
        });

        const latestTime = sortedTimes[0];
        const latestTimeData = latestDateData[latestTime];

        let latestValue;

        for (const itemKey in latestTimeData) {
            if (latestTimeData[itemKey][key] !== undefined) {
                latestValue = latestTimeData[itemKey][key];
                break;
            }
        }

        if (latestValue !== undefined) {
            callback(latestValue);
        } else {
            callback(null, `No ${key} value found.`);
        }
    });
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
function loadChartsTab1() {

}
// função para criar o gráfico de temperatura
function createTemperatureChart(data) {
    return createChart(plotsTemp, data, "Temperatura", "Temperatura", "blue", "(°C)", "°", false);
}

// função para criar o gráfico de sensaocao termica
function createSTChart(data) {
    return createChart(plotsST, data, "Sensacao termica", "Sensacao termica", "green", "(°C)", "°", false);
}

// função para criar o gráfico de umidade
function createUmidadeChart(data) {
    return createChart(plotsUmidade, data, "Umidade", "Umidade", "#36A2EB", null, "%", false);
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

// função para criar o tabela com dados do quarto
function createTable(data) {
    headers = ["Data", "Hora", "Temperatura", "Sensacao termica", "Umidade"];
    return createTables(headers, data);
}

// função para criar o gráfico de temperatura
function createTemperatureChartAquario(dataAquario) {
    return createChart(plotsTempAquario, dataAquario, "temperaturaDS18B20", "Temperatura", "blue", "(°C)", "°", false);
}

// função para criar o gráfico de PH
function createPHChartAquario(dataAquario) {
    return chartPHAquario = createChart(plotsPH, dataAquario, "PH", "PH", "#00A896", null, null, false);
}

// função para criar o gráfico de TDS
function createTDSChartAquario(dataAquario) {
    return createChart(plotsTDS, dataAquario, "TDS", "TDS", "#7D4427", null, null, false);
}

// função para criar o gráfico de turbidez
function createTurbidezChartAquario(dataAquario) {
    return createChart(plotsTurbidez, dataAquario, "Turbidez", "Turbidez", "#B2B2B2", null, null, false);
}

// função para criar o tabela com dados do aquario
function createTableAquario(dataAquario) {
    const headersAquario = ["Data", "Hora", "temperaturaDS18B20", "PH", "TDS", "Turbidez"];
    return createTables(headersAquario, dataAquario);
}

// função para criar o gráfico de temperatura da sala
function createTemperatureChartSala(dataSala) {
    return createChart(plotsTempSala, dataSala, "temperatura", "Temperatura", "blue", "(°C)", "°", false);
}

// função para criar o gráfico de sensacao termica da sala
function createSTChartSala(dataSala) {
    return createChart(plotsSTSala, dataSala, "sensacaoTermica", "Sensacao termica", "green", "(°C)", "°", false);
}

// função para criar o gráfico de umidade da sala
function createUmidadeChartSala(dataSala) {
    return createChart(plotsUmidadeSala, dataSala, "umidade", "Umidade", "#36A2EB", null, "%", false);
}

// função para criar o gráfico de pressao da sala
function createPressaoChartSala(dataSala) {
    return createChart(plotsPressaoSala, dataSala, "pressao", "Pressao (hPa)", "#4B0082", null, null, false);
}

// função para criar o tabela com dados da sala
function createTableSala(dataSala) {
    const headersSala = ["Data", "Hora", "CO", "CO2", "Aceton", "Alcohol", "NH4"];
    return createTables(headersSala, dataSala);
}

// Percorre cada gráfico - menos nascer e por do sol
plots.forEach((plot, index) => {
    // Verifica se o gráfico não é de nascer e pôr do sol
    if (index !== 3) {
        plot.addEventListener("click", () => handleZoom(plot));
    }
});

// Chame a função para testar
const gaugeChart = Highcharts.chart('gauge-chart', {
    chart: {
        type: 'solidgauge'
    },

    title: {
        text: 'Qualidade do Ar',
        style: {
            fontSize: '25px'
        },
        margin: 0, // Ajuste este valor conforme necessário
        verticalAlign: 'top' // Escolha entre 'top', 'middle', e 'bottom' conforme necessário
    },

    pane: {
        center: ['50%', '65%'],
        size: '140%',
        startAngle: -90,
        endAngle: 90,
        background: {
            backgroundColor: Highcharts.defaultOptions.legend.backgroundColor || '#EEE',
            innerRadius: '60%',
            outerRadius: '100%',
            shape: 'arc'
        }
    },

    yAxis: {
        min: 0,
        max: 40000,
        reversed: false,
        title: {
            text: 'Resistência do Gás',
            y: -60
        },
        stops: [
            [0.25, '#8B0000'],        // Muito Ruim
            [0.375, '#FF0000'],       // Ruim
            [0.5, '#FF4500'],         // Moderado
            [0.625, '#FF8C00'],       // Bom
            [0.75, '#DDDF0D'],        // Muito Bom
            [1.0, '#55BF3B']          // Excelente
        ],
        lineWidth: 0,
        tickWidth: 0,
        minorTickInterval: null,
        tickAmount: 2,
        labels: {
            y: 16
        }
    },

    plotOptions: {
        solidgauge: {
            dataLabels: {
                borderWidth: 0,
                useHTML: true
            }
        }
    },

    series: [{
        name: 'Resistência',
        data: [], // Vazio por enquanto
        dataLabels: {
            format: '<div style="text-align:center"><span style="font-size:25px">' + getQualidadeAr(gasResistance) + '</span><br/><span style="font-size:12px;opacity:0.4">{y}</span></div>'
        },
        tooltip: {
            valueSuffix: ' Ohms'
        }
    }],

    responsive: {
        rules: [{
            condition: {
                maxWidth: 600 // Por exemplo, para telas menores que 500px de largura
            },
            chartOptions: {
                chart: {
                    width: 400 // Ajuste a largura para 300px se a condição acima for atendida
                },
                pane: {
                    size: '110%', // Ajuste o tamanho do painel se necessário
                }
            }
        }]
    }
});

getLastValue(dbRefSala, "gas", (value, error) => {
    if (error) {
        console.error("Error:", error);
        return;
    }

    // Atualize o gráfico com o valor recuperado
    gaugeChart.series[0].setData([value]);
    // Atualizar a exibição do valor de resistência no gráfico
    gaugeChart.series[0].update({
        dataLabels: {
            format: '<div style="text-align:center"><span style="font-size:25px">' + getQualidadeAr(value) + '</span><br/><span style="font-size:12px;opacity:0.4">{y}</span></div>'
        }
    });
});

function getQualidadeAr(gasResistance) {
    if (gasResistance > 35000.0) return "Excelente";
    else if (gasResistance > 30000.0) return "Muito Bom";
    else if (gasResistance > 25000.0) return "Bom";
    else if (gasResistance > 20000.0) return "Moderado";
    else if (gasResistance > 15000.0) return "Ruim";
    else return "Muito Ruim";
}
