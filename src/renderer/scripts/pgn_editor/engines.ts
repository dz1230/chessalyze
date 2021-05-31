import { makeUci, parseUci } from "chessops"
import { Chess } from "chessops/chess"
import { INITIAL_FEN, makeFen, parseFen } from "chessops/fen"
import { makeSan, parseSan } from "chessops/san"

import { ipcRenderer } from "electron"
import { basename } from "path"

import d3 = require("d3")

import { Game, Move, RAV } from "../../../common/pgn"
import { UCIEngine, UCIEngineInfo, UCIEngineOption, UCIEngineStatus, UCIEngineTemplate } from "../../../common/uci"

import { CustomResponse, promiseTraffic } from "../../scripts/promisetraffic"
import { modals } from "../../scripts/pgn_editor/modals"
import { appendMove } from "../../scripts/pgn_editor/mutations"
import { state } from "../../scripts/pgn_editor/state"
import { fenOf, indexOf, selectedVariation } from "../../scripts/pgn_editor/utils"
import { toasts } from "../../scripts/pgn_editor/toasts"

export const engineTabs = {
    open: [],
    has(id: string) {
        return engineTabs.open.some(t => t.id === id)
    },
    focus(id: string) {
        (<any>d3.select('#engine_tabs_headers').select('li.nav-item').selectChild()
        .filter('[href="#' + id + '"]').node())?.click()
    },
    close(id: string) {
        const tab = engineTabs.open.find(t => t.id === id)
        if (!tab) return
        tab.header.remove()
        tab.content.remove()
        engineTabs.open.splice(engineTabs.open.findIndex(t => t.id === id), 1)
        if (d3.select('#engine_tabs_headers').select('.engine-link.active').empty() && !d3.select('#engine_tabs_headers').select('.engine-link').empty()) {
            (<any>d3.select('#engine_tabs_headers').select('.engine-link').node()).click()
        }
    },
    newTab(type: 'uci' | 'tb' | 'book', id: string, header: string, content: HTMLDivElement) {
        if (engineTabs.has(id)) {
            engineTabs.focus(id)
            return
        }
        const li = d3.select('#engine_tabs_headers').append('li').attr('class', 'nav-item').attr('role', 'presentation')
        const a = li.append('a').attr('class', 'nav-link engine-link')
        .attr('href', '#'+id).attr('data-toggle', 'tab').attr('role', 'tab')
        a.append('span').attr('class', 'eval').text('-')
        a.append('span').attr('class', 'bestmove').text('-')
        a.append('span').attr('class', 'enginename').text(header)
        const cBtn = a.append('button').attr('class', 'close').html('&times;')
        const eId = id
        switch (type) {
            case 'uci':
                cBtn?.on('click', ev => { uciengine.closeTab(eId) })
                break
            case 'tb':

                break
            case 'book':

                break
        }
        const div = d3.select('#engine_tabs').append('div').attr('class', 'tab-pane fade')
        .attr('id', id).attr('role', 'tabpanel')
        div.node().appendChild(content)
        engineTabs.open.push({
            header: li.node(),
            content: div.node(),
            id,
            type
        })
    },
}
export const uciengine = {
    templates: <UCIEngineTemplate[]>[],
    blockedUntilStop: [],
    open: <UCIEngine[]>[],
    nextId: 0,
    tabMap: new Map<string, HTMLDivElement>(),
    lastGameMap: new Map<string, Game>(),
    selectedVariation(): string {
        if (state.selected.game === null || state.selected.move === null) return ''
        let v = ''
        const setup = parseFen(fenOf(state.selected.game))
        if (setup.isErr) return ''
        const tempChess = Chess.fromSetup(setup.unwrap()).unwrap()
        const variation = selectedVariation()
        for (let i = 0; i < variation.moves.length; i++) {
            const m = variation.moves[i]
            const move = parseSan(tempChess, m.move)
            let uciMove = makeUci(move)
            if (m.move === 'O-O' || m.move === '0-0') {
                if (m.isBlackMove) uciMove = 'e8g8'
                else uciMove = 'e1g1'
            } else if (m.move === 'O-O-O' || m.move === '0-0') {
                if (m.isBlackMove) uciMove = 'e8c8'
                else uciMove = 'e1c1'
            }
            v += ' ' + uciMove
            tempChess.play(move)
        }
        return v
    },
    statusName(status: UCIEngineStatus): string {
        if (status === 'uninitialized') return 'Uninitialized'
        if (status === 'waiting') return 'Idle'
        if (status === 'searching') return 'Searching...'
        if (status === 'unresponsive') return '...'
    },
    setStatus(engine: UCIEngine, status: UCIEngineStatus) {
        engine.status = status
        console.log(`Status of ${engine.displayName} (${engine.id}): ${engine.status}`)
        if (uciengine.tabMap.has(engine.id)) {
            const div = uciengine.tabMap.get(engine.id)
            ;(<HTMLDivElement>div.getElementsByClassName('engine-status')[0]).innerText = uciengine.statusName(engine.status)

            const actions = div.getElementsByClassName('engine-action')
            if (status === 'uninitialized') {
                actions.item(0).getElementsByTagName('img')[0].src = '../../../../assets/engine/initialize.svg'
                actions.item(0).getElementsByTagName('span')[0].innerText = 'Initialize'
            } else {
                actions.item(0).getElementsByTagName('img')[0].src = '../../../../assets/engine/shut_off.svg'
                actions.item(0).getElementsByTagName('span')[0].innerText = 'Shut down'
            }
            if (status === 'unresponsive') actions.item(0).classList.add('disabled')
            else actions.item(0).classList.remove('disabled')
            if (status !== 'waiting') actions.item(1).classList.add('disabled')
            else actions.item(1).classList.remove('disabled')
            if (status !== 'searching') actions.item(2).classList.add('disabled')
            else actions.item(2).classList.remove('disabled')
            if (status !== 'waiting') actions.item(3).classList.add('disabled')
            else actions.item(3).classList.remove('disabled')

            if (status === 'uninitialized') {
                const customActions = div.getElementsByClassName('engine-custom-actions')[0]
                while (customActions.children.length > 0) {
                    customActions.children[0].remove()
                }
                const pText = document.createElement('p')
                pText.innerText = '- Initialize the engine to show custom buttons -'
                customActions.appendChild(pText)
            }

            if (status !== 'searching' && status !== 'unresponsive' && uciengine.blockedUntilStop.includes(engine.id)) {
                uciengine.blockedUntilStop.splice(uciengine.blockedUntilStop.indexOf(engine.id), 1)
            }
        }
    },
    setInfo(engine: UCIEngine, info: UCIEngineInfo) {
        engine.info = info
        if (uciengine.tabMap.has(engine.id)) {
            const div = uciengine.tabMap.get(engine.id)
            ;(<HTMLDivElement>div.getElementsByClassName('engine-name')[0]).innerText = info.name
            ;(<HTMLDivElement>div.getElementsByClassName('engine-authors')[0]).innerText = info.authors
        }
    },
    setOptions(engine: UCIEngine, options: UCIEngineOption[]) {
        engine.options = options
        if (uciengine.tabMap.has(engine.id)) {
            const div = uciengine.tabMap.get(engine.id)
            const customActions = div.getElementsByClassName('engine-custom-actions')[0]
            while (customActions.children.length > 0) {
                customActions.children[0].remove()
            }
            const buttonOptions = options.filter(o => o.type === 'button')
            for (let i = 0; i < buttonOptions.length; i++) {
                const o = buttonOptions[i]
                customActions.appendChild(d3.create('button').text(o.name).attr('class', 'btn btn-secondary').on('click', ev => {
                    if (engine.status !== 'waiting') return
                    uciengine.setStatus(engine, 'unresponsive')
                    promiseTraffic.request(state.windowId, 'uci-button', [engine, o.name])
                    .catch((r: CustomResponse) => {
                        console.error(r)
                        toasts.showNew('error', `"${o.name}" failed`, r.response.error.message, 'uci', 8000)
                    }).finally(() => {
                        uciengine.setStatus(engine, 'waiting')
                    })
                }).node())
            }
        }
    },
    onOrOff(engine: UCIEngine) {
        if (engine.status === 'uninitialized') {
            uciengine.setStatus(engine, 'unresponsive')
            promiseTraffic.request(state.windowId, 'uci-ignite', [engine])
            .then(r => {
                console.log(r)
                uciengine.setInfo(engine, r.response.info)
                uciengine.setOptions(engine, r.response.options)
                uciengine.setStatus(engine, 'waiting')
            }).catch((r: CustomResponse) => {
                console.error(r)
                toasts.showNew('error', 'Failed to initialize "' + engine.displayName + '"', r.response.error.message, 'uci', 8000)
                uciengine.setStatus(engine, 'uninitialized')
            })
        } else if (engine.status === 'searching') {
            uciengine.setStatus(engine, 'unresponsive')
            promiseTraffic.request(state.windowId, 'uci-stop', [engine])
            .then(r => {
                promiseTraffic.request(state.windowId, 'uci-quit', [engine])
                .then(r => {
                    uciengine.setStatus(engine, 'uninitialized')
                })
            }).catch((r: CustomResponse) => {
                console.error(r)
                toasts.showNew('error', 'Failed to quit', r.response.error.message, 'uci', 8000)
                uciengine.setStatus(engine, 'searching')
            })
        } else if (engine.status === 'waiting') {
            uciengine.setStatus(engine, 'unresponsive')
            promiseTraffic.request(state.windowId, 'uci-quit', [engine])
            .then(r => {
                uciengine.setStatus(engine, 'uninitialized')
            }).catch((r: CustomResponse) => {
                console.error(r)
                toasts.showNew('error', 'Failed to quit', r.response.error.message, 'uci', 8000)
                uciengine.setStatus(engine, 'waiting')
            })
        }
    },
    resetStats(engineId: string) {
        if (!uciengine.tabMap.has(engineId)) return
        const tab = uciengine.tabMap.get(engineId)
        d3.select(tab).selectAll('[data-stat]').text('-')
        d3.select(tab).selectAll('.engine-pv').remove()
        const headerLink = d3.select('#engine_tabs_headers').select('a[href="#'+engineId+'"]')
        headerLink.select('.eval').text('-')
        headerLink.select('.bestmove').text('-')
    },
    run(engine: UCIEngine) {
        if (!uciengine.tabMap.has(engine.id)) return
        if (engine.status === 'unresponsive' || engine.status === 'uninitialized') return
        let stop: Promise<any>
        uciengine.setStatus(engine, 'unresponsive')
        if (engine.status === 'searching') {
            stop = promiseTraffic.request(state.windowId, 'uci-stop', [engine])
        } else {
            stop = Promise.resolve()
        }
        stop.then(r => {
            uciengine.resetStats(engine.id)
            const fen = fenOf(state.selected.game)
            const moves = uciengine.selectedVariation()
            const newGame = uciengine.lastGameMap.has(engine.id) ? (uciengine.lastGameMap.get(engine.id) !== state.selected.game) : true
            promiseTraffic.request(state.windowId, 'uci-go', [engine, (fen === INITIAL_FEN ? 'startpos ' : 'fen ' + fen) + ' moves' + moves, newGame])
            .then(r => {
                uciengine.setStatus(engine, 'searching')
            }).catch((r: CustomResponse) => {
                console.error(r)
                toasts.showNew('error', 'Failed to start search', r.response.error.message, 'uci', 8000)
                uciengine.setStatus(engine, 'waiting')
            })
        }).catch((r: CustomResponse) => {
            console.error(r)
            toasts.showNew('error', 'Failed to stop search', r.response.error.message, 'uci', 8000)
            uciengine.setStatus(engine, 'waiting')
        })
    },
    stopSearch(engine: UCIEngine) {
        if (engine.status !== 'searching') return
        uciengine.setStatus(engine, 'unresponsive')
        promiseTraffic.request(state.windowId, 'uci-stop', [engine])
        .then(r => {
            const autoRestart = uciengine.blockedUntilStop.includes(engine.id)
            uciengine.setStatus(engine, 'waiting')
            if (autoRestart) {
                uciengine.run(engine)
            }
        }).catch((r: CustomResponse) => {
            console.error(r)
            toasts.showNew('error', 'Failed to stop search', r.response.error.message, 'uci', 8000)
            uciengine.setStatus(engine, 'searching')
        })
    },
    configure(engine: UCIEngine) {
        uciEngineConfigurationPopup.showEngine(engine)
    },
    createUI(engine: UCIEngine): HTMLDivElement {
        const div = d3.create('div').attr('class', 'engine uci-engine')

        div.append('div').attr('class', 'engine-status engine-string').text(uciengine.statusName(engine.status))
        div.append('div').attr('class', 'engine-name engine-string').text(engine.info ? engine.info.name : engine.displayName)
        div.append('div').attr('class', 'engine-authors engine-string').text(engine.info ? engine.info.authors : 'Anonymous')
        div.append('div').attr('class', 'engine-executable-path engine-string').text(basename(engine.exePath))

        const actions = div.append('div').attr('class', 'engine-actions').append('ul').attr('class', 'list-group list-group-horizontal')
        const onoff = actions.append('li').attr('class', 'list-group-item engine-action').on('click', ev => {
            if (onoff.classed('disabled')) return
            uciengine.onOrOff(engine)
        })
        onoff.append('img').attr('src', '../../../../assets/engine/initialize.svg')
        onoff.append('span').text('Initialize')
        const start = actions.append('li').attr('class', 'list-group-item engine-action disabled').on('click', ev => {
            if (start.classed('disabled')) return
            uciengine.run(engine)
        })
        start.append('img').attr('src', '../../../../assets/engine/start.svg')
        start.append('span').text('Start')
        const stop = actions.append('li').attr('class', 'list-group-item engine-action disabled').on('click', ev => {
            if (stop.classed('disabled')) return
            uciengine.stopSearch(engine)
        })
        stop.append('img').attr('src', '../../../../assets/engine/stop.svg')
        stop.append('span').text('Stop')
        const options = actions.append('li').attr('class', 'list-group-item engine-action disabled').on('click', ev => {
            if (options.classed('disabled')) return
            uciengine.configure(engine)
        })
        options.append('img').attr('src', '../../../../assets/engine/settings.svg')
        options.append('span').text('Options')

        const stats = div.append('div').attr('class', 'engine-current-stats').append('ul').attr('class', 'list-group list-group-horizontal')
        const score = stats.append('li').attr('class', 'list-group-item engine-stat')
        score.append('div').attr('class', 'engine-stat-big').attr('data-stat', 'score').text('-')
        score.append('div').attr('class', 'engine-stat-name').text('Score')
        const bestMove = stats.append('li').attr('class', 'list-group-item engine-stat')
        bestMove.append('div').attr('class', 'engine-stat-big').attr('data-stat', 'bestmove').text('-')
        bestMove.append('div').attr('class', 'engine-stat-name').text('Best move')
        const depth = stats.append('li').attr('class', 'list-group-item engine-stat')
        depth.append('div').attr('class', 'engine-stat-big').attr('data-stat', 'depth').text('-')
        depth.append('div').attr('class', 'engine-stat-name').text('Depth')
        const time = stats.append('li').attr('class', 'list-group-item engine-stat')
        time.append('div').attr('class', 'engine-stat-small').attr('data-stat', 'time').text('-')
        time.append('div').attr('class', 'engine-stat-name').text('Time (ms)')
        const currMove = stats.append('li').attr('class', 'list-group-item engine-stat')
        currMove.append('div').attr('class', 'engine-stat-big').attr('data-stat', 'currmove').text('-')
        currMove.append('div').attr('class', 'engine-stat-name').text('Curr. move')
        const cpu = stats.append('li').attr('class', 'list-group-item engine-stat')
        cpu.append('div').attr('class', 'engine-stat-big').attr('data-stat', 'cpuload').text('-')
        cpu.append('div').attr('class', 'engine-stat-name').text('CPU %')
        const hash = stats.append('li').attr('class', 'list-group-item engine-stat')
        hash.append('div').attr('class', 'engine-stat-big').attr('data-stat', 'hashfull').text('-')
        hash.append('div').attr('class', 'engine-stat-name').text('Hash %')
        const nps = stats.append('li').attr('class', 'list-group-item engine-stat')
        nps.append('div').attr('class', 'engine-stat-small').attr('data-stat', 'nps').text('-')
        nps.append('div').attr('class', 'engine-stat-name').text('Nodes/s')
        const tbHits = stats.append('li').attr('class', 'list-group-item engine-stat')
        tbHits.append('div').attr('class', 'engine-stat-small').attr('data-stat', 'tbhits').text('-')
        tbHits.append('div').attr('class', 'engine-stat-name').text('TB hits')

        div.append('div').attr('class', 'engine-custom-actions').append('p').text('- Initialize the engine to show custom buttons -')

        div.append('div').attr('class', 'engine-principal-variations').append('span').text('Principal variations:')

        div.append('div').attr('class', 'engine-info-console')

        return div.node()
    },
    createFromTemplate(template: UCIEngineTemplate): UCIEngine {
        uciengine.nextId++
        return {
            id: state.windowId + 'q' + uciengine.nextId,
            templateId: template.id,
            displayName: template.displayName,
            exePath: template.exePath,
            status: 'uninitialized',
            info: template.info,
            options: template.options,
            registration: template.registration,
            searchOptions: template.searchOptions,
        }
    },
    openTab(engine: UCIEngine) {
        if (!engineTabs.has(engine.id)) {
            const ui = uciengine.createUI(engine)
            uciengine.tabMap.set(engine.id, ui)
            engineTabs.newTab('uci', engine.id, engine.displayName, ui)
            uciengine.open.push(engine)
        } else {
            engineTabs.focus(engine.id)
        }
    },
    closeTab(id: string) {
        promiseTraffic.request(state.windowId, 'uci-kill', [id])
        .then(r => {
            engineTabs.close(id)
        }).catch((r: CustomResponse) => {
            console.error(r)
            toasts.showNew('warning', 'Could not kill engine', r.response.error.message, 'uci', 8000)
            engineTabs.close(id)
        })
    },
    sanVariation(position: Chess, uciVariation: string): string {
        position = position.clone()
        const moves = uciVariation.split(/\s+/).filter(m => m !== '')
        let sanVar = ''
        for (let i = 0; i < moves.length; i++) {
            const uci = moves[i]
            const move = parseUci(uci)
            const san = makeSan(position, move)
            if (i > 0) sanVar += ' '
            if (i === 0 || position.turn === 'white') {
                sanVar += position.fullmoves + '.'
                if (position.turn === 'black') sanVar += '..'
                else sanVar += ' '
            }
            sanVar += san
            position.play(move)
        }
        return sanVar
    },
    parse(engineId: string, line: string) {
        if (uciengine.blockedUntilStop.includes(engineId)) return
        if (!uciengine.tabMap.has(engineId)) return
        line = line.trim()
        const engine = uciengine.open.find(e => e.id === engineId)
        const tab = uciengine.tabMap.get(engineId)
        d3.select(tab).select('.engine-info-console').insert('div', ':first-child')
        .attr('class', 'engine-console-line').text(line)
        d3.select(tab).select('.engine-info-console').selectChildren().filter((e, i) => i > Number(state.prefs.infoConsoleLines)-1).remove()
        if (line.startsWith('info') && engine.status === 'searching') {
            line = line.substring(4).trim() + ' '
            let stats = {}
            //#region parser
            let context = 'none'
            const ws = /\s/
            const keywords = ['depth','seldepth','multipv','score','nodes','nps','tbhits','sbhits', 'cpuload', 'refutation', 'currline','time','currmove','pv','currmovenumber','hashfull','string']
            let word = '', expr = ''
            for (let i = 0; i < line.length; i++) {
                const char = line[i]
                if ((context !== 'string') && ws.test(char)) {
                    if (keywords.includes(word.trim())) {
                        if (context !== 'none') stats[context] = expr
                        context = word.trim()
                        word = ''
                        expr = ''
                    } else {
                        expr += word
                        word = char
                    }
                } else {
                    word += char
                }
            }
            expr += word
            if (context !== 'none') stats[context] = expr
            //#endregion

            if (stats['pv'] !== undefined) {
                const pvLevel = (stats['multipv'] !== undefined) ? +(stats['multipv']) : 1
                const uciPv = stats['pv'].trim()
                const sanPv = uciengine.sanVariation(state.chess, uciPv)
                if (pvLevel === 1) {
                    const firstMove = /\d+\.\.\./.test(sanPv) ? sanPv.split(' ')[0].split('.').reverse()[0] : sanPv.split(' ')[1]
                    d3.select(tab).select('[data-stat="bestmove"]').text(firstMove)
                    const headerLink = d3.select('#engine_tabs_headers').select('.engine-link[href="#'+engineId + '"]')
                    headerLink.select('.bestmove').text(firstMove)
                }
                if (d3.select(tab).select('[data-pv-level="' + pvLevel + '"]').empty()) {
                    const pvDiv = d3.create('div').attr('data-pv-level', pvLevel+'').attr('class', 'engine-pv')
                    .attr('data-pv', uciPv).classed('border-primary', pvLevel === 1).on('click', ev => {
                        const uciPv = pvDiv.attr('data-pv')
                        const firstMove = uciPv.split(/\s+/)[0]
                        const coMove = parseUci(firstMove)
                        if (state.chess.isLegal(coMove)) appendMove({move: makeSan(state.chess, coMove)})
                    })
                    pvDiv.append('span').attr('class', 'pv-score').text('-')
                    pvDiv.append('span').text(' | ')
                    pvDiv.append('span').attr('class', 'pv-moves').text(sanPv)
                    const pvParent = <HTMLDivElement>d3.select(tab).select('.engine-principal-variations').node()
                    let nextPv = null
                    for (let i = 0; i < pvParent.children.length; i++) {
                        const pvEl = pvParent.children[i]
                        if (!pvEl.hasAttribute('data-pv-level')) continue
                        if ((+pvEl.getAttribute('data-pv-level')) > pvLevel) {
                            nextPv = pvEl
                            break
                        }
                    }
                    pvParent.insertBefore(pvDiv.node(), nextPv)
                } else {
                    const pvDiv = d3.select(tab).select('[data-pv-level="' + pvLevel + '"]')
                    const prevPv = pvDiv.attr('data-pv')
                    if (uciPv.length > prevPv.length || !prevPv.startsWith(uciPv)) {
                        pvDiv.attr('data-pv', uciPv)
                        pvDiv.select('.pv-moves').text(sanPv)
                    }
                }
            }
            if (stats['score'] !== undefined) {
                const scoreNr = Number(stats['score'].replaceAll(/[^(\d|\+|\-|\.)]/g, ''))
                let scoreText = '-'
                if (stats['score'].includes('mate')) {
                    scoreText = 'M' + scoreNr.toFixed(0)
                } else if (stats['score'].includes('cp')) {
                    scoreText = (scoreNr >= 0 ? '+' : '') + (Math.round(scoreNr) / 100).toFixed(2)
                }
                if (stats['multipv'] === undefined || stats['multipv'] === '1') {
                    d3.select(tab).select('[data-stat="score"]').text(scoreText)
                    const headerLink = d3.select('#engine_tabs_headers').select('.engine-link[href="#' + engineId + '"]')
                    headerLink.select('.eval').text(scoreText)
                }
                const pvLevel = (stats['multipv'] !== undefined) ? +(stats['multipv']) : 1
                if (!d3.select(tab).select('[data-pv-level="' + pvLevel + '"]').empty()) {
                    d3.select(tab).select('[data-pv-level="' + pvLevel + '"] .pv-score').text(scoreText)
                }
            }
            if (stats['depth'] !== undefined) {
                if (stats['multipv'] === '1' || (stats['multipv'] === undefined && stats['pv'] !== undefined)) {
                    const curr = d3.select(tab).select('[data-stat="depth"]').text()
                    const selDepthText = '/' + (curr.includes('/') ? curr.split('/')[1] : '?')
                    const currDepth = Number(curr.split('/')[0])
                    const depthText = (isNaN(currDepth) || (Number(stats['depth'] > currDepth))) ? stats['depth'] : (currDepth+'')
                    d3.select(tab).select('[data-stat="depth"]').text(depthText+selDepthText)
                }
            }
            if (stats['seldepth'] !== undefined) {
                const curr = d3.select(tab).select('[data-stat="depth"]').text()
                d3.select(tab).select('[data-stat="depth"]').text((curr === '-' ? '?' : (curr.split('/')[0])) + '/' + stats['seldepth'])
            }
            if (stats['time'] !== undefined) {
                d3.select(tab).select('[data-stat="time"]').text(stats['time'])
            }
            if (stats['currmove'] !== undefined) {
                const curr = d3.select(tab).select('[data-stat="currmove"]').text()
                d3.select(tab).select('[data-stat="currmove"]').text((curr === '-' ? '?' : (curr.split(':')[0])) + ': ' + stats['currmove'])
            }
            if (stats['currmovenumber'] !== undefined) {
                const curr = d3.select(tab).select('[data-stat="currmove"]').text()
                d3.select(tab).select('[data-stat="currmove"]').text(stats['currmovenumber'] + (curr === '-' ? ': ?' : (':' + curr.split(':')[1])))
            }
            if (stats['cpuload'] !== undefined) {
                d3.select(tab).select('[data-stat="cpuload"]').text((+(stats['cpuload']) / 10).toFixed(1))
            }
            if (stats['hashfull'] !== undefined) {
                d3.select(tab).select('[data-stat="hashfull"]').text((+(stats['hashfull']) / 10).toFixed(1))
            }
            if (stats['nps'] !== undefined) {
                d3.select(tab).select('[data-stat="nps"]').text(stats['nps'])
            }
            if (stats['tbhits'] !== undefined) {
                d3.select(tab).select('[data-stat="tbhits"]').text(stats['tbhits'])
            }
        } else if (line.startsWith('bestmove')) {
            const bm = line.split(/\s+/)[1]
            const coMove = parseUci(bm)
            const sanBm = (coMove !== undefined && state.chess.isLegal(coMove)) ? makeSan(state.chess, parseUci(bm)) : '-'
            d3.select(tab).select('[data-stat="bestmove"]').text(sanBm)
            const headerLink = d3.select('#engine_tabs_headers').select('.engine-link[href="#'+engineId + '"]')
            headerLink.select('.bestmove').text(sanBm)
            if (engine.status === 'searching') uciengine.setStatus(engine, 'waiting')
        } else if (line.startsWith('registration')) {
            if (line.includes('registration ok')) {
                toasts.showNew('message', 'Engine registered', 'Successfully registered ' + engine.displayName
                + (engine.registration ? (' with ' + engine.registration.name) : ''), 'UCI', 8000)
            } else if (line.includes('registration error')) {
                toasts.showNew('warning', 'Registration failed', 'Failed to register ' + engine.registration.name + ': ' + line, 'UCI', 8000)
            }
        } else if (line.startsWith('copyprotection')) {
            if (line.includes('copyprotection ok')) {
                toasts.showNew('message', 'Copyprotection checked',
                engine.displayName + ' finished checking copyprotection and is now ready to use.','UCI', 8000)
            } else if (line.includes('copyprotection error')) {
                toasts.showNew('error', 'Copyprotection check failed', 
                engine.displayName + ' might not function properly: ' + line, 'UCI', 8000)
            }
        }
    },
    onPositionChange() {
        for (const openEngine of uciengine.open) {
            uciengine.resetStats(openEngine.id)
            if (openEngine.status === 'searching') {
                uciengine.blockedUntilStop.push(openEngine.id)
                uciengine.stopSearch(openEngine)
            }
        }
    }
}

