"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createOrOpenAttributionWindow = exports.createOrOpenFAQWindow = exports.createOrOpenSettingsWindow = exports.createBoardEditorWindow = exports.createEditorWindow = exports.getIDByWindow = exports.getWindowByID = void 0;
const electron_1 = require("electron");
const path_1 = require("path");
const sharedstate_1 = require("./sharedstate");
const util_1 = require("./util");
let nextWindowId = 0;
const windowById = new Map();
function getWindowByID(windowId) {
    return windowById.get(windowId);
}
exports.getWindowByID = getWindowByID;
function getIDByWindow(window) {
    return [...windowById.keys()].find(k => windowById.get(k) === window);
}
exports.getIDByWindow = getIDByWindow;
async function createEditorWindow(pgnPath) {
    const winId = 'w' + (Date.now() + nextWindowId);
    nextWindowId++;
    if (pgnPath)
        sharedstate_1.filePathByWindowId.set(winId, pgnPath);
    const parsedPgn = await util_1.getParsedPGN(pgnPath);
    const win = new electron_1.BrowserWindow({
        title: pgnPath ? path_1.basename(pgnPath) : 'New PGN',
        width: 1200,
        height: 900,
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false
        },
        show: false,
        icon: __dirname + '/../../assets/icon/icon_no_text.png'
    });
    windowById.set(winId, win);
    win.webContents.on('did-finish-load', () => {
        win.webContents.send('window-id', winId);
        win.webContents.send('load-prefs', sharedstate_1.prefs.settings);
        win.webContents.send('list-uci-templates', sharedstate_1.engines.uci);
        if (parsedPgn !== null)
            win.webContents.send('load-pgn', parsedPgn);
        win.maximize();
        win.focus();
    });
    win.setMenu(sharedstate_1.menus.editorMenu);
    win.on('close', ev => {
        windowById.delete(winId);
        sharedstate_1.windows.editor.splice(sharedstate_1.windows.editor.indexOf(win), 1);
    });
    sharedstate_1.windows.editor.push(win);
    win.loadFile('./src/renderer/pages/pgn_editor/pgn_editor.html');
}
exports.createEditorWindow = createEditorWindow;
async function createBoardEditorWindow(fen) {
    const winId = 'w' + (Date.now() + nextWindowId);
    nextWindowId++;
    const win = new electron_1.BrowserWindow({
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
    });
    windowById.set(winId, win);
    win.webContents.on('did-finish-load', () => {
        win.webContents.send('window-id', winId);
        win.webContents.send('load-prefs', sharedstate_1.prefs.settings);
        if (fen !== null)
            win.webContents.send('fen', fen);
        win.show();
    });
    win.setMenu(sharedstate_1.menus.boardEditorMenu);
    win.on('close', ev => {
        windowById.delete(winId);
        sharedstate_1.windows.boardEditor.splice(sharedstate_1.windows.boardEditor.indexOf(win), 1);
    });
    sharedstate_1.windows.boardEditor.push(win);
    win.loadFile('./src/renderer/pages/board_editor/board_editor.html');
}
exports.createBoardEditorWindow = createBoardEditorWindow;
async function createOrOpenSettingsWindow() {
    if (sharedstate_1.windows.settings !== null) {
        sharedstate_1.windows.settings.show();
        return;
    }
    sharedstate_1.windows.settings = new electron_1.BrowserWindow({
        title: 'Settings',
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false
        },
        show: false,
        icon: __dirname + '/../../assets/icon/icon_no_text.png'
    });
    sharedstate_1.windows.settings.webContents.on('did-finish-load', ev => {
        sharedstate_1.windows.settings.webContents.send('load-prefs', sharedstate_1.prefs.settings);
        sharedstate_1.windows.settings.show();
    });
    sharedstate_1.windows.settings.on('close', ev => {
        sharedstate_1.windows.settings = null;
    });
    sharedstate_1.windows.settings.setMenu(sharedstate_1.menus.settingsMenu);
    sharedstate_1.windows.settings.loadFile('./src/renderer/pages/prefs/settings.html');
}
exports.createOrOpenSettingsWindow = createOrOpenSettingsWindow;
async function createOrOpenFAQWindow() {
    if (sharedstate_1.windows.faq !== null) {
        sharedstate_1.windows.faq.show();
        return;
    }
    sharedstate_1.windows.faq = new electron_1.BrowserWindow({
        title: 'FAQ',
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false
        },
        show: false,
        icon: __dirname + '/../../assets/icon/icon_no_text.png'
    });
    sharedstate_1.windows.faq.webContents.on('did-finish-load', ev => {
        sharedstate_1.windows.faq.webContents.send('load-prefs', sharedstate_1.prefs.settings);
        sharedstate_1.windows.faq.show();
    });
    sharedstate_1.windows.faq.on('close', ev => {
        sharedstate_1.windows.faq = null;
    });
    sharedstate_1.windows.faq.setMenu(null);
    sharedstate_1.windows.faq.loadFile('./src/renderer/pages/faq.html');
}
exports.createOrOpenFAQWindow = createOrOpenFAQWindow;
async function createOrOpenAttributionWindow() {
    if (sharedstate_1.windows.attribution !== null) {
        sharedstate_1.windows.attribution.show();
        return;
    }
    sharedstate_1.windows.attribution = new electron_1.BrowserWindow({
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
    });
    sharedstate_1.windows.attribution.webContents.on('new-window', (e, url) => {
        e.preventDefault();
        electron_1.shell.openExternal(url);
    });
    sharedstate_1.windows.attribution.on('close', ev => {
        sharedstate_1.windows.attribution = null;
    });
    sharedstate_1.windows.attribution.setMenu(null);
    /*windows.attribution.webContents.on('did-finish-load', ev => {
        windows.attribution.webContents.openDevTools()
    })*/
    sharedstate_1.windows.attribution.loadFile('./src/renderer/pages/attribution.html');
}
exports.createOrOpenAttributionWindow = createOrOpenAttributionWindow;
