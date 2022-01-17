import { spawn } from "child_process"
import { ChildProcess } from "child_process"
import { dirname } from "path"
import { UCIEngine, UCIEngineInfo, UCIEngineOption, UCIEngineTemplate } from "../common/uci"
import { customResponseFunctions } from "./sharedstate"
import { getWindowByID } from "./windows"

//BUG there seem to be issues with parsing options, but only sometimes? (occured only with komodo 11 so far) (possibly only occurs between chunks)
const parseOption = (line: string): UCIEngineOption => {
    if (line.startsWith('option')) line = line.substring(6)
    line = line.trim() + ' '
    console.log(line)
    const o: UCIEngineOption = {
        name: undefined,
        default: undefined,
        type: undefined,
        min: undefined,
        max: undefined,
        value: undefined,
        predefined: undefined
    }
    const ws = /\s/
    const keywords = ['name', 'type', 'default', 'min', 'max', 'var']
    let context: ('name' | 'type' | 'default' | 'min' | 'max' | 'var' | 'none') = 'none'
    let word = '', expr = ''
    for (let i = 0; i < line.length; i++) {
        const char = line[i]
        if (ws.test(char)) {
            if (keywords.includes(word.trim())) {
                if (context === 'var') {
                    if (o.predefined === undefined) o.predefined = []
                    o.predefined.push(expr.trim())
                } else if (context !== 'none') {
                    o[context] = <any>expr.trim()
                }
                context = <any>word.trim()
                expr = ''
                word = ''
            } else {
                expr += word
                word = char
            }
        } else {
            word += char
        }
    }
    if (context === 'var') {
        if (o.predefined === undefined) o.predefined = []
        o.predefined.push(expr.trim())
    } else if (context !== 'none') {
        o[context] = <any>expr.trim()
    }
    switch (o.name) {
        case 'Hash':
        case 'NalimovCache':
        case 'UCI_Elo':
            if (o.type === undefined) o.type = 'spin'
            break
        case 'Ponder':
        case 'OwnBook':
        case 'UCI_AnalyseMode':
            if (o.type === undefined) o.type = 'check'
            break
        case 'MultiPV':
            if (o.type === undefined) o.type = 'spin'
            if (o.default === undefined) o.default = '1'
            break
        case 'UCI_ShowCurrLine':
        case 'UCI_ShowRefutations':
        case 'UCI_LimitStrength':
            if (o.type === undefined) o.type = 'check'
            if (o.default === undefined) o.default = 'false'
            break
        case 'NalimovPath':
        case 'UCI_Opponent':
        case 'UCI_ShredderbasesPath':
        case 'UCI_SetPositionValue':
            if (o.type === undefined) o.type = 'string'
            break
    }
    return o
}

const fetchOptions = (engine: UCIEngine | UCIEngineTemplate) => {
    return new Promise<{info: UCIEngineInfo, options: UCIEngineOption[]}>((resolve, reject) => {
        let engineName = ''
        let engineAuthors = ''
        let options: UCIEngineOption[] = []
        let lastLine = ''
        const parseLine = (line: string) => {
            line = line.trim()
            //line is complete
            const words = line.split(/\s/)
            switch (words[0]) {
                case 'id':
                    if (words[1] === 'name') {
                        engineName = words.slice(2).join(' ').trim()
                    } else if (words[1] === 'author') {
                        if (engineAuthors != '') engineAuthors += ', '
                        engineAuthors += words.slice(2).join(' ').trim()
                    }
                    break
                case 'option':
                    const o = parseOption(line)
                    if (o !== undefined && o !== null) options.push(o)
                    break
                case 'uciok':
                    p.stdin.write('quit\n', (err => {
                        if (err) {
                            console.error(err)
                            p.kill(1)
                        }
                    }))
                    break
                default:
                    break
            }
        }

        const p = spawn(engine.exePath, {
            cwd: dirname(engine.exePath),
            stdio: 'pipe',
            timeout: 600000
        })
        p.addListener('exit', (code, signal) => {
            if (code === 0) {
                resolve({
                    info: {
                        name: engineName === '' ? engine.displayName : engineName,
                        authors: engineAuthors === '' ? 'Anonymous' : engineAuthors
                    },
                    options
                })
            } else {
                reject(new Error('Engine process exited with code ' + code))
            }
        })
        p.stdout.on('data', (chunk) => {
            chunk = String(chunk)
            const lines = chunk?.split('\n')?.map(l => l.trim())
            if (lines === undefined) return
            for (let i = 0; i < lines.length-1; i++) {
                const line = ((i > 0) ? '' : lastLine) + lines[i]
                parseLine(line)
            }
            lastLine = ((lines.length > 1) ? '' : lastLine) + lines[lines.length-1]
        })
        p.stdin.write('uci\n', (err => {
            if (err) {
                console.error(err)
                p.kill(1)
            }
        }))
    })
}

