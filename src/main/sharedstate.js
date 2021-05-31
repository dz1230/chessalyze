"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.prefs = exports.windows = exports.customResponseFunctions = exports.engines = exports.menus = exports.filePathByWindowId = void 0;
exports.filePathByWindowId = new Map();
exports.menus = {
    editorMenuTemplate: [],
    editorMenu: null,
    boardEditorMenu: null,
    settingsMenu: null
};
exports.engines = {
    uci: [],
};
exports.customResponseFunctions = new Map();
exports.windows = {
    editor: [],
    boardEditor: [],
    settings: null,
    faq: null,
    attribution: null
};
exports.prefs = {
    settings: null
};