ipcRenderer.on('uci-line', (ev, engineId: string, line: string) => {
    uciengine.parse(engineId, line.trim())
})

const uciEngineConfigurationPopup = {
    current: {
        engine: <UCIEngine>null,
        template: <UCIEngineTemplate>null,
    },
    showSearchOptions(engineOrTemplate: UCIEngine | UCIEngineTemplate) {
        if (!engineOrTemplate.searchOptions) engineOrTemplate.searchOptions = {infinite: true}
        d3.select('#cfg_uci_search_infinite').property('checked', !!engineOrTemplate.searchOptions.infinite)
        d3.select('#cfg_uci_search_depth').property('checked', engineOrTemplate.searchOptions.depth !== undefined)
        d3.select('#cfg_uci_search_depth_n').property('value', (+engineOrTemplate.searchOptions.depth) > 0 ? engineOrTemplate.searchOptions.depth : '')
        d3.select('#cfg_uci_search_depth_n').attr('value', (+engineOrTemplate.searchOptions.depth) > 0 ? engineOrTemplate.searchOptions.depth : '')
        d3.select('#cfg_uci_search_nodes').property('checked', engineOrTemplate.searchOptions.nodes !== undefined)
        d3.select('#cfg_uci_search_nodes_n').property('value', (+engineOrTemplate.searchOptions.nodes) > 0 ? engineOrTemplate.searchOptions.nodes : '')
        d3.select('#cfg_uci_search_nodes_n').attr('value', (+engineOrTemplate.searchOptions.nodes) > 0 ? engineOrTemplate.searchOptions.nodes : '')
        d3.select('#cfg_uci_search_movetime').property('checked', engineOrTemplate.searchOptions.movetime !== undefined)
        d3.select('#cfg_uci_search_movetime_n').property('value', (+engineOrTemplate.searchOptions.movetime) > 0 ? (((+engineOrTemplate.searchOptions.movetime) / 1000) + '') : '')
        d3.select('#cfg_uci_search_movetime_n').attr('value', (+engineOrTemplate.searchOptions.movetime) > 0 ? (((+engineOrTemplate.searchOptions.movetime) / 1000) + '') : '')
    },
    showUCIOptions(engineOrTemplate: UCIEngine | UCIEngineTemplate) {
        d3.select('#configure_uci_engine_uci_options').selectAll('*').remove()
        if (engineOrTemplate.options !== undefined) {
            for (let i = 0; i < engineOrTemplate.options.length; i++) {
                const option = engineOrTemplate.options[i]
                if (option.name.startsWith('UCI_')) continue
                if (option.type === 'button') continue
                const p = d3.select('#configure_uci_engine_uci_options').append('div').attr('class', 'form-group')
                const l = p.append('label').text(option.name)
                switch (option.type) {
                    case 'combo':
                        const sel = l.append('select').attr('class', 'custom-select')
                        .attr('name', option.name)
                        if (option.predefined !== undefined) {
                            option.predefined.forEach(val => {
                                sel.append('option').attr('value', val).text(val).attr('selected', val === option.default ? '' : null)
                            })
                        }
                        sel.property('value', option.value === undefined ? (option.default === undefined ? '' : option.default) : option.value)   
                        break
                    case 'check':
                        p.attr('class', 'form-check')
                        l.attr('class', 'form-check-label').attr('for', 'cfg_uci_checkbox_'+i)
                        p.insert('input', 'label').attr('id', 'cfg_uci_checkbox_'+i).attr('name', option.name).attr('class', 'form-check-input').attr('type', 'checkbox')
                        .attr('checked', option.default === 'true' ? '' : null)
                        .property('checked', (option.value === undefined ? (option.default === undefined ? false : (option.default === 'true')) : (option.value === 'true')))
                        break
                    case 'spin':
                        const inp = l.append('input').attr('type', 'number').attr('class', 'form-control').attr('name', option.name)
                        .attr('value', option.default !== undefined ? option.default : '')
                        .property('value', option.value === undefined ? (option.default === undefined ? '' : option.default) : option.value)
                        if (option.min !== undefined) inp.attr('min', option.min)
                        if (option.max !== undefined) inp.attr('max', option.max)
                        break
                    case 'string':
                        l.append('input').attr('type', 'text').attr('class', 'form-control').attr('name', option.name)
                        .attr('value', option.default !== undefined ? option.default : '')
                        .property('value', option.value === undefined ? (option.default === undefined ? '' : option.default) : option.value)
                        break
                    default:
                        break
                }
            }
        }
    },
    async showEngine(engine: UCIEngine) {
        d3.select('#configure_uci_template_title').style('display', 'none')
        d3.select('#configure_uci_template').style('display', 'none')
        d3.select('#configure_uci_engine_apply').style('display', null)
        d3.select('#configure_uci_engine_save').style('display', 'none')
        uciEngineConfigurationPopup.current.template = null
        uciEngineConfigurationPopup.current.engine = engine
        d3.select('#configure_uci_engine_title').text('Configure "' + engine.displayName + '" instance')
        uciEngineConfigurationPopup.showSearchOptions(engine)
        uciEngineConfigurationPopup.showUCIOptions(engine)
        modals.open('configure_uci_engine')
    },
    async showTemplate(template: UCIEngineTemplate) {
        d3.select('#configure_uci_template_title').style('display', null)
        d3.select('#configure_uci_template').style('display', null)
        d3.select('#configure_uci_engine_apply').style('display', 'none')
        d3.select('#configure_uci_engine_save').style('display', null)
        d3.select('#configure_uci_template_exe_path').text(template.exePath)
        d3.select('#configure_uci_template_name').property('value', template.displayName)
        if (template.options === undefined) {
            let opts
            try {
                opts = await promiseTraffic.request(state.windowId, 'uci-fetch-options', [template])
            } catch (error) {
                console.error(error)
                opts = undefined
            }
            template.options = opts?.response?.options
        }
        uciEngineConfigurationPopup.current.engine = null
        uciEngineConfigurationPopup.current.template = template
        d3.select('#configure_uci_engine_title').text('Configure "' + template.displayName + '" template')
        uciEngineConfigurationPopup.showSearchOptions(template)
        uciEngineConfigurationPopup.showUCIOptions(template)
        modals.open('configure_uci_engine')
    },
    changedOptions() {
        const initial = uciEngineConfigurationPopup.current.engine !== null ? uciEngineConfigurationPopup.current.engine.options : uciEngineConfigurationPopup.current.template.options
        let changed: UCIEngineOption[] = []
        if (initial !== undefined) {
            for (const oldOpt of initial) {
                if (d3.select('#configure_uci_engine_uci_options').select('[name="' + oldOpt.name + '"]').empty()) continue
                let nVal = ''  + d3.select('#configure_uci_engine_uci_options').select('[name="' + oldOpt.name + '"]').property(oldOpt.type === 'check' ? 'checked' : 'value')
                if (nVal === null || nVal === '' || nVal === oldOpt.default) nVal = undefined
                if (oldOpt.value !== nVal) {
                    changed.push(Object.assign({}, oldOpt, {value: nVal}))
                }
            }
        }
        console.log(changed)
        return changed
    },
    async applyCurrent() {
        return await new Promise((resolve, reject) => {
            if (uciEngineConfigurationPopup.current.engine === null) return
            uciEngineConfigurationPopup.current.engine.searchOptions = {
                infinite: !!d3.select('#cfg_uci_search_infinite').property('checked'),
                depth: (!!d3.select('#cfg_uci_search_depth').property('checked')) ? (d3.select('#cfg_uci_search_depth_n').property('value')) : undefined,
                nodes: (!!d3.select('#cfg_uci_search_nodes').property('checked')) ? ((+d3.select('#cfg_uci_search_nodes_n').property('value')) * 1000).toString() : undefined,
                movetime: (!!d3.select('#cfg_uci_search_movetime').property('checked')) ? ((+d3.select('#cfg_uci_search_movetime_n').property('value')) * 1000).toString() : undefined,
            }
            const changes = uciEngineConfigurationPopup.changedOptions()
            for (const changedOption of changes) {
                const oIdx = uciEngineConfigurationPopup.current.engine.options.findIndex(o => o.name === changedOption.name)
                if (oIdx >= 0) uciEngineConfigurationPopup.current.engine.options[oIdx].value = changedOption.value
            }
            promiseTraffic.request(state.windowId, 'uci-apply-options', [uciEngineConfigurationPopup.current.engine, changes])
            .then(r => resolve(r))
            .catch((r: CustomResponse) => {
                toasts.showNew('error', 'Failed to apply options', r.response.error.message, 'uci config', 8000)
                reject(r)
            })
        })
    },
    async saveCurrent() {
        return await new Promise((resolve, reject) => {
            const templateId = uciEngineConfigurationPopup.current.engine !== null ? uciEngineConfigurationPopup.current.engine.templateId : uciEngineConfigurationPopup.current.template.id
            const searchOptions = {
                infinite: !!d3.select('#cfg_uci_search_infinite').property('checked'),
                depth: (!!d3.select('#cfg_uci_search_depth').property('checked')) ? (d3.select('#cfg_uci_search_depth_n').property('value')) : undefined,
                nodes: (!!d3.select('#cfg_uci_search_nodes').property('checked')) ? ((+d3.select('#cfg_uci_search_nodes_n').property('value')) * 1000).toString() : undefined,
                movetime: (!!d3.select('#cfg_uci_search_movetime').property('checked')) ? ((+d3.select('#cfg_uci_search_movetime_n').property('value')) * 1000).toString() : undefined,
            }
            const changes = uciEngineConfigurationPopup.changedOptions()
            promiseTraffic.request(state.windowId, 'apply-to-uci-template', [templateId, searchOptions, changes])
            .then(r => resolve(r))
            .catch((r: CustomResponse) => {
                toasts.showNew('error', 'Failed to save template "' + 
                (uciEngineConfigurationPopup.current.engine !== null ? uciEngineConfigurationPopup.current.engine.displayName : uciEngineConfigurationPopup.current.template.displayName)
                + '"', r.response.error.message, 'uci config', 8000)
                reject(r)
            })
        })
    }
}

ipcRenderer.on('add-uci-engine-template', (ev, exePath) => {
    if (document.getElementById('add_engine_template_exe_path')) document.getElementById('add_engine_template_exe_path').innerText = exePath
    modals.open('add_engine_template')
})
d3.select('#add_engine_template_registration').on('change', ev => {
    const disabledValue = d3.select('#add_engine_template_registration').property('checked') ? null : ''
    d3.select('#add_engine_template_registration_name').attr('disabled', disabledValue)
    d3.select('#add_engine_template_registration_code').attr('disabled', disabledValue)
})
d3.select('#add_engine_template_confirm').on('click', ev => {
    d3.select('#add_engine_template_confirm').attr('disabled', '')

    const name = d3.select('#add_engine_template_display_name').property('value') 
    const exePath = d3.select('#add_engine_template_exe_path').text().trim()
    if (name === '') {
        ;(<HTMLInputElement>d3.select('#add_engine_template_display_name').node()).focus()
    }

    const template: UCIEngineTemplate = {
        displayName: name,
        exePath: exePath,
        options: undefined,
        info: undefined,
        id: Date.now() + ''
    }
    promiseTraffic.request(state.windowId, 'uci-fetch-options', [template])
    .then((r) => {
        template.options = r.response.options
        template.info = r.response.info
    }).catch((r: CustomResponse) => {
        console.error(r)
        toasts.showNew('error', 'Could not fetch options', 'Are you sure that "' + template.exePath + '" is a UCI chess engine?', 'uci', 8000)
    }).finally(() => {
        promiseTraffic.request(state.windowId, 'save-engine-template', [template]).then(r => {
            modals.close('add_engine_template')
            d3.select('#add_engine_template_confirm').attr('disabled', null)
        }).catch((r: CustomResponse) => {
            console.error(r)
            toasts.showNew('error', 'Template was not saved', r.response.error.message, 'uci', 8000)
            d3.select('#add_engine_template_confirm').attr('disabled', null)
        })
    })
})

d3.select('#new_uci_engine').on('click', ev => {
    ipcRenderer.send('add-uci-engine', state.windowId)
})
ipcRenderer.on('list-uci-templates', (ev, templates: UCIEngineTemplate[]) => {
    d3.selectAll('#enginelist .template-item').remove()
    d3.select('#enginelist_divider').style('display', templates.length === 0 ? 'none' : null)
    for (let i = 0; i < templates.length; i++) {
        const template = templates[i]
        d3.select('#enginelist').append('a').attr('class', 'dropdown-item template-item').attr('role', 'button')
        .text(template.displayName).on('click', ev => {
            uciengine.openTab(uciengine.createFromTemplate(template))
        })
    }
})
ipcRenderer.on('open-uci-engine', (ev, template: UCIEngineTemplate) => {
    uciengine.openTab(uciengine.createFromTemplate(template))
})
ipcRenderer.on('open-uci-settings', (ev, template: UCIEngineTemplate) => {
    uciEngineConfigurationPopup.showTemplate(template)
})

/*d3.select('#configure_uci_template_set_exe_path').on('click', ev => {
    // (TODO) show popup to select .exe, if confirmed & different from prior path fetch options from new engine
})
d3.select('#configure_uci_template_name').on('change', ev => {
    // (TODO) set name of current template (in popup), then save & re-list templates
})*/