const createProcess = (engine: UCIEngine) => {
    const p = spawn(engine.exePath, {
        cwd: dirname(engine.exePath),
        stdio: 'pipe'
    })
    p.stdout.on('data', (chunk: string) => {
        chunk = String(chunk)
        const lines = chunk.split('\n').map(l => l.trim())
        const lastLine = lastLines.has(engine.id) ? lastLines.get(engine.id) : ''
        for (let i = 0; i < lines.length-1; i++) {
            const line = ((i > 0) ? '' : lastLine) + lines[i]
            const words = line.split(/\s+/)
            if (validEngineUciCommands.includes(words[0])) {
                uciListeners.trigger(words[0], line, engine)
            }
        }
        lastLines.set(engine.id, ((lines.length > 1) ? '' : lastLine) + lines[lines.length-1])
    })
    p.on('exit', (code, signal) => {
        lastLines.delete(engine.id)
        engineProcesses.delete(engine.id)
        for (let i = 0; i < uciListeners.untilExit.length; i++) {
            const el = uciListeners.untilExit[i]
            if (el.engineId === engine.id) {
                uciListeners.untilExit.splice(i, 1)
            }
        }
        for (let i = 0; i < uciListeners.onExit.length; i++) {
            const el = uciListeners.onExit[i]
            if (el.engineId === engine.id) {
                i--
                uciListeners.onExit.splice(i, 1)
                el.l()
            }
        }
    })
    lastLines.set(engine.id, '')
    engineProcesses.set(engine.id, p)
    return p
}

const sendLine = (engine: UCIEngine, line: string) => {
    if (!engineProcesses.has(engine.id)) return
    if (!line.endsWith('\n')) line += '\n'
    engineProcesses.get(engine.id).stdin.write(line)
}

const validEngineUciCommands = ['id', 'uciok', 'readyok', 'bestmove', 'copyprotection', 'registration', 'info', 'option']

const engineProcesses = new Map<string, ChildProcess>()
const lastLines = new Map<string, string>()

const uciListeners = {
    trigger(command: string, line: string, engine: UCIEngine) {
        for (let i = 0; i < uciListeners.singleUse.length; i++) {
            const el = uciListeners.singleUse[i]
            if (el.engineId === engine.id && el.command === command) {
                el.l(line)
                uciListeners.singleUse.splice(i, 1)
            }
        }
        for (let i = 0; i < uciListeners.untilExit.length; i++) {
            const el = uciListeners.untilExit[i]
            if (el.engineId === engine.id && el.command === command) {
                el.l(line)
            }
        }
        for (let i = 0; i < uciListeners.universal.length; i++) {
            uciListeners.universal[i](engine.id, command, line)
        }
    },
    singleUse: <{engineId: string, command: string, l: (line: string) => void}[]>[],
    untilExit: <{engineId: string, command: string, l: (line: string) => void}[]>[],
    onExit: <{engineId: string, l: () => void}[]>[],
    universal: <((engineId: string, command: string, line: string) => void)[]>[]
}

