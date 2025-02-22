// @ts-nocheck
"use strict";

/*
 * Created with @iobroker/create-adapter v1.29.1
 */

// The adapter-core module gives you access to the core ioBroker functions
// you need to create an adapter
const utils = require("@iobroker/adapter-core");
const axios = require("axios");

/**
 * The adapter instance
 * @type {ioBroker.Adapter}
 */
let adapter;

/**
 * Starts the adapter instance
 * @param {Partial<utils.AdapterOptions>} [options]
 */
function startAdapter(options) {
    // Create the adapter and define its methods
    return adapter = utils.adapter(Object.assign({}, options, {
        name: "awattar",

        // The ready callback is called when databases are connected and adapter received configuration.
        // start here!
        ready: main, // Main method defined below for readability

        // is called when adapter shuts down - callback has to be called under any circumstances!
        unload: (callback) => {
            try {
                // Here you must clear all timeouts or intervals that may still be active
                // clearTimeout(timeout1);
                // clearTimeout(timeout2);
                // ...
                // clearInterval(interval1);

                callback();
            } catch (e) {
                callback();
            }
        },

        // // is called if a subscribed state changes
        // stateChange: (id, state) => {
        //     if (state) {
        //         // The state was changed
        //         adapter.log.info(`state ${id} changed: ${state.val} (ack = ${state.ack})`);
        //     } else {
        //         // The state was deleted
        //         adapter.log.info(`state ${id} deleted`);
        //     }
        // },
    }));
}

function compareValues(key, order = "asc") {
    return function innerSort(a, b) {
        if (!Object.prototype.hasOwnProperty.call(a, key) || !Object.prototype.hasOwnProperty.call(b, key)) {
            // property doesn't exist on either object
            return 0;
        }

        const varA = (typeof a[key] === "string")
            ? a[key].toUpperCase() : a[key];
        const varB = (typeof b[key] === "string")
            ? b[key].toUpperCase() : b[key];

        let comparison = 0;
        if (varA > varB) {
            comparison = 1;
        } else if (varA < varB) {
            comparison = -1;
        }
        return (
            (order === "desc") ? (comparison * -1) : comparison
        );
    };
}

