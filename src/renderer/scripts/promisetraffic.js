"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.promiseTraffic = void 0;
const electron_1 = require("electron");
exports.promiseTraffic = {
    nextRequestId: 0,
    openRequests: [],
    request(windowId, channel, args) {
        const request = {
            id: exports.promiseTraffic.nextRequestId,
            windowId,
            channel,
            args
        };
        exports.promiseTraffic.nextRequestId++;
        const p = new Promise((resolve, reject) => {
            exports.promiseTraffic.openRequests.push({
                request,
                resolve,
                reject
            });
        });
        electron_1.ipcRenderer.send('custom-request', request);
        return p;
    }
};
electron_1.ipcRenderer.on('custom-response', (ev, response) => {
    for (let i = 0; i < exports.promiseTraffic.openRequests.length; i++) {
        const openRequest = exports.promiseTraffic.openRequests[i];
        if (openRequest.request.id === response.id) {
            if (response.response.error) {
                openRequest.reject(response);
            }
            else {
                openRequest.resolve(response);
            }
            exports.promiseTraffic.openRequests.splice(i, 1);
            break;
        }
    }
});