uciListeners.universal.push((engineId, command, line) => {
    if ((command === 'info') || (command === 'bestmove')) {
        const winId = engineId.split('q')[0]
        const window = getWindowByID(winId)
        window.webContents.send('uci-line', engineId, line)
    }
})

customResponseFunctions.set('uci-apply-options', async (engine: UCIEngine, options: UCIEngineOption[]) => {
    options = options.filter(o => o.value !== undefined)
    return await new Promise(async (resolve, reject) => {
        let i = 0
        while (i < options.length) {
            const name = options[i].name
            const value = options[i].value
            await new Promise((resolve, reject) => {
                uciListeners.singleUse.push({
                    engineId: engine.id,
                    command: 'readyok',
                    l: (line: string) => {
                        resolve(true)
                    }
                })
                sendLine(engine, `setoption name ${name} value ${value}`)
                sendLine(engine, `isready`)
            })
            i++
        }
        resolve(true)
    })
})

customResponseFunctions.set('uci-ignite', async (engine: UCIEngine) => {
    return await new Promise((resolve, reject) => {
        if (engineProcesses.has(engine.id)) {
            reject(`${engine.id} is already initialized`)
        } else {
            let options = []
            let info = {
                name: engine.displayName,
                authors: ''
            }

            const optionListener = {
                engineId: engine.id,
                command: 'option',
                l: (line: string) => {
                    const o = parseOption(line)
                    options.push(o)
                }
            }
            uciListeners.untilExit.push(optionListener)
            const idListener = {
                engineId: engine.id,
                command: 'id',
                l: (line: string) => {
                    line = line.trim()
                    const words = line.split(/\s/)
                    if (words[1] === 'name') {
                        info.name = words.slice(2).join(' ').trim()
                    } else if (words[1] === 'author') {
                        if (info.authors != '') info.authors += ', '
                        info.authors += words.slice(2).join(' ').trim()
                    }
                }
            }
            uciListeners.untilExit.push(idListener)
            const registrationListener = {
                engineId: engine.id,
                command: 'registration',
                l: (line: string) => {
                    if (line.includes('checking')) {
                        uciListeners.singleUse.push(registrationListener)
                    } else if (line.includes('error')) {
                        if (engine.registration !== undefined) {
                            uciListeners.singleUse.push({
                                engineId: engine.id,
                                command: 'registration',
                                l: (line: string) => {
                                    const winId = engine.id.split('q')[0]
                                    const window = getWindowByID(winId)
                                    window.webContents.send('uci-line', engine.id, line)
                                }
                            })
                            sendLine(engine, 'register name ' + engine.registration.name + ' code ' + engine.registration.code)
                        } else {
                            sendLine(engine, 'register later')
                        }
                    }
                }
            }
            uciListeners.singleUse.push(registrationListener)

            uciListeners.singleUse.push({
                engineId: engine.id,
                command: 'uciok',
                l: (line: string) => {
                    uciListeners.untilExit.splice(uciListeners.untilExit.indexOf(idListener), 1)
                    uciListeners.untilExit.splice(uciListeners.untilExit.indexOf(optionListener), 1)
                    sendLine(engine, 'isready')
                }
            })
            uciListeners.singleUse.push({
                engineId: engine.id,
                command: 'readyok',
                l: (line: string) => {
                    if (info.authors === '') info.authors = 'Anonymous'
                    let definedOptions = engine.options ? engine.options.filter(o =>
                    options.findIndex(o1 => o.name === o1.name) && o.value !== undefined) : []
                    for (const option of definedOptions) {
                        options.find(o1 => o1.name === option.name).value = option.value
                    }
                    if (definedOptions.findIndex(o => o.name === 'UCI_AnalyseMode') < 0) definedOptions.push({name: 'UCI_AnalyseMode', value: 'true', default: 'false', predefined: undefined, type: 'check', max: undefined, min: undefined})
                    new Promise(async (resolve, reject) => {
                        let i = 0
                        while (i < definedOptions.length) {
                            const name = definedOptions[i].name
                            const value = definedOptions[i].value
                            await new Promise((resolve, reject) => {
                                uciListeners.singleUse.push({
                                    engineId: engine.id,
                                    command: 'readyok',
                                    l: (line: string) => {
                                        resolve(true)
                                    }
                                })
                                sendLine(engine, `setoption name ${name} value ${value}`)
                                sendLine(engine, `isready`)
                            })
                            i++
                        }
                        resolve(true)
                    }).catch(err => {
                        console.error(err)
                    }).finally(() => {
                        resolve({info, options})
                    })
                }
            })
            createProcess(engine)
            sendLine(engine, 'uci')
        }
    })
})
customResponseFunctions.set('uci-stop', async (engine: UCIEngine) => {
    return await new Promise((resolve, reject) => {
        if (!engineProcesses.has(engine.id)) resolve({})
        let didStop = false
        setTimeout(() => {
            if (!didStop) reject('Timeout')
        }, 30000)
        uciListeners.singleUse.push({
            engineId: engine.id,
            command: 'readyok',
            l: (line: string) => {
                didStop = true
                resolve({})
            }
        })
        sendLine(engine, 'stop')
        sendLine(engine, 'isready')
    })
})
customResponseFunctions.set('uci-quit', async (engine: UCIEngine) => {
    return await new Promise((resolve, reject) => {
        if (!engineProcesses.has(engine.id)) resolve({})
        let didExit = false
        setTimeout(() => {
            if (!didExit) reject('Timeout')
        }, 30000)
        uciListeners.onExit.push({engineId: engine.id, l: () => {
            didExit = true
            resolve({})
        }})
        sendLine(engine, 'quit')
    })
})
customResponseFunctions.set('uci-button', async (engine: UCIEngine, command: string) => {
    return await new Promise((resolve, reject) => {
        uciListeners.singleUse.push({
            engineId: engine.id,
            command: 'readyok',
            l: (line: string) => {
                resolve({})
            }
        })
        sendLine(engine, 'setoption name ' + command)
        sendLine(engine, 'isready')
    })
})
customResponseFunctions.set('uci-go', async (engine: UCIEngine, position: string, newGame: boolean) => {
    return await new Promise((resolve, reject) => {
        const readyListener = {
            engineId: engine.id,
            command: 'readyok',
            l: (line) => {
                resolve({})
            }
        }
        const positionReadyListener = {
            engineId: engine.id,
            command: 'readyok',
            l: (line) => {
                uciListeners.singleUse.push(readyListener)
                let goLine = 'go'
                if (engine.searchOptions === undefined || engine.searchOptions.infinite) goLine += ' infinite'
                if (engine.searchOptions?.depth) goLine += ' depth ' + engine.searchOptions.depth
                if (engine.searchOptions?.nodes) goLine += ' nodes ' + engine.searchOptions.nodes
                if (engine.searchOptions?.movetime) goLine += ' movetime ' + engine.searchOptions.movetime
                sendLine(engine, goLine)
                sendLine(engine, 'isready')
            }
        }
        const newgameListener = {
            engineId: engine.id,
            command: 'readyok',
            l: (line) => {
                uciListeners.singleUse.push(positionReadyListener)
                sendLine(engine, 'position ' + position)
                sendLine(engine, 'isready')
            }
        }
        if (newGame) {
            uciListeners.singleUse.push(newgameListener)
            sendLine(engine, 'ucinewgame')
            sendLine(engine, 'isready')
        } else {
            newgameListener.l('readyok\n')
        }
    })
})
customResponseFunctions.set('uci-fetch-options', async (engine: UCIEngine | UCIEngineTemplate) => {
    return await fetchOptions(engine)
})
customResponseFunctions.set('uci-kill', async (engineId: string) => {
    return await new Promise((resolve, reject) => {
        if (engineProcesses.has(engineId)) {
            uciListeners.onExit.push({
                engineId,
                l: () => {
                    resolve({})
                }
            })
            engineProcesses.get(engineId).kill()
        } else {
            resolve({})
        }
    })
})
