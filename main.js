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

// Get the HTML canvas by its id 
plotsTemp = document.getElementById("plotsTemp").getContext('2d');
plotsST = document.getElementById("plotsST").getContext('2d');
plotsUmidade = document.getElementById("plotsUmidade").getContext('2d');
plotSunriseSunset = document.getElementById("plotSunriseSunset").getContext('2d');

const alturaGrafico = '250px';
var chartSol;
var chartTemp;
var chartTempST;
var dadostemp = [];
var dadostempF = [];
var dadosST = [];
var dadosSTF = [];
let lastDate = '';
var isCelsius = true;
const currentDate = dataAtual();
const yesterdayDate = dataOntem();

const dbRef = firebase.database().ref("historico/Temperatura");
dbRef.on("value", snapshot => {
    const data = snapshot.val();
    const table = createTable(data);
    const temperatureChart = createTemperatureChart(data);
    const STChart = createSTChart(data);
    const umidadeChart = createUmidadeChart(data);

    // Adiciona a tabela e o gráfico ao elemento "data" da página HTML
    const dataElement = document.getElementById("data");
    dataElement.innerHTML = "";
    dataElement.appendChild(table);
});

const dbRefSunriseSunset = firebase.database().ref("historico/NascePorDoSol");
dbRefSunriseSunset.on("value", snapshot => {
    const data = snapshot.val();
    const sunriseSunsetChart = createSunriseSunsetChart(data);

    // Adiciona o gráfico ao elemento "data" da página HTML
    //const dataElement = document.getElementById("data");
    //dataElement.appendChild(sunriseSunsetChart);
});

function handleZoom(plot) {
    var isMobile = window.innerWidth <= 768;

    if (isMobile) {
        // Se já estiver em zoom, remova o zoom
        if (plot.classList.contains('mobile-zoom')) {
            plot.classList.remove('mobile-zoom');
        }
        // Não faça nada se tentar dar zoom em dispositivos móveis
    } else {
        // Comportamento existente para dispositivos não móveis
        if (plot.classList.contains('zoom')) {
            plot.classList.remove('zoom');
        } else {
            plot.classList.add('zoom');
            window.scrollTo({ top: 0, behavior: 'smooth' });
        }
    }
}

// Seleciona todos os gráficos
const plots = document.querySelectorAll('.plot');

// Percorre cada gráfico - menos nascer e por do sol
plots.forEach((plot, index) => {
    // Verifica se o gráfico não é de nascer e pôr do sol
    if (index !== 3) {
        // Adiciona um evento de clique apenas para os gráficos que não são de nascer e pôr do sol
        plot.addEventListener('click', () => handleZoom(plot));
    }
});

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
                dateCell.innerText = date !== lastDate ? formattedDate : '';
                // Formatação da coluna "Hora" (HH:mm)
                const formattedTime = time.replace("-", ":");
                timeCell.innerText = time !== lastDate ? formattedTime : '';
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

function dataAtual() {
    var data = new Date();
    var dia = String(data.getDate()).padStart(2, '0');
    var mes = String(data.getMonth() + 1).padStart(2, '0');
    var ano = data.getFullYear();
    var dataAtual = dia + '-' + mes + '-' + ano;
    return dataAtual;
}

function dataOntem() {
    var data = new Date();
    data.setDate(data.getDate() - 1); // Obtém o dia anterior
    var dia = String(data.getDate()).padStart(2, '0');
    var mes = String(data.getMonth() + 1).padStart(2, '0');
    var ano = data.getFullYear();
    var dataAnterior = dia + '-' + mes + '-' + ano;
    return dataAnterior;
}

