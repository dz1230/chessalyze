import { BrowserWindow, shell } from 'electron'
import { basename } from 'path'
import { engines, filePathByWindowId, menus, prefs, windows } from './sharedstate'
import { getParsedPGN } from './util'

let nextWindowId = 0
const windowById = new Map<string, BrowserWindow>()

export function getWindowByID(windowId:string) {
    return windowById.get(windowId)
}
export function getIDByWindow(window:BrowserWindow) {
    return [...windowById.keys()].find(k => windowById.get(k) === window)
}

export async function createEditorWindow(pgnPath:string | null) {
    const winId = 'w' +  (Date.now() + nextWindowId)
    nextWindowId++
    if (pgnPath) filePathByWindowId.set(winId, pgnPath)
    const parsedPgn = await getParsedPGN(pgnPath)
    const win = new BrowserWindow({
        title: pgnPath ? basename(pgnPath) : 'New PGN',
        width: 1200,
        height: 900,
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false
        },
        show: false,
        icon: __dirname + '/../../assets/icon/icon_no_text.png'
    })
    windowById.set(winId, win)
    win.webContents.on('did-finish-load', () => {
        win.webContents.send('window-id', winId)
        win.webContents.send('load-prefs', prefs.settings)
        win.webContents.send('list-uci-templates', engines.uci)
        if (parsedPgn !== null) win.webContents.send('load-pgn', parsedPgn)
        win.maximize()
        win.focus()
    })
    win.setMenu(menus.editorMenu)
    win.on('close', ev => {
        windowById.delete(winId)
        windows.editor.splice(windows.editor.indexOf(win), 1)
    })
    windows.editor.push(win)
    win.loadFile('./src/renderer/pages/pgn_editor/pgn_editor.html')
}

export async function createBoardEditorWindow(fen:string | null) {
    const winId = 'w' +  (Date.now() + nextWindowId)
    nextWindowId++
    const win = new BrowserWindow({
        title: 'Board Editor',
        width: 800,
        height: 850,
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false
        },
        //resizable: false,
        show: false,
        icon: __dirname + '/../../assets/icon/icon_no_text.png'
    })
    windowById.set(winId, win)
    win.webContents.on('did-finish-load', () => {
        win.webContents.send('window-id', winId)
        win.webContents.send('load-prefs', prefs.settings)
        if (fen !== null) win.webContents.send('fen', fen)
        win.show()
    })
    win.setMenu(menus.boardEditorMenu)
    win.on('close', ev => {
        windowById.delete(winId)
        windows.boardEditor.splice(windows.boardEditor.indexOf(win), 1)
    })
    windows.boardEditor.push(win)
    win.loadFile('./src/renderer/pages/board_editor/board_editor.html')
}

export async function createOrOpenSettingsWindow() {
    if (windows.settings !== null) {
        windows.settings.show()
        return
    }
    windows.settings = new BrowserWindow({
        title: 'Settings',
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false
        },
        show: false,
        icon: __dirname + '/../../assets/icon/icon_no_text.png'
    })
    windows.settings.webContents.on('did-finish-load', ev => {
        windows.settings.webContents.send('load-prefs', prefs.settings)
        windows.settings.show()
    })
    windows.settings.on('close', ev => {
        windows.settings = null
    })
    windows.settings.setMenu(menus.settingsMenu)
    windows.settings.loadFile('./src/renderer/pages/prefs/settings.html')
}
export async function createOrOpenFAQWindow() {
    if (windows.faq !== null) {
        windows.faq.show()
        return
    }
    windows.faq = new BrowserWindow({
        title: 'FAQ',
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false
        },
        show: false,
        icon: __dirname + '/../../assets/icon/icon_no_text.png'
    })
    windows.faq.webContents.on('did-finish-load', ev => {
        windows.faq.webContents.send('load-prefs', prefs.settings)
        windows.faq.show()
    })
    windows.faq.on('close', ev => {
        windows.faq = null
    })
    windows.faq.setMenu(null)
    windows.faq.loadFile('./src/renderer/pages/faq.html')
}
export async function createOrOpenAttributionWindow() {
    if (windows.attribution !== null) {
        windows.attribution.show()
        return
    }
    windows.attribution = new BrowserWindow({
        title: 'Info',
        width: 530,
        height: 530,
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false
        },
        //resizable: false,
        show: true,
        icon: __dirname + '/../../assets/icon/icon_no_text.png'
    })
    windows.attribution.webContents.on('new-window', (e, url) => {
        e.preventDefault()
        shell.openExternal(url)
    })
    windows.attribution.on('close', ev => {
        windows.attribution = null
    })
    windows.attribution.setMenu(null)
    /*windows.attribution.webContents.on('did-finish-load', ev => {
        windows.attribution.webContents.openDevTools()
    })*/
    windows.attribution.loadFile('./src/renderer/pages/attribution.html')
}
