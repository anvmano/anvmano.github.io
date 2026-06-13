'use strict';

(function () {
    const exporter = window.ClimatePdfReportModules?.exporter;

    window.ClimatePdfReport = {
        setup: options => exporter?.setup(options),
    };
})();
