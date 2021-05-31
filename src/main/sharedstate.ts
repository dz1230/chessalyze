import { BrowserWindow, Menu, MenuItemConstructorOptions } from "electron"
import { UserPreferences } from "../common/settings"
import { UCIEngineTemplate } from "../common/uci"

export const filePathByWindowId = new Map<string, string>()

export const menus = {
    editorMenuTemplate: <MenuItemConstructorOptions[]>[],
    editorMenu: <Menu>null,
    boardEditorMenu: <Menu>null,
    settingsMenu: <Menu>null
}

export const engines = {
    uci: <UCIEngineTemplate[]>[],
}

export const customResponseFunctions = new Map()

export const windows = {
    editor: <BrowserWindow[]>[],
    boardEditor: <BrowserWindow[]>[],
    settings: <BrowserWindow>null,
    faq: <BrowserWindow>null,
    attribution: <BrowserWindow>null
}

export const prefs = {
    settings: <UserPreferences>null
}