async function main() {

    // adapter.log.info("aWATTar API URL: " + adapter.config.aWATTarApiUrl);
    // adapter.log.info("Loading Threshold Start: " + adapter.config.LoadingThresholdStart);
    // adapter.log.info("Loading Threshold End: " + adapter.config.LoadingThresholdEnd);

    const url = adapter.config.aWATTarApiUrl;
    const mwst = parseInt(adapter.config.MWstRate);
    const mwstRate = (mwst + 100) / 100;
    const workRate = parseFloat(adapter.config.WorkRate);
    const loadingThresholdStart = adapter.config.LoadingThresholdStart;
    if (isNaN(parseInt(loadingThresholdStart))) { return adapter.log.error("loadingThresholdStart NaN"); }
    const loadingThresholdEnd = adapter.config.LoadingThresholdEnd;
    if (isNaN(parseInt(loadingThresholdEnd))) { return adapter.log.error("loadingThresholdEnd NaN"); }

    const heute = new Date();
    const loadingThresholdStartDateTime = new Date(heute.getFullYear(), heute.getMonth(), heute.getDate(), parseInt(loadingThresholdStart), 0, 0);
    const loadingThresholdEndDateTime = new Date(heute.getFullYear(), heute.getMonth(), heute.getDate() + 1, parseInt(loadingThresholdEnd), 0, 0);

    const epochToday = new Date(heute.getFullYear(), heute.getMonth(), heute.getDate()).getTime();
    const epochTomorrow = new Date(heute.getFullYear(), heute.getMonth(), heute.getDate() + 2).getTime() - 1;
    const urlEpoch = url.concat("?start=", epochToday.toString(), "&end=", epochTomorrow.toString());

    adapter.log.debug("local request started");

    //get data from awattar api
    let response;
    try {
        response = await axios({
            method: "get",
            baseURL: urlEpoch,
            timeout: 10000,
            responseType: "json"
        });
    } catch (error) {
        if (error.response) {
            // The request was made and the server responded with a status code
            adapter.log.warn("received error " + error.response.status + " response from local sensor with content: " + JSON.stringify(error.response.data));
        } else if (error.request) {
            // The request was made but no response was received
            // `error.request` is an instance of XMLHttpRequest in the browser and an instance of
            // http.ClientRequest in node.js
            adapter.log.error(error.message);
        } else {
            // Something happened in setting up the request that triggered an Error
            adapter.log.error(error.message);
        }
        return;
    }

    const content = response.data;

    adapter.log.debug("local request done");
    adapter.log.debug("received data (" + response.status + "): " + JSON.stringify(content));

    //write raw data to data point
    await adapter.setObjectNotExistsAsync("Rawdata", {
        type: "state",
        common: {
            name: "Rawdata",
            type: "string",
            role: "value",
            desc: "Beinhaltet die Rohdaten des Abfrageergebnisses als JSON",
            read: true,
            write: false
        },
        native: {}
    });
    await adapter.setStateAsync("Rawdata", JSON.stringify(content), true);

    const array = content.data;

    for (let i = 0; i < array.length; i++) {
        const stateBaseName = "prices." + i + ".";

        //ensure all necessary data points exist
        await adapter.setObjectNotExistsAsync(stateBaseName + "start", {
            type: "state",
            common: {
                name: "Gultigkeitsbeginn (Uhrzeit)",
                type: "string",
                role: "value",
                desc: "Uhrzeit des Beginns der Gültigkeit des Preises",
                read: true,
                write: false
            },
            native: {}
        });

        await adapter.setObjectNotExistsAsync(stateBaseName + "startTimestamp", {
            type: "state",
            common: {
                name: "startTimestamp",
                type: "number",
                role: "value",
                desc: "Timestamp des Beginns der Gültigkeit des Preises",
                read: true,
                write: false
            },
            native: {}
        });

        await adapter.setObjectNotExistsAsync(stateBaseName + "startDate", {
            type: "state",
            common: {
                name: "Gultigkeitsbeginn (Datum)",
                type: "string",
                role: "value",
                desc: "Datum des Beginns der Gültigkeit des Preises",
                read: true,
                write: false
            },
            native: {}
        });

        await adapter.setObjectNotExistsAsync(stateBaseName + "end", {
            type: "state",
            common: {
                name: "Gultigkeitsende (Uhrzeit)",
                type: "string",
                role: "value",
                read: true,
                write: false
            },
            native: {}
        });

        await adapter.setObjectNotExistsAsync(stateBaseName + "endTimestamp", {
            type: "state",
            common: {
                name: "endTimestamp",
                type: "number",
                role: "value",
                desc: "Timestamp des Endes der Gültigkeit des Preises",
                read: true,
                write: false
            },
            native: {}
        });

        await adapter.setObjectNotExistsAsync(stateBaseName + "endDate", {
            type: "state",
            common: {
                name: "Gultigkeitsende (Datum)",
                type: "string",
                role: "value",
                read: true,
                write: false
            },
            native: {}
        });

        await adapter.setObjectNotExistsAsync(stateBaseName + "nettoPriceKwh", {
            type: "state",
            common: {
                name: "Preis pro KWh (excl. MwSt.)",
                type: "number",
                role: "value",
                unit: "Cent / KWh",
                read: true,
                write: false
            },
            native: {}
        });

        await adapter.setObjectNotExistsAsync(stateBaseName + "bruttoPriceKwh", {
            type: "state",
            common: {
                name: "Preis pro KWh (incl. MwSt.)",
                type: "number",
                role: "value",
                unit: "Cent / KWh",
                read: true,
                write: false
            },
            native: {}
        });

        await adapter.setObjectNotExistsAsync(stateBaseName + "totalPriceKwh", {
            type: "state",
            common: {
                name: "Gesamtpreis pro KWh (incl. MwSt.)",
                type: "number",
                role: "value",
                unit: "Cent / KWh",
                read: true,
                write: false
            },
            native: {}
        });

        //calculate prices / timestamps
        const startTs = array[i].start_timestamp;
        const start = new Date(startTs);
        const startTime = start.toLocaleTimeString("de-DE");
        const startDate = `${start.getDate().toString().padStart(2, "0")}.${(start.getMonth() + 1).toString().padStart(2, "0")}.${start.getFullYear()}`;
        const endTs = array[i].end_timestamp;
        const end = new Date(endTs);
        const endTime = end.toLocaleTimeString("de-DE");
        const endDate = `${end.getDate().toString().padStart(2, "0")}.${(end.getMonth() + 1).toString().padStart(2, "0")}.${end.getFullYear()}`;
        const nettoPriceKwh = array[i].marketprice / 10; //price is in eur per MwH. Convert it in cent per KwH
        const bruttoPriceKwh = nettoPriceKwh * mwstRate;
        const totalPriceKwh = bruttoPriceKwh + workRate;

        //write prices / timestamps to their data points
        await Promise.all(
            [adapter.setStateAsync(stateBaseName + "start", startTime, true)
                , adapter.setStateAsync(stateBaseName + "startTimestamp", startTs, true)
                , adapter.setStateAsync(stateBaseName + "startDate", startDate, true)
                , adapter.setStateAsync(stateBaseName + "end", endTime, true)
                , adapter.setStateAsync(stateBaseName + "endTimestamp", endTs, true)
                , adapter.setStateAsync(stateBaseName + "endDate", endDate, true)
                , adapter.setStateAsync(stateBaseName + "nettoPriceKwh", nettoPriceKwh, true)
                , adapter.setStateAsync(stateBaseName + "bruttoPriceKwh", bruttoPriceKwh, true)
                , adapter.setStateAsync(stateBaseName + "totalPriceKwh", totalPriceKwh, true)
            ]);
    }

    adapter.log.debug("all prices written to their data points");

    //ordered prices
    const sortedArray = array.sort(compareValues("marketprice", "asc"));
    let j = 0;

    for (let k = 0; k < sortedArray.length; k++) {
        const startTs = sortedArray[k].start_timestamp;
        const start = new Date(startTs);
        const endTs = sortedArray[k].end_timestamp;
        const end = new Date(endTs);

        if (start >= loadingThresholdStartDateTime && end < loadingThresholdEndDateTime) {
            const stateBaseName = "pricesOrdered." + j + ".";

            //ensure all necessary data points exist
            await adapter.setObjectNotExistsAsync(stateBaseName + "start", {
                type: "state",
                common: {
                    name: "Gultigkeitsbeginn (Uhrzeit)",
                    type: "string",
                    role: "value",
                    desc: "Uhrzeit des Beginns der Gültigkeit des Preises",
                    read: true,
                    write: false
                },
                native: {}
            });

            await adapter.setObjectNotExistsAsync(stateBaseName + "startTimestamp", {
                type: "state",
                common: {
                    name: "startTimestamp",
                    type: "number",
                    role: "value",
                    desc: "Timestamp des Beginns der Gültigkeit des Preises",
                    read: true,
                    write: false
                },
                native: {}
            });

            await adapter.setObjectNotExistsAsync(stateBaseName + "startDate", {
                type: "state",
                common: {
                    name: "Gultigkeitsbeginn (Datum)",
                    type: "string",
                    role: "value",
                    desc: "Datum des Beginns der Gültigkeit des Preises",
                    read: true,
                    write: false
                },
                native: {}
            });

            await adapter.setObjectNotExistsAsync(stateBaseName + "end", {
                type: "state",
                common: {
                    name: "Gultigkeitsende (Uhrzeit)",
                    type: "string",
                    role: "value",
                    read: true,
                    write: false
                },
                native: {}
            });

            await adapter.setObjectNotExistsAsync(stateBaseName + "endTimestamp", {
                type: "state",
                common: {
                    name: "endTimestamp",
                    type: "number",
                    role: "value",
                    desc: "Timestamp des Endes der Gültigkeit des Preises",
                    read: true,
                    write: false
                },
                native: {}
            });

            await adapter.setObjectNotExistsAsync(stateBaseName + "endDate", {
                type: "state",
                common: {
                    name: "Gultigkeitsende (Datum)",
                    type: "string",
                    role: "value",
                    read: true,
                    write: false
                },
                native: {}
            });

            await adapter.setObjectNotExistsAsync(stateBaseName + "priceKwh", {
                type: "state",
                common: {
                    name: "Preis pro KWh (excl. MwSt.)",
                    type: "number",
                    role: "value",
                    unit: "Cent / KWh",
                    read: true,
                    write: false
                },
                native: {}
            });

            //calculate prices / timestamps
            const startTime = start.toLocaleTimeString("de-DE");
            const startDate = start.toLocaleDateString("de-DE");
            const endTime = end.toLocaleTimeString("de-DE");
            const endDate = end.toLocaleDateString("de-DE");
            const priceKwh = sortedArray[k].marketprice / 10; //price is in eur per MwH. Convert it in cent per KwH

            //write prices / timestamps to their data points
            await Promise.all(
                [adapter.setStateAsync(stateBaseName + "start", startTime, true)
                    , adapter.setStateAsync(stateBaseName + "startTimestamp", startTs, true)
                    , adapter.setStateAsync(stateBaseName + "startDate", startDate, true)
                    , adapter.setStateAsync(stateBaseName + "end", endTime, true)
                    , adapter.setStateAsync(stateBaseName + "endTimestamp", endTs, true)
                    , adapter.setStateAsync(stateBaseName + "endDate", endDate, true)
                    , adapter.setStateAsync(stateBaseName + "priceKwh", priceKwh, true)
                ]);
            j++;
        }

    }

    adapter.log.debug("all ordered prices written to their data points");

    setTimeout(function () {
        adapter.stop();
    }, 10000);

}

// @ts-ignore parent is a valid property on module
if (module.parent) {
    // Export startAdapter in compact mode
    module.exports = startAdapter;
} else {
    // otherwise start the instance directly
    startAdapter();
}