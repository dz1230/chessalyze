"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const d3 = require("d3");
const electron_1 = require("electron");
const settings_1 = require("../../../common/settings");
for (const key in settings_1.defaultPreferences) {
    if (Object.prototype.hasOwnProperty.call(settings_1.defaultPreferences, key)) {
        const checkbox = (typeof settings_1.defaultPreferences[key]) === 'boolean';
        d3.select('#' + key).on('change', ev => {
            const value = d3.select('#' + key).property(checkbox ? 'checked' : 'value');
            if (key === 'btrapTheme')
                document.getElementById('theme_sheet').href = value;
            electron_1.ipcRenderer.send('set-pref', key, value);
        });
    }
}
electron_1.ipcRenderer.on('load-prefs', (ev, prefs) => {
    for (const key in prefs) {
        if (Object.prototype.hasOwnProperty.call(prefs, key)) {
            const prefValue = prefs[key];
            if (key === 'btrapTheme')
                document.getElementById('theme_sheet').href = prefValue;
            if ((typeof prefValue) === 'boolean') {
                d3.select('#' + key).property('checked', prefValue);
            }
            else {
                d3.select('#' + key).property('value', prefValue);
            }
        }
    }
});