function hourAndData(data) {
    var hours = [];
    var dadosUmidade = [];

    const allDates = Object.keys(data).filter(
        (date) => date === currentDate || date === yesterdayDate
    );

    for (const date of allDates) {
        const dateData = data[date];
        const allTimes = Object.keys(dateData).sort();

        for (const time of allTimes) {
            const timeData = dateData[time];
            const hour = time.split("-")[0]; // Pega somente a hora (segundo elemento do array)
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
    var sunriseTimes = [];
    var sunsetTimes = [];
    var amanhecerTimes = [];
    var anoitecerTimes = [];

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
            // Calcula o número de segundos desde a meia-noite
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

function mapRange(value, in_min, in_max, out_min, out_max) {
    return (value - in_min) * (out_max - out_min) / (in_max - in_min) + out_min;
}

function formatTime(value) {
    const hours = Math.floor(value);
    const minutes = Math.round((value - hours) * 60);
    return `${hours}:${minutes < 10 ? '0' + minutes : minutes}`;
}

function tooltipLabel(context) {
    const label = context.dataset.label || '';
    return `${label}: ${formatTime(context.raw)}`;
}

function formatHoursArray(hours) {
    return hours.map(hour => formatTime(hour));
}

function createSunriseSunsetChart(data, chartElement) {
    const { dates, sunriseTimes, sunsetTimes, amanhecerTimes, anoitecerTimes } = getSunriseSunsetData(data);
    const formattedDates = dates.map(date => {
        const parts = date.split("-");
        return `${parts[0]}/${parts[1]}/${parts[2]}`;
    });
    const sunriseTimesMapped = sunriseTimes.map(time => mapRange(time, 18000, 25200, 5, 7));
    const sunsetTimesMapped = sunsetTimes.map(time => mapRange(time, 61200, 72000, 17, 20));
    const amanhecerTimesMapped = amanhecerTimes.map(time => mapRange(time, 18000, 25200, 5, 7));
    const anoitecerTimesMapped = anoitecerTimes.map(time => mapRange(time, 61200, 72000, 17, 20));

    const chartData = {
        labels: formattedDates,
        datasets: [{
            label: 'Amanhecer',
            yAxisID: 'yLeft',
            data: amanhecerTimesMapped,
            borderColor: '#FAD6A5',
            backgroundColor: '#FAD6A5',
            tension: 0.4,
            order: 1
        }, {
            label: 'Nascer do sol',
            yAxisID: 'yLeft',
            data: sunriseTimesMapped,
            borderColor: '#ffc966',
            backgroundColor: '#ffc966',
            tension: 0.4,
            order: 2
        }, {
            label: 'Pôr do sol',
            yAxisID: 'yRight',
            data: sunsetTimesMapped,
            borderColor: '#FF4500',
            backgroundColor: '#FF4500',
            tension: 0.4,
            order: 3
        }, {
            label: 'Anoitecer',
            yAxisID: 'yRight',
            data: anoitecerTimesMapped,
            borderColor: '#483D8B',
            backgroundColor: '#483D8B',
            tension: 0.4,
            order: 4
        }]
    };

    const chartOptions = {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
            yLeft: {
                type: 'linear',
                position: 'right',
                min: 5,
                max: 20,
                reverse: false,
                ticks: {
                    callback: formatTime
                }
            },
            yRight: {
                type: 'linear',
                position: 'left',
                min: 5,
                max: 20,
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
        type: 'line',
        data: chartData,
        options: chartOptions
    });
}

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

function createUmidadeChart(data) {
    const { hours, dadosUmidade: dadosUmidade } = hourAndData(data);

    new Chart(plotsUmidade, {
        type: 'line',
        data: {
            labels: formatHoursArray(hours),
            datasets: [{
                label: 'Umidade',
                data: dadosUmidade,
                borderColor: '#36A2EB',
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
                            return value + '%';
                        }
                    }
                }
            }
        },
    });
}

function updateChartDataAndUnit(chart, data, unit) {
    chart.data.datasets[0].data = data;
    chart.options.scales.y.title.text = `(${unit})`;
    chart.update();

    const temperatureUnitSpan = document.getElementById('temperature-unit');
    temperatureUnitSpan.innerText = unit;
}

function updateChart() {
    if (isCelsius) {
        updateChartDataAndUnit(chartTemp, dadostempF, '°F');
        updateChartDataAndUnit(chartTempST, dadosSTF, '°F');
    } else {
        updateChartDataAndUnit(chartTemp, dadostemp, '°C');
        updateChartDataAndUnit(chartTempST, dadosST, '°C');
    }
    isCelsius = !isCelsius;
}
