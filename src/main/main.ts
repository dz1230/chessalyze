import { app, BrowserWindow, ipcMain, dialog, Menu, MenuItem, MenuItemConstructorOptions } from 'electron'
import { readFile, writeFile } from 'fs/promises'
import { existsSync } from 'fs'
import { basename, join } from 'path'
import { argv } from 'process'
import { defaultPreferences, UserPreferences } from '../common/settings'
import { getParsedPGN } from './util'
import { createBoardEditorWindow, createEditorWindow, createOrOpenAttributionWindow, createOrOpenSettingsWindow, getIDByWindow, getWindowByID } from './windows'
import { customResponseFunctions, engines, filePathByWindowId, menus, prefs, windows } from './sharedstate'
import { UCIEngineOption, UCIEngineTemplate, UCISearchOptions } from '../common/uci'

const pgnParser = require('pgn-parser')

interface CustomRequest {
    id: number
    windowId: string
    channel: string
    args: any[]
}

if (!app.requestSingleInstanceLock()) {
    app.quit()
} else {
    require('./uci-engines')
    require('./liclient')
    
    let addUCIEngineMenuItem: MenuItemConstructorOptions
    
    function listEngineMenuItems(type: 'uci') {
        const idx = ['uci','tb','book'].indexOf(type)
        if (idx < 0) return
        const nMenu = [
            addUCIEngineMenuItem,
            {type: 'separator'},
        ].concat(engines[type].map(template => {
            const t = template
            return {
                label: template.displayName,
                submenu: [
                    {label: 'Open', click(item, window, event) {
                        window.webContents.send('open-' + type + '-engine', t)
                    }},
                    {label: 'Settings', click(item, window, event) {
                        window.webContents.send('open-' + type + '-settings', t)
                    }},
                    {label: 'Delete', click(item, window, event) {
                        engines.uci.splice(engines.uci.findIndex(t1 => t1.id === t.id), 1)
                        saveUCIEngines().then(r => listEngineMenuItems('uci'))
                    }}
                ]
            }
        }))
        const parent = menus.editorMenuTemplate[2].submenu[0+idx]
        parent.submenu = nMenu
        menus.editorMenu = Menu.buildFromTemplate(menus.editorMenuTemplate)
        for (const win of windows.editor) {
            win.setMenu(menus.editorMenu)
            win.webContents.send('list-' + type + '-templates', engines[type])
        }
    }
    function addUCIEngine(window: BrowserWindow) {
        const path = dialog.showOpenDialogSync(window, {
            title: 'Select engine executable',
            filters: [{name: 'Executable', extensions: ['exe']}],
            properties: ['dontAddToRecent','openFile','showHiddenFiles']
        })
        if (path === undefined || path === null || path.length === 0) return
        window.webContents.send('add-uci-engine-template', path[0])
    }
    async function saveUCIEngines() {
        const uciEnginesPath = join(app.getPath('userData'), './uci_engines.json')
        const uciEnginesString = JSON.stringify(engines.uci)
        await writeFile(uciEnginesPath, uciEnginesString, 'utf-8')
    }
    
    app.whenReady().then(async () => {
        const helpMenu: MenuItemConstructorOptions = {
            label: 'Help',
            submenu: [
                //{label: '🔎 Search for updates...', enabled: false},
                //{label: 'About', role: 'about'},
                {label: 'Info', click(item, window, event) {
                    createOrOpenAttributionWindow()
                }},
                {label: 'Report a Bug', enabled: false},
                //{label: 'FAQ', enabled: false}
            ]
        }
        addUCIEngineMenuItem = {label: '📂 Add UCI Engine...', click(item, window, event) {
            addUCIEngine(window)
        }}
        menus.editorMenuTemplate = [
            {
                label: 'File',
                submenu: [
                    {label: '✨ New...', click(item, window, event) {
                        createEditorWindow(null)
                    }, accelerator: 'CmdOrCtrl+N'},
                    {label: '📁 Open...', click(item, window, event) {
                        const paths = dialog.showOpenDialogSync(window, {
                            title: 'Open PGN (.pgn) file',
                            properties: ['openFile'],
                            filters: [{name: 'Portable Game Notation', extensions: ['pgn']}]
                        })
                        if (paths === undefined || paths === null || paths.length === 0) return
                        const winId = getIDByWindow(window)
                        ;(async () => {
                            let combinedPgn = []
                            for (let i = 0; i < paths.length; i++) {
                                const path = paths[i]
    
                                const parsed = await getParsedPGN(path)
                                if (parsed !== null) combinedPgn.push(...parsed)
                            }
                            window.webContents.send('load-pgn', combinedPgn)
                            if (winId !== undefined) {
                                filePathByWindowId.set(winId, paths[0])
                                window.setTitle(basename(paths[0]))
                            }
                        })()
                    }, accelerator: 'CmdOrCtrl+O'},
                    {label: '⌚ Recent', role: 'recentDocuments', submenu: [
                        {type: 'separator', id: 'afterRecentDocuments'},
                        {label: 'Clear', role: 'clearRecentDocuments', click(item, window, event) {
                            app.clearRecentDocuments()
                        }}
                    ]},
                    {label: '💾 Save', click(item, window, event) {
                        const winId = getIDByWindow(window)
                        let path: string = null
                        if (winId === undefined || !filePathByWindowId.has(winId)) {
                            path = dialog.showSaveDialogSync(window, {
                                title: 'Save PGN (.pgn)',
                                properties: ['createDirectory', 'showOverwriteConfirmation'],
                                filters: [{name: 'Portable Game Notation', extensions: ['pgn']}]
                            })
                        } else {
                            path = filePathByWindowId.get(winId)
                        }
                        if (path === null || path === undefined) return
                        filePathByWindowId.set(winId, path)
                        window.webContents.send('fetch-pgn', {back: 'save-pgn', args: [path, getIDByWindow(window)]})
                    }, accelerator: 'CmdOrCtrl+S'},
                    {label: '💾 Save as...', click(item, window, event) {
                        const path = dialog.showSaveDialogSync(window, {
                            title: 'Save PGN (.pgn)',
                            properties: ['createDirectory', 'showOverwriteConfirmation'],
                            filters: [{name: 'Portable Game Notation', extensions: ['pgn']}]
                        })
                        if (path === null || path === undefined) return
                        filePathByWindowId.set(getIDByWindow(window), path)
                        window.webContents.send('fetch-pgn', {back: 'save-pgn', args: [path, getIDByWindow(window)]})
                    }, accelerator: 'CmdOrCtrl+Shift+S'},
                    {label: '💣 Exit', role: 'quit'}
                ],
            },
            {
                label: 'Edit',
                submenu: [
                    //{label: '↩ Undo', role: 'undo'},
                    //{label: '↪ Redo', role: 'redo'},
                    //{type: 'separator'},
                    {label: '✂ Cut move', click(item, window, event) {
                        window.webContents.send('cut-move')
                    }, accelerator: 'Delete'},
                    {label: '♟ Variation', submenu: [
                        {label: 'Move Up', click(item, window, event) {
                            window.webContents.send('move-variation', -1)
                        }, accelerator: 'Shift+Up'},
                        {label: 'Move down', click(item, window, event) {
                            window.webContents.send('move-variation', 1)
                        }, accelerator: 'Shift+Down'},
                        {label: 'Delete', click(item, window, event) {
                            window.webContents.send('cut-variation')
                        }}
                    ]},
                    {label: '🗑 Delete game', click(item, window, event) {
                        window.webContents.send('cut-game')
                    }, accelerator: 'CmdOrCtrl+Shift+Delete'},
                    {type: 'separator'},
                    {label: '📋 Copy', submenu: [
                        {label: 'Move', click(item, window, event) {
                            window.webContents.send('copy', 'move')
                        }},
                        {label: 'Variation', toolTip: 'Copy movetext of selected variation', click(item, window, event) {
                            window.webContents.send('copy', 'variation')
                        }},
                        {label: 'Variation RAV', toolTip: 'Copy movetext of selected variation with comments and recursive annotation variations', click(item, window, event) {
                            window.webContents.send('copy', 'rav')
                        }},
                        {type: 'separator'},
                        {label: 'Game', toolTip: 'Copy pgn of only the current game', click(item, window, event) {
                            window.webContents.send('copy', 'game')
                        }},
                        {label: 'Game movetext', toolTip: 'Copy only the pgn movetext of the current game', click(item, window, event) {
                            window.webContents.send('copy', 'movetext')
                        }},
                        {label: 'Game tags', toolTip: 'Copy only the tags section of the current game', click(item, window, event) {
                            window.webContents.send('copy', 'tags')
                        }},
                        {type: 'separator'},
                        {label: 'File', toolTip: 'Copy movetext of the whole pgn file', click(item, window, event) {
                            window.webContents.send('copy', 'pgn')
                        }},
                        {label: 'Minimal file', toolTip: 'Copy only pgn roster tags and results of all games', click(item, window, event) {
                            window.webContents.send('copy', 'roster')
                        }},
                        {type: 'separator'},
                        {label: 'FEN', toolTip: 'Copy Forsyth-Edwards-Notation', click(item, window, event) {
                            window.webContents.send('copy', 'fen')
                        }, accelerator: 'CmdOrCtrl+F'},
                        {label: 'EPD', toolTip: 'Copy Extended Position Description', click(item, window, event) {
                            window.webContents.send('copy', 'epd')
                        }, accelerator: 'CmdOrCtrl+E'},
                    ]},
                    {label: '📨 Paste', submenu: [
                        {label: 'Annotation', click(item, window, event) {
                            window.webContents.send('paste', 'nag')
                        }, accelerator: 'Shift+Insert'},
                        {type: 'separator'},
                        {label: 'FEN (as new game)', click(item, window, event) {
                            window.webContents.send('paste', 'fen')
                        }, accelerator: 'Shift+F'},
                        {label: 'EPD (as new game)', click(item, window, event) {
                            window.webContents.send('paste', 'epd')
                        }, accelerator: 'Shift+E'},
                        /*{type: 'separator'},
                        {label: 'PGN', toolTip: 'Insert games as variations', click(item, window, event) {
                            window.webContents.send('paste', 'pgn')
                        }, accelerator: 'Shift+P'}*/
                    ]},
                    {type: 'separator'},
                    {label: 'Toggle annotations', submenu: [
                        {accelerator: 'Alt+1', label: '! - Good move', click(item, window, event) {window.webContents.send('annotation', '$1')}},
                        {accelerator: 'Alt+2', label: '? - Mistake', click(item, window, event) {window.webContents.send('annotation', '$2')}},
                        {accelerator: 'Alt+3', label: '!! - Brilliant move', click(item, window, event) {window.webContents.send('annotation', '$3')}},
                        {accelerator: 'Alt+4', label: '?? - Blunder', click(item, window, event) {window.webContents.send('annotation', '$4')}},
                        {accelerator: 'Alt+5', label: '!? - Interesting move', click(item, window, event) {window.webContents.send('annotation', '$5')}},
                        {accelerator: 'Alt+6', label: '?! - Dubious move', click(item, window, event) {window.webContents.send('annotation', '$6')}},
                    ]},
                    {type: 'separator'},
                    {label: '⚙ Settings', click(item, window, event) {createOrOpenSettingsWindow()}}
                ]
            },
            {
                label: 'Tools',
                submenu: [
                    {id: 'engines', label: 'Engines', toolTip: 'Manage engine sources', submenu: [
                        addUCIEngineMenuItem, {type: 'separator', id: 'engines_start'},
                    ]},
                    {type: 'separator'},
                    {label: 'Import', submenu: [
                        {label: '📂 From file(s)...', toolTip: 'Add games from other files to the current file', click(item, window, event) {
                            const paths = dialog.showOpenDialogSync(window, {
                                title: 'Import games',
                                properties: ['openFile','dontAddToRecent','multiSelections'],
                                filters: [{name: 'Portable Game Notation', extensions: ['pgn']}]
                            })
                            if (paths === null || paths === undefined || paths.length === 0) return
                            ;(async () => {
                                let combinedPgn = []
                                for (let i = 0; i < paths.length; i++) {
                                    const path = paths[i]
                                    const parsed = await getParsedPGN(path)
                                    if (parsed === null) continue
                                    combinedPgn.push(...parsed)
                                }
                                window.webContents.send('load-pgn', combinedPgn, 'after')
                            })()
                        }},
                        {label: '🌍 From lichess.org...', click(item, window, event) {
                            window.webContents.send('import-web-games', 'lichess')
                        }},
                    ]},
                    {label: 'Export', submenu: [
                        {label: 'Filter games...', toolTip: 'Only save games that meet specific criteria', click(item, window, event) {
                            window.webContents.send('export-condition')
                        }},
                    ]},
                    {type: 'separator'},
                    {label: 'Board Editor', click(item, window, event) {createBoardEditorWindow(null)}},
                ]
            },
            {role: 'viewMenu'},
            {role: 'windowMenu'},
            helpMenu
        ]
        menus.editorMenu = Menu.buildFromTemplate(menus.editorMenuTemplate)
        menus.boardEditorMenu = Menu.buildFromTemplate([
            {
                label: 'Position',
                submenu: [
                    {label: 'Empty', click(item, window, event) {
                        window.webContents.send('fen', '8/8/8/8/8/8/8/8 w - - 0 1')
                    }, accelerator: 'Shift+0'},
                    {label: 'Initial', click(item, window, event) {
                        window.webContents.send('fen', 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1')
                    }, accelerator: 'Shift+1'},
                    {type: 'separator'},
                    //#region opening positions for board editor
                    {label: 'Open Game', click(item, window, event) {
                        window.webContents.send('fen', 'rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 2')
                    }, accelerator: 'Shift+2'},
                    {label: 'Four Knights Game', click(item, window, event) {
                        window.webContents.send('fen', 'r1bqkb1r/pppp1ppp/2n2n2/4p3/4P3/2N2N2/PPPP1PPP/R1BQKB1R w KQkq - 4 4')
                    }, accelerator: 'Shift+3'},
                    {label: 'Italian Game', click(item, window, event) {
                        window.webContents.send('fen', 'r1bqkbnr/pppp1ppp/2n5/4p3/2B1P3/5N2/PPPP1PPP/RNBQK2R b KQkq - 3 3')
                    }, accelerator: 'Shift+4'},
                    {label: 'Evans Gambit', click(item, window, event) {
                        window.webContents.send('fen', 'r1bqk1nr/pppp1ppp/2n5/2b1p3/1PB1P3/5N2/P1PP1PPP/RNBQK2R b KQkq - 0 4')
                    }, accelerator: 'Shift+5'},
                    {label: 'Ruy Lopez', click(item, window, event) {
                        window.webContents.send('fen', 'r1bqkbnr/pppp1ppp/2n5/1B2p3/4P3/5N2/PPPP1PPP/RNBQK2R b KQkq - 3 3')
                    }, accelerator: 'Shift+6'},
                    {label: 'London System', click(item, window, event) {
                        window.webContents.send('fen', 'rnbqkb1r/ppp1pppp/5n2/3p4/3P1B2/5N2/PPP1PPPP/RN1QKB1R b KQkq - 3 3')
                    }, accelerator: 'Shift+7'},
                    {label: 'Catalan Opening', click(item, window, event) {
                        window.webContents.send('fen', 'rnbqkb1r/pppp1ppp/4pn2/8/2PP4/6P1/PP2PP1P/RNBQKBNR b KQkq - 0 3')
                    }, accelerator: 'Shift+8'},
                    //#endregion
                    {type: 'separator'},
                    //#region endgame positions for board editor
                    {label: 'Lucena Endgame', click(item, window, event) {
                        window.webContents.send('fen', '3K4/3P2k1/8/8/8/8/2r5/5R2 w - - 0 1')
                    }, accelerator: 'Shift+9'}
                    //#endregion
                ]
            },
            {
                label: 'Export',
                submenu: [
                    {label: '💾 Save .fen file as...', click(item, window, event) {
                        const path = dialog.showSaveDialogSync(window, {
                            title: 'Save .fen',
                            properties: ['showOverwriteConfirmation'],
                            filters: [{name: 'Forsyth-Edwards-Notation', extensions: ['fen']}],
                        })
                        if (path === undefined || path === null) return
                        window.webContents.send('fetch-fen', {back: 'save-fen', args: [path]})
                    }, accelerator: 'CmdOrCtrl+S'},
                    {type: 'separator'},
                    {label: '📋 Copy FEN', click(item, window, event) {
                        window.webContents.send('copy', 'fen')
                    }, accelerator: 'CmdOrCtrl+F'},
                    {label: '📋 Copy board FEN', click(item, window, event) {
                        window.webContents.send('copy', 'board-fen')
                    }, accelerator: 'CmdOrCtrl+Shift+F'},
                    {label: '📋 Copy EPD', click(item, window, event) {
                        window.webContents.send('copy', 'epd')
                    }, accelerator: 'CmdOrCtrl+E'},
                    {type: 'separator'},
                ]
            },
            {role: 'viewMenu'},
            {role: 'windowMenu'},
            helpMenu
        ])
    
        const userDataPath = app.getPath('userData')
        const settingsPath = join(userDataPath, './preferences.json')
        if (existsSync(settingsPath)) {
            const settingsString = await readFile(settingsPath, 'utf-8')
            try {
                const nSettings: UserPreferences = JSON.parse(settingsString)
                prefs.settings = nSettings
            } catch (error) {
                console.error(error)
                prefs.settings = defaultPreferences
            }
        } else {
            prefs.settings = defaultPreferences
        }
        const uciEnginesPath = join(userDataPath, './uci_engines.json')
        if (existsSync(uciEnginesPath)) {
            const uciEnginesString = await readFile(uciEnginesPath, 'utf-8')
            try {
                engines.uci = JSON.parse(uciEnginesString)
                listEngineMenuItems('uci')
            } catch (error) {
                console.error(error)
                engines.uci = []
            }
        }
    
        ipcMain.on('custom-request', async (ev, request: CustomRequest) => {
            if (customResponseFunctions.has(request.channel)) {
                try {
                    const response = await (customResponseFunctions.get(request.channel))(...request.args)
                    ev.sender.send('custom-response', Object.assign(request, {response}))
                } catch (error) {
                    ev.sender.send('custom-response', Object.assign(request, {response: {
                        error: error
                    }}))
                }
            } else {
                console.error(`Requested channel does not exist: ${request.channel}`)
                ev.sender.send('custom-response', Object.assign(request, {response: {
                    error: new Error('No handler found for the requested channel')
                }}))
            }
        })
        customResponseFunctions.set('parse-pgn', async (pgn: string) => {
            return await new Promise((resolve, reject) => {
                try {
                    const parsed = pgnParser.parse(pgn)
                    resolve(parsed)
                } catch (error) {
                    reject(error)
                }
            })
        })
        ipcMain.on('set-pref', (ev, pref, value) => {
            prefs.settings[pref] = value
            windows.boardEditor.concat(windows.editor).forEach((window) => {
                window.webContents.send('set-pref', pref, value)
            })
            writeFile(settingsPath, JSON.stringify(prefs.settings, undefined, 2), 'utf-8')
        })
        ipcMain.on('add-uci-engine', (ev, windowId) => {
            if (getWindowByID(windowId) === undefined) return
            addUCIEngine(getWindowByID(windowId))
        })
        ipcMain.on('save-fen', (ev, fen, path) => {
            writeFile(path, fen, 'utf-8').catch(reason => console.error(reason))
        })
        ipcMain.on('save-pgn', (ev, pgn, path, windowId, n) => {
            if (getWindowByID(windowId) === undefined) return
            if (path === null) {
                path = dialog.showSaveDialogSync(getWindowByID(windowId), {
                    title: 'Export ' + n + 'games',
                    properties: ['showOverwriteConfirmation'],
                    filters: [{name: 'Portable Game Notation', extensions: ['pgn']}]
                })
                if (path === undefined || path === null) return
            }
            writeFile(path, pgn, {encoding: 'utf-8'}).then(r => {
                getWindowByID(windowId).setTitle(basename(path))
            }).catch(reason => console.error(reason))
        })
    
        customResponseFunctions.set('apply-to-uci-template', async (templateId: string, searchOptions: UCISearchOptions, uciOptions: UCIEngineOption[]) => {
            return await new Promise((resolve, reject) => {
                const tIdx = engines.uci.findIndex(t => t.id === templateId)
                if (tIdx < 0) {
                    reject('No template with id ' + templateId)
                } else {
                    if (searchOptions) engines.uci[tIdx].searchOptions = searchOptions
                    if (engines.uci[tIdx].options === undefined) {
                        engines.uci[tIdx].options = uciOptions
                    } else if (uciOptions !== undefined) {
                        for (const option of uciOptions) {
                            const oIdx = engines.uci[tIdx].options.findIndex(o => o.name === option.name)
                            if (oIdx < 0) {
                                engines.uci[tIdx].options.push(option)
                            } else {
                                engines.uci[tIdx].options[oIdx].value = option.value
                            }
                        }
                    }
                    saveUCIEngines().then(r => {
                        listEngineMenuItems('uci')
                        resolve(true)
                    }).catch(err => reject(err))
                }
            })
        })
        customResponseFunctions.set('save-engine-template', async (template: UCIEngineTemplate) => {
            engines.uci.unshift(template)
            await saveUCIEngines()
            listEngineMenuItems('uci')
            return {}
        })
    
        let cmdArgs = argv.slice(0)
        if (cmdArgs[0] === 'electron' || cmdArgs[0]?.endsWith('electron.exe')) cmdArgs.splice(0, 2)
        if (cmdArgs[0] === 'node' || cmdArgs[0]?.endsWith('node.exe')) cmdArgs.splice(0, 2)
        
        if (cmdArgs.length === 0) {
            createEditorWindow(null)
        } else {
            for (let i = 0; i < cmdArgs.length; i++) {
                const openFilePath = cmdArgs[i]
                createEditorWindow(openFilePath)
            }
        }
    })
    
    app.on('window-all-closed', () => {
        app.quit()
    })
}
