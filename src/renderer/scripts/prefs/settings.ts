import d3 = require("d3");
import { ipcRenderer } from "electron";
import { defaultPreferences, UserPreferences } from "../../../common/settings";

for (const key in defaultPreferences) {
    if (Object.prototype.hasOwnProperty.call(defaultPreferences, key)) {
        const checkbox = (typeof defaultPreferences[key]) === 'boolean'
        d3.select('#'+key).on('change', ev => {
            const value = d3.select('#'+key).property(checkbox ? 'checked' : 'value')
            if (key === 'btrapTheme') (<any>document.getElementById('theme_sheet')).href = value
            ipcRenderer.send('set-pref', key, value)
        })
    }
}

ipcRenderer.on('load-prefs', (ev, prefs: UserPreferences) => {
    for (const key in prefs) {
        if (Object.prototype.hasOwnProperty.call(prefs, key)) {
            const prefValue = prefs[key]
            if (key === 'btrapTheme') (<any>document.getElementById('theme_sheet')).href = prefValue
            if ((typeof prefValue) === 'boolean') {
                d3.select('#'+key).property('checked', prefValue)
            } else {
                d3.select('#'+key).property('value', prefValue)
            }
        }
    }
})