d3.select('#configure_uci_engine_defaults').on('click', ev => {
    ;(<any>d3.select('#configure_uci_engine_search_options').node()).reset()
    ;(<any>d3.select('#configure_uci_engine_uci_options').node()).reset()
})
d3.select('#configure_uci_engine_apply').on('click', async ev => {
    await uciEngineConfigurationPopup.saveCurrent()
    await uciEngineConfigurationPopup.applyCurrent()
    modals.close('configure_uci_engine')
})
d3.select('#configure_uci_engine_save').on('click', async ev => {
    await uciEngineConfigurationPopup.saveCurrent()
    modals.close('configure_uci_engine')
})

//#region lichess engine
export const liEngine = {
    cloudAnalysisEnabled: false,
    explorerEnabled: false,
    tab: d3.select('#lichess_engine'),
    headerLink: d3.select('.engine-link[href="#lichess_engine"'),
    analysisReady: false,
    explorerReady: false,
    analysisCache: new Map<string, any>(),
    explorerCache: new Map<string, any>(),
    explorerType (position: Chess): 'tb' | 'op' | 'none' {
        if (position.isEnd()) return 'none'
        if (position.board.occupied.size() < 8) return 'tb'
        return 'op'
    },
    onPositionChange() {
        liEngine.analysisReady = false
        liEngine.explorerReady = false
        if (!liEngine.tab.classed('active')) return
        liEngine.onTabShown()
    },
    onTabShown() {
        if (liEngine.cloudAnalysisEnabled) liEngine.fetchAnalysis()
        if (liEngine.explorerEnabled) liEngine.fetchExplorer()
    },
    disableAnalysis() {
        liEngine.cloudAnalysisEnabled = false
        liEngine.showAnalysis({pvs: [], depth: NaN, knodes: NaN})
    },
    enableAnalysis() {
        liEngine.cloudAnalysisEnabled = true
        if (liEngine.tab.classed('active')) {
            liEngine.analysisReady = false
            liEngine.fetchAnalysis()
        }
    },
    disableExplorer() {
        liEngine.explorerEnabled = false
        d3.select('.lichess-engine .explorer-loading').style('display', 'none')
        d3.select('.lichess-engine .no-explorer').style('display', 'none')
        d3.select('.lichess-engine .tb-explorer').style('display', 'none')
        d3.select('.lichess-engine .op-explorer').style('display', 'none')
    },
    enableExplorer() {
        liEngine.explorerEnabled = true
        if (liEngine.tab.classed('active')) {
            liEngine.explorerReady = false
            liEngine.fetchExplorer()
        }
    },
    showAnalysis(anal: {pvs: {moves: string, cp?: number, mate?: number}[], depth: number | string, knodes: number | string}) {
        if (('number' === typeof anal.depth) && isNaN(anal.depth)) anal.depth = '-'
        if (('number' === typeof anal.knodes) && isNaN(anal.knodes)) anal.knodes = '-'
        d3.select('.lichess-engine .analstats [data-stat="depth"').text(anal.depth)
        d3.select('.lichess-engine .analstats [data-stat="knodes"').text(anal.knodes)
        let scoreText = '-'
        if (anal.pvs[0]) {
            if (anal.pvs[0].cp !== undefined) {
                const cp = anal.pvs[0].cp
                scoreText = (((cp >= 0) ? '+' : '') + (cp/100).toFixed(2))
            } else if (anal.pvs[0].mate !== undefined) {
                scoreText = 'M' + anal.pvs[0].mate
            }
        }
        d3.select('.lichess-engine .analstats [data-stat="score"').text(scoreText)
        d3.select('#engine_tabs_headers').select('a[href="#lichess_engine"]').select('.eval').text(scoreText)
        for (let i = 0; i < 3; i++) {
            const pv = anal.pvs[i]
            if (i === 0) {
                let bm = '-'
                if (pv !== undefined) {
                    const firstMove = pv.moves.split('/\s+/')[0]
                    const coMove = parseUci(firstMove)
                    if (coMove && state.chess.isLegal(coMove)) {
                        bm = makeSan(state.chess, coMove)
                    }
                }
                d3.select('#engine_tabs_headers').select('a[href="#lichess_engine"]').select('.bestmove').text(bm)
            }
            d3.select('.lichess-engine .analpvs [data-li-multipv="' + (i+1) + '"]').text(
                (pv === undefined) ? '+-.-- | -' : (
                    (pv.cp === undefined ? (
                        'M' + pv.mate.toString().padStart(2, '0')
                    ) : (
                        ((pv.cp >= 0) ? '+' : '') + (pv.cp / 100).toFixed(2)
                    ))
                    + ' | ' + uciengine.sanVariation(state.chess, pv.moves)
                )
            ).attr('data-li-pv', pv === undefined ? '' : pv.moves.trim())
        }
    },
    showTbExplorer(tbData: {
        wdl: number, dtz: number, dtm: number,
        checkmate: boolean, stalemate: boolean,
        insufficient_material: boolean,
        moves: {
            uci: string, san: string,
            wdl: number,
            dtz: number,
            dtm: number,
            zeroing: boolean, checkmate: boolean,
            stalemate: boolean, insufficient_material: boolean
        }[]
    }) {
        d3.select('#li_tb_moves').selectAll('*').remove()

        for (let i = 0; i < tbData.moves.length; i++) {
            const move = tbData.moves[i]
            const m = d3.select('#li_tb_moves').append('li')
            .attr('class', 'list-group-item tb-move').attr('data-li-move-uci', move.uci)
            .on('click', ev => {
                const uci = m.attr('data-li-move-uci')
                if (!uci) return
                const coMove = parseUci(uci)
                if (!state.chess.isLegal(coMove)) return
                appendMove({move: makeSan(state.chess, coMove)})
            })
            m.append('span').attr('class', 'tb-move-san').text(move.san)
            const badges = m.append('span').attr('class', 'float-right')
            if (move.checkmate) badges.append('span').attr('class', 'badge badge-info').text('Checkmate')
            else if (move.stalemate) badges.append('span').attr('class', 'badge badge-info').text('Stalemate')
            else if (move.insufficient_material) badges.append('span').attr('class', 'badge badge-info').text('Insufficient Material')
            if (move.zeroing) badges.append('span').attr('class', 'badge badge-info').text('Zeroing')
            
            badges.append('span').attr('class', 'badge badge-' +  (move.wdl === 0 ? 'secondary' : (move.wdl < 0 ? 'success' : 'danger')))
            .text(move.wdl === 0 ? 'Draw' : (move.wdl < 0 ? 'Win' : 'Loss'))
            if (move.wdl !== 0) {
                badges.append('span').attr('class', 'badge badge-secondary').text('DTZ ' + Math.abs(move.dtz))
                badges.append('span').attr('class', 'badge badge-secondary').text('DTM ' + Math.abs(move.dtm))
            }
        }

        d3.select('.lichess-engine .explorer-loading').style('display', 'none')
        d3.select('.lichess-engine .no-explorer').style('display', 'none')
        d3.select('.lichess-engine .tb-explorer').style('display', null)
        d3.select('.lichess-engine .op-explorer').style('display', 'none')
    },
    showOpExplorer(opData: {
        white: number,
        draws: number,
        black: number,
        averageRating: number,
        moves: {
            uci: string
            san: string
            white: number
            draws: number
            black: number
            averageRating: number
        }[],
        topGames: {
            id: string,
            white: {name: string, rating: number},
            black: {name: string, rating: number},
            speed: string,
            winner: 'draw' | 'black' | 'white',
            year: number
        }[],
        opening: null | {eco: string, name: string}
    }) {
        const total = opData.white + opData.draws + opData.black
        if (total < 1) {
            liEngine.showNoExplorer()
            return
        }
        const opExplorer = d3.select('.lichess-engine .op-explorer')
        opExplorer.select('.op-opening').text(
            opData.opening === null ? '' : (opData.opening.eco + ' ' + opData.opening.name)
        )
        const wPercent = Math.round((opData.white / total) * 100)
        const dPercent = Math.round((opData.draws / total) * 100)
        const bPercent = Math.round((opData.black / total) * 100)
        d3.select('#li_op_wdb').select('.wdb-w').text(wPercent < 1 ? '' : (wPercent + '%'))
        d3.select('#li_op_wdb').select('.wdb-d').text(dPercent < 1 ? '' : (dPercent + '%'))
        d3.select('#li_op_wdb').select('.wdb-b').text(bPercent < 1 ? '' : (bPercent + '%'))
        d3.select('#li_op_wdb').style('grid-template-columns', wPercent + 'fr ' + dPercent + 'fr ' + bPercent + 'fr')

        d3.select('#li_op_games').selectAll('*').remove()
        for (const game of opData.topGames) {
            const g = d3.select('#li_op_games').append('li')
            .attr('class', 'list-group-item d-flex flex-row op-game')
            .attr('data-li-game-id', game.id).on('click', ev => {
                (<any>d3.select('#lichess_import').select('[href="#li_import_by_id"]').node()).click()
                modals.reset('lichess_import')
                d3.select('#li_import_ids').property('value', g.attr('data-li-game-id'))
                modals.open('lichess_import', false)
            })
            g.append('span').attr('class', 'text-primary text-nowrap').text(game.winner === 'white' ? '1-0' : (game.winner === 'black' ? '0-1' : '1/2-1/2'))
            g.append('span').attr('class', 'text-center flex-grow-1').text(`${game.white.name} (${game.white.rating}) - ${game.black.name} (${game.black.rating})`)
            g.append('span').attr('class', 'text-info').text(game.year)
        }

        d3.select('#li_op_moves').selectAll('*').remove()
        for (let i = 0; i < opData.moves.length; i++) {
            const move = opData.moves[i]
            const m = d3.select('#li_op_moves').append('li')
            .attr('class', 'list-group-item op-move d-flex flex-row')
            .attr('data-li-move-uci', move.uci).on('click', ev => {
                const uci = m.attr('data-li-move-uci')
                if (!uci) return
                const coMove = parseUci(uci)
                if (!state.chess.isLegal(coMove)) return
                appendMove({move: makeSan(state.chess, coMove)})
            })
            m.append('span').attr('class', 'op-move-san').text(move.san)
            m.append('span').attr('class', 'text-info pl-4 pr-4').text('Avg. rating: ' + move.averageRating)
            const total = move.white + move.draws + move.black
            m.attr('title', total + ' game(s)')
            const w = Math.round(move.white / total * 100)
            const d = Math.round(move.draws / total * 100)
            const b = Math.round(move.black / total * 100)
            const wdb = m.append('div').attr('class', 'flex-grow-1 text-nowrap wdb-bar border rounded border-dark')
            .style('grid-template-columns', w + 'fr ' + d + 'fr ' + b + 'fr')
            wdb.append('span').attr('class', 'wdb-w').text(w < 1 ? '' : (w + '%'))
            wdb.append('span').attr('class', 'wdb-d').text(d < 1 ? '' : (d + '%'))
            wdb.append('span').attr('class', 'wdb-b').text(b < 1 ? '' : (b + '%'))
        }

        d3.select('.lichess-engine .explorer-loading').style('display', 'none')
        d3.select('.lichess-engine .no-explorer').style('display', 'none')
        d3.select('.lichess-engine .tb-explorer').style('display', 'none')
        d3.select('.lichess-engine .op-explorer').style('display', null)
    },
    showNoExplorer() {
        d3.select('.lichess-engine .explorer-loading').style('display', 'none')
        d3.select('.lichess-engine .no-explorer').style('display', null)
        d3.select('.lichess-engine .tb-explorer').style('display', 'none')
        d3.select('.lichess-engine .op-explorer').style('display', 'none')
    },
    fetchAnalysis() {
        if (liEngine.analysisReady) return
        liEngine.analysisReady = true
        const fenThen = makeFen(state.chess.toSetup())
        d3.select('.lichess-engine .analstats').selectAll('.engine-stat [data-stat]').text('-')
        d3.select('.lichess-engine .analpvs').selectAll('.engine-pv').text('... | Loading...')
        new Promise((resolve, reject) => {
            if (liEngine.analysisCache.has(fenThen)) {
                resolve(liEngine.analysisCache.get(fenThen))
            } else {
                setTimeout(() => {
                    const fenNow = makeFen(state.chess.toSetup())
                    if (fenNow === fenThen && liEngine.cloudAnalysisEnabled) {
                        promiseTraffic.request(state.windowId, 'li-eval', [fenThen, 3])
                        .then(r => {resolve(r)}).catch(err => {reject(err)})
                    }
                }, 1000)
            }
        }).then((r: CustomResponse) => {
            liEngine.analysisCache.set(fenThen, r)
            const fenNow = makeFen(state.chess.toSetup())
            if (fenNow === fenThen) liEngine.showAnalysis(r.response)
        }).catch((err: CustomResponse) => {
            if (err.response.error.message === 'Request failed with status code 404') {
                liEngine.analysisCache.set(fenThen, err)
            } else {
                if (err.response === undefined) console.error(err)
                else console.error(err.response.error)
            }
            const fenNow = makeFen(state.chess.toSetup())
            if (fenNow === fenThen) liEngine.showAnalysis({pvs: [], depth: NaN, knodes: NaN})
        })
    },
    fetchExplorer() {
        if (liEngine.explorerReady) return
        liEngine.explorerReady = true
        const fenThen = makeFen(state.chess.toSetup())
        const type = liEngine.explorerType(state.chess)
        d3.select('.lichess-engine .explorer-loading').style('display', null)
        d3.select('.lichess-engine .no-explorer').style('display', 'none')
        d3.select('.lichess-engine .tb-explorer').style('display', 'none')
        d3.select('.lichess-engine .op-explorer').style('display', 'none')
        new Promise((resolve, reject) => {
            if (type === 'none') {
                reject({response: {error: 'Position is not eligible for any explorer'}})
            } else if (liEngine.explorerCache.has(fenThen)) {
                resolve(liEngine.explorerCache.get(fenThen))
            } else {
                setTimeout(() => {
                    const fenNow = makeFen(state.chess.toSetup())
                    if (fenNow === fenThen && liEngine.explorerEnabled) {
                        (type === 'op' ? promiseTraffic.request(state.windowId, 'li-opening', ['master', fenThen, 10, 2]) : promiseTraffic.request(state.windowId, 'li-tablebase', [fenThen]))
                        .then(r => {resolve(r)}).catch(err => {reject(err)})
                    }
                }, 1000)
            }
        }).then((r: CustomResponse) => {
            liEngine.explorerCache.set(fenThen, r)
            const fenNow = makeFen(state.chess.toSetup())
            if (fenNow === fenThen) {
                if (type === 'tb') liEngine.showTbExplorer(r.response)
                else if (type === 'op') liEngine.showOpExplorer(r.response)
                else liEngine.showNoExplorer()
            }
        }).catch((err: CustomResponse) => {
            if (err.response?.error.message === 'Request failed with status code 404') {
                liEngine.explorerCache.set(fenThen, err)
            } else {
                if (err.response === undefined) console.error(err)
                else console.error(err.response.error)
            }
            const fenNow = makeFen(state.chess.toSetup())
            if (fenNow === fenThen) liEngine.showNoExplorer()
        })
    }
}

d3.selectAll('.lichess-engine .analpvs .engine-pv').on('click', ev => {
    const pv = ev.target.getAttribute('data-li-pv')
    if (pv === undefined || pv === null || pv === '') return
    const firstMove = pv.split(/\s+/)[0]
    const coMove = parseUci(firstMove)
    if (coMove && state.chess.isLegal(coMove)) {
        appendMove({ move: makeSan(state.chess, coMove) })
    }
})

d3.select('#cloudanal_toggle').on('change', ev => {
    const enabled = d3.select('#cloudanal_toggle').property('checked')
    if (enabled) liEngine.enableAnalysis()
    else liEngine.disableAnalysis()
})
d3.select('#explorer_toggle').on('change', ev => {
    const enabled = d3.select('#explorer_toggle').property('checked')
    if (enabled) liEngine.enableExplorer()
    else liEngine.disableExplorer()
})

liEngine.headerLink.on('click', liEngine.onTabShown)
//#endregion
