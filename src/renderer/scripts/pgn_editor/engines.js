"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.liEngine = exports.uciengine = exports.engineTabs = void 0;
const chessops_1 = require("chessops");
const chess_1 = require("chessops/chess");
const fen_1 = require("chessops/fen");
const san_1 = require("chessops/san");
const electron_1 = require("electron");
const path_1 = require("path");
const d3 = require("d3");
const promisetraffic_1 = require("../../scripts/promisetraffic");
const modals_1 = require("../../scripts/pgn_editor/modals");
const mutations_1 = require("../../scripts/pgn_editor/mutations");
const state_1 = require("../../scripts/pgn_editor/state");
const utils_1 = require("../../scripts/pgn_editor/utils");
const toasts_1 = require("../../scripts/pgn_editor/toasts");
exports.engineTabs = {
    open: [],
    has(id) {
        return exports.engineTabs.open.some(t => t.id === id);
    },
    focus(id) {
        d3.select('#engine_tabs_headers').select('li.nav-item').selectChild()
            .filter('[href="#' + id + '"]').node()?.click();
    },
    close(id) {
        const tab = exports.engineTabs.open.find(t => t.id === id);
        if (!tab)
            return;
        tab.header.remove();
        tab.content.remove();
        exports.engineTabs.open.splice(exports.engineTabs.open.findIndex(t => t.id === id), 1);
        if (d3.select('#engine_tabs_headers').select('.engine-link.active').empty() && !d3.select('#engine_tabs_headers').select('.engine-link').empty()) {
            d3.select('#engine_tabs_headers').select('.engine-link').node().click();
        }
    },
    newTab(type, id, header, content) {
        if (exports.engineTabs.has(id)) {
            exports.engineTabs.focus(id);
            return;
        }
        const li = d3.select('#engine_tabs_headers').append('li').attr('class', 'nav-item').attr('role', 'presentation');
        const a = li.append('a').attr('class', 'nav-link engine-link')
            .attr('href', '#' + id).attr('data-toggle', 'tab').attr('role', 'tab');
        a.append('span').attr('class', 'eval').text('-');
        a.append('span').attr('class', 'bestmove').text('-');
        a.append('span').attr('class', 'enginename').text(header);
        const cBtn = a.append('button').attr('class', 'close').html('&times;');
        const eId = id;
        switch (type) {
            case 'uci':
                cBtn?.on('click', ev => { exports.uciengine.closeTab(eId); });
                break;
            case 'tb':
                break;
            case 'book':
                break;
        }
        const div = d3.select('#engine_tabs').append('div').attr('class', 'tab-pane fade')
            .attr('id', id).attr('role', 'tabpanel');
        div.node().appendChild(content);
        exports.engineTabs.open.push({
            header: li.node(),
            content: div.node(),
            id,
            type
        });
    },
};
exports.uciengine = {
    templates: [],
    blockedUntilStop: [],
    open: [],
    nextId: 0,
    tabMap: new Map(),
    lastGameMap: new Map(),
    selectedVariation() {
        if (state_1.state.selected.game === null || state_1.state.selected.move === null)
            return '';
        let v = '';
        const setup = fen_1.parseFen(utils_1.fenOf(state_1.state.selected.game));
        if (setup.isErr)
            return '';
        const tempChess = chess_1.Chess.fromSetup(setup.unwrap()).unwrap();
        const variation = utils_1.selectedVariation();
        for (let i = 0; i < variation.moves.length; i++) {
            const m = variation.moves[i];
            const move = san_1.parseSan(tempChess, m.move);
            let uciMove = chessops_1.makeUci(move);
            if (m.move === 'O-O' || m.move === '0-0') {
                if (m.isBlackMove)
                    uciMove = 'e8g8';
                else
                    uciMove = 'e1g1';
            }
            else if (m.move === 'O-O-O' || m.move === '0-0') {
                if (m.isBlackMove)
                    uciMove = 'e8c8';
                else
                    uciMove = 'e1c1';
            }
            v += ' ' + uciMove;
            tempChess.play(move);
        }
        return v;
    },
    statusName(status) {
        if (status === 'uninitialized')
            return 'Uninitialized';
        if (status === 'waiting')
            return 'Idle';
        if (status === 'searching')
            return 'Searching...';
        if (status === 'unresponsive')
            return '...';
    },
    setStatus(engine, status) {
        engine.status = status;
        console.log(`Status of ${engine.displayName} (${engine.id}): ${engine.status}`);
        if (exports.uciengine.tabMap.has(engine.id)) {
            const div = exports.uciengine.tabMap.get(engine.id);
            div.getElementsByClassName('engine-status')[0].innerText = exports.uciengine.statusName(engine.status);
            const actions = div.getElementsByClassName('engine-action');
            if (status === 'uninitialized') {
                actions.item(0).getElementsByTagName('img')[0].src = '../../../../assets/engine/initialize.svg';
                actions.item(0).getElementsByTagName('span')[0].innerText = 'Initialize';
            }
            else {
                actions.item(0).getElementsByTagName('img')[0].src = '../../../../assets/engine/shut_off.svg';
                actions.item(0).getElementsByTagName('span')[0].innerText = 'Shut down';
            }
            if (status === 'unresponsive')
                actions.item(0).classList.add('disabled');
            else
                actions.item(0).classList.remove('disabled');
            if (status !== 'waiting')
                actions.item(1).classList.add('disabled');
            else
                actions.item(1).classList.remove('disabled');
            if (status !== 'searching')
                actions.item(2).classList.add('disabled');
            else
                actions.item(2).classList.remove('disabled');
            if (status !== 'waiting')
                actions.item(3).classList.add('disabled');
            else
                actions.item(3).classList.remove('disabled');
            if (status === 'uninitialized') {
                const customActions = div.getElementsByClassName('engine-custom-actions')[0];
                while (customActions.children.length > 0) {
                    customActions.children[0].remove();
                }
                const pText = document.createElement('p');
                pText.innerText = '- Initialize the engine to show custom buttons -';
                customActions.appendChild(pText);
            }
            if (status !== 'searching' && status !== 'unresponsive' && exports.uciengine.blockedUntilStop.includes(engine.id)) {
                exports.uciengine.blockedUntilStop.splice(exports.uciengine.blockedUntilStop.indexOf(engine.id), 1);
            }
        }
    },
    setInfo(engine, info) {
        engine.info = info;
        if (exports.uciengine.tabMap.has(engine.id)) {
            const div = exports.uciengine.tabMap.get(engine.id);
            div.getElementsByClassName('engine-name')[0].innerText = info.name;
            div.getElementsByClassName('engine-authors')[0].innerText = info.authors;
        }
    },
    setOptions(engine, options) {
        engine.options = options;
        if (exports.uciengine.tabMap.has(engine.id)) {
            const div = exports.uciengine.tabMap.get(engine.id);
            const customActions = div.getElementsByClassName('engine-custom-actions')[0];
            while (customActions.children.length > 0) {
                customActions.children[0].remove();
            }
            const buttonOptions = options.filter(o => o.type === 'button');
            for (let i = 0; i < buttonOptions.length; i++) {
                const o = buttonOptions[i];
                customActions.appendChild(d3.create('button').text(o.name).attr('class', 'btn btn-secondary').on('click', ev => {
                    if (engine.status !== 'waiting')
                        return;
                    exports.uciengine.setStatus(engine, 'unresponsive');
                    promisetraffic_1.promiseTraffic.request(state_1.state.windowId, 'uci-button', [engine, o.name])
                        .catch((r) => {
                        console.error(r);
                        toasts_1.toasts.showNew('error', `"${o.name}" failed`, r.response.error.message, 'uci', 8000);
                    }).finally(() => {
                        exports.uciengine.setStatus(engine, 'waiting');
                    });
                }).node());
            }
        }
    },
    onOrOff(engine) {
        if (engine.status === 'uninitialized') {
            exports.uciengine.setStatus(engine, 'unresponsive');
            promisetraffic_1.promiseTraffic.request(state_1.state.windowId, 'uci-ignite', [engine])
                .then(r => {
                console.log(r);
                exports.uciengine.setInfo(engine, r.response.info);
                exports.uciengine.setOptions(engine, r.response.options);
                exports.uciengine.setStatus(engine, 'waiting');
            }).catch((r) => {
                console.error(r);
                toasts_1.toasts.showNew('error', 'Failed to initialize "' + engine.displayName + '"', r.response.error.message, 'uci', 8000);
                exports.uciengine.setStatus(engine, 'uninitialized');
            });
        }
        else if (engine.status === 'searching') {
            exports.uciengine.setStatus(engine, 'unresponsive');
            promisetraffic_1.promiseTraffic.request(state_1.state.windowId, 'uci-stop', [engine])
                .then(r => {
                promisetraffic_1.promiseTraffic.request(state_1.state.windowId, 'uci-quit', [engine])
                    .then(r => {
                    exports.uciengine.setStatus(engine, 'uninitialized');
                });
            }).catch((r) => {
                console.error(r);
                toasts_1.toasts.showNew('error', 'Failed to quit', r.response.error.message, 'uci', 8000);
                exports.uciengine.setStatus(engine, 'searching');
            });
        }
        else if (engine.status === 'waiting') {
            exports.uciengine.setStatus(engine, 'unresponsive');
            promisetraffic_1.promiseTraffic.request(state_1.state.windowId, 'uci-quit', [engine])
                .then(r => {
                exports.uciengine.setStatus(engine, 'uninitialized');
            }).catch((r) => {
                console.error(r);
                toasts_1.toasts.showNew('error', 'Failed to quit', r.response.error.message, 'uci', 8000);
                exports.uciengine.setStatus(engine, 'waiting');
            });
        }
    },
    resetStats(engineId) {
        if (!exports.uciengine.tabMap.has(engineId))
            return;
        const tab = exports.uciengine.tabMap.get(engineId);
        d3.select(tab).selectAll('[data-stat]').text('-');
        d3.select(tab).selectAll('.engine-pv').remove();
        const headerLink = d3.select('#engine_tabs_headers').select('a[href="#' + engineId + '"]');
        headerLink.select('.eval').text('-');
        headerLink.select('.bestmove').text('-');
    },
    run(engine) {
        if (!exports.uciengine.tabMap.has(engine.id))
            return;
        if (engine.status === 'unresponsive' || engine.status === 'uninitialized')
            return;
        let stop;
        exports.uciengine.setStatus(engine, 'unresponsive');
        if (engine.status === 'searching') {
            stop = promisetraffic_1.promiseTraffic.request(state_1.state.windowId, 'uci-stop', [engine]);
        }
        else {
            stop = Promise.resolve();
        }
        stop.then(r => {
            exports.uciengine.resetStats(engine.id);
            const fen = utils_1.fenOf(state_1.state.selected.game);
            const moves = exports.uciengine.selectedVariation();
            const newGame = exports.uciengine.lastGameMap.has(engine.id) ? (exports.uciengine.lastGameMap.get(engine.id) !== state_1.state.selected.game) : true;
            promisetraffic_1.promiseTraffic.request(state_1.state.windowId, 'uci-go', [engine, (fen === fen_1.INITIAL_FEN ? 'startpos ' : 'fen ' + fen) + ' moves' + moves, newGame])
                .then(r => {
                exports.uciengine.setStatus(engine, 'searching');
            }).catch((r) => {
                console.error(r);
                toasts_1.toasts.showNew('error', 'Failed to start search', r.response.error.message, 'uci', 8000);
                exports.uciengine.setStatus(engine, 'waiting');
            });
        }).catch((r) => {
            console.error(r);
            toasts_1.toasts.showNew('error', 'Failed to stop search', r.response.error.message, 'uci', 8000);
            exports.uciengine.setStatus(engine, 'waiting');
        });
    },
    stopSearch(engine) {
        if (engine.status !== 'searching')
            return;
        exports.uciengine.setStatus(engine, 'unresponsive');
        promisetraffic_1.promiseTraffic.request(state_1.state.windowId, 'uci-stop', [engine])
            .then(r => {
            const autoRestart = exports.uciengine.blockedUntilStop.includes(engine.id);
            exports.uciengine.setStatus(engine, 'waiting');
            if (autoRestart) {
                exports.uciengine.run(engine);
            }
        }).catch((r) => {
            console.error(r);
            toasts_1.toasts.showNew('error', 'Failed to stop search', r.response.error.message, 'uci', 8000);
            exports.uciengine.setStatus(engine, 'searching');
        });
    },
    configure(engine) {
        uciEngineConfigurationPopup.showEngine(engine);
    },
    createUI(engine) {
        const div = d3.create('div').attr('class', 'engine uci-engine');
        div.append('div').attr('class', 'engine-status engine-string').text(exports.uciengine.statusName(engine.status));
        div.append('div').attr('class', 'engine-name engine-string').text(engine.info ? engine.info.name : engine.displayName);
        div.append('div').attr('class', 'engine-authors engine-string').text(engine.info ? engine.info.authors : 'Anonymous');
        div.append('div').attr('class', 'engine-executable-path engine-string').text(path_1.basename(engine.exePath));
        const actions = div.append('div').attr('class', 'engine-actions').append('ul').attr('class', 'list-group list-group-horizontal');
        const onoff = actions.append('li').attr('class', 'list-group-item engine-action').on('click', ev => {
            if (onoff.classed('disabled'))
                return;
            exports.uciengine.onOrOff(engine);
        });
        onoff.append('img').attr('src', '../../../../assets/engine/initialize.svg');
        onoff.append('span').text('Initialize');
        const start = actions.append('li').attr('class', 'list-group-item engine-action disabled').on('click', ev => {
            if (start.classed('disabled'))
                return;
            exports.uciengine.run(engine);
        });
        start.append('img').attr('src', '../../../../assets/engine/start.svg');
        start.append('span').text('Start');
        const stop = actions.append('li').attr('class', 'list-group-item engine-action disabled').on('click', ev => {
            if (stop.classed('disabled'))
                return;
            exports.uciengine.stopSearch(engine);
        });
        stop.append('img').attr('src', '../../../../assets/engine/stop.svg');
        stop.append('span').text('Stop');
        const options = actions.append('li').attr('class', 'list-group-item engine-action disabled').on('click', ev => {
            if (options.classed('disabled'))
                return;
            exports.uciengine.configure(engine);
        });
        options.append('img').attr('src', '../../../../assets/engine/settings.svg');
        options.append('span').text('Options');
        const stats = div.append('div').attr('class', 'engine-current-stats').append('ul').attr('class', 'list-group list-group-horizontal');
        const score = stats.append('li').attr('class', 'list-group-item engine-stat');
        score.append('div').attr('class', 'engine-stat-big').attr('data-stat', 'score').text('-');
        score.append('div').attr('class', 'engine-stat-name').text('Score');
        const bestMove = stats.append('li').attr('class', 'list-group-item engine-stat');
        bestMove.append('div').attr('class', 'engine-stat-big').attr('data-stat', 'bestmove').text('-');
        bestMove.append('div').attr('class', 'engine-stat-name').text('Best move');
        const depth = stats.append('li').attr('class', 'list-group-item engine-stat');
        depth.append('div').attr('class', 'engine-stat-big').attr('data-stat', 'depth').text('-');
        depth.append('div').attr('class', 'engine-stat-name').text('Depth');
        const time = stats.append('li').attr('class', 'list-group-item engine-stat');
        time.append('div').attr('class', 'engine-stat-small').attr('data-stat', 'time').text('-');
        time.append('div').attr('class', 'engine-stat-name').text('Time (ms)');
        const currMove = stats.append('li').attr('class', 'list-group-item engine-stat');
        currMove.append('div').attr('class', 'engine-stat-big').attr('data-stat', 'currmove').text('-');
        currMove.append('div').attr('class', 'engine-stat-name').text('Curr. move');
        const cpu = stats.append('li').attr('class', 'list-group-item engine-stat');
        cpu.append('div').attr('class', 'engine-stat-big').attr('data-stat', 'cpuload').text('-');
        cpu.append('div').attr('class', 'engine-stat-name').text('CPU %');
        const hash = stats.append('li').attr('class', 'list-group-item engine-stat');
        hash.append('div').attr('class', 'engine-stat-big').attr('data-stat', 'hashfull').text('-');
        hash.append('div').attr('class', 'engine-stat-name').text('Hash %');
        const nps = stats.append('li').attr('class', 'list-group-item engine-stat');
        nps.append('div').attr('class', 'engine-stat-small').attr('data-stat', 'nps').text('-');
        nps.append('div').attr('class', 'engine-stat-name').text('Nodes/s');
        const tbHits = stats.append('li').attr('class', 'list-group-item engine-stat');
        tbHits.append('div').attr('class', 'engine-stat-small').attr('data-stat', 'tbhits').text('-');
        tbHits.append('div').attr('class', 'engine-stat-name').text('TB hits');
        div.append('div').attr('class', 'engine-custom-actions').append('p').text('- Initialize the engine to show custom buttons -');
        div.append('div').attr('class', 'engine-principal-variations').append('span').text('Principal variations:');
        div.append('div').attr('class', 'engine-info-console');
        return div.node();
    },
    createFromTemplate(template) {
        exports.uciengine.nextId++;
        return {
            id: state_1.state.windowId + 'q' + exports.uciengine.nextId,
            templateId: template.id,
            displayName: template.displayName,
            exePath: template.exePath,
            status: 'uninitialized',
            info: template.info,
            options: template.options,
            registration: template.registration,
            searchOptions: template.searchOptions,
        };
    },
    openTab(engine) {
        if (!exports.engineTabs.has(engine.id)) {
            const ui = exports.uciengine.createUI(engine);
            exports.uciengine.tabMap.set(engine.id, ui);
            exports.engineTabs.newTab('uci', engine.id, engine.displayName, ui);
            exports.uciengine.open.push(engine);
        }
        else {
            exports.engineTabs.focus(engine.id);
        }
    },
    closeTab(id) {
        promisetraffic_1.promiseTraffic.request(state_1.state.windowId, 'uci-kill', [id])
            .then(r => {
            exports.engineTabs.close(id);
        }).catch((r) => {
            console.error(r);
            toasts_1.toasts.showNew('warning', 'Could not kill engine', r.response.error.message, 'uci', 8000);
            exports.engineTabs.close(id);
        });
    },
    sanVariation(position, uciVariation) {
        position = position.clone();
        const moves = uciVariation.split(/\s+/).filter(m => m !== '');
        let sanVar = '';
        for (let i = 0; i < moves.length; i++) {
            const uci = moves[i];
            const move = chessops_1.parseUci(uci);
            const san = san_1.makeSan(position, move);
            if (i > 0)
                sanVar += ' ';
            if (i === 0 || position.turn === 'white') {
                sanVar += position.fullmoves + '.';
                if (position.turn === 'black')
                    sanVar += '..';
                else
                    sanVar += ' ';
            }
            sanVar += san;
            position.play(move);
        }
        return sanVar;
    },
    parse(engineId, line) {
        if (exports.uciengine.blockedUntilStop.includes(engineId))
            return;
        if (!exports.uciengine.tabMap.has(engineId))
            return;
        line = line.trim();
        const engine = exports.uciengine.open.find(e => e.id === engineId);
        const tab = exports.uciengine.tabMap.get(engineId);
        d3.select(tab).select('.engine-info-console').insert('div', ':first-child')
            .attr('class', 'engine-console-line').text(line);
        d3.select(tab).select('.engine-info-console').selectChildren().filter((e, i) => i > Number(state_1.state.prefs.infoConsoleLines) - 1).remove();
        if (line.startsWith('info') && engine.status === 'searching') {
            line = line.substring(4).trim() + ' ';
            let stats = {};
            //#region parser
            let context = 'none';
            const ws = /\s/;
            const keywords = ['depth', 'seldepth', 'multipv', 'score', 'nodes', 'nps', 'tbhits', 'sbhits', 'cpuload', 'refutation', 'currline', 'time', 'currmove', 'pv', 'currmovenumber', 'hashfull', 'string'];
            let word = '', expr = '';
            for (let i = 0; i < line.length; i++) {
                const char = line[i];
                if ((context !== 'string') && ws.test(char)) {
                    if (keywords.includes(word.trim())) {
                        if (context !== 'none')
                            stats[context] = expr;
                        context = word.trim();
                        word = '';
                        expr = '';
                    }
                    else {
                        expr += word;
                        word = char;
                    }
                }
                else {
                    word += char;
                }
            }
            expr += word;
            if (context !== 'none')
                stats[context] = expr;
            //#endregion
            if (stats['pv'] !== undefined) {
                const pvLevel = (stats['multipv'] !== undefined) ? +(stats['multipv']) : 1;
                const uciPv = stats['pv'].trim();
                const sanPv = exports.uciengine.sanVariation(state_1.state.chess, uciPv);
                if (pvLevel === 1) {
                    const firstMove = /\d+\.\.\./.test(sanPv) ? sanPv.split(' ')[0].split('.').reverse()[0] : sanPv.split(' ')[1];
                    d3.select(tab).select('[data-stat="bestmove"]').text(firstMove);
                    const headerLink = d3.select('#engine_tabs_headers').select('.engine-link[href="#' + engineId + '"]');
                    headerLink.select('.bestmove').text(firstMove);
                }
                if (d3.select(tab).select('[data-pv-level="' + pvLevel + '"]').empty()) {
                    const pvDiv = d3.create('div').attr('data-pv-level', pvLevel + '').attr('class', 'engine-pv')
                        .attr('data-pv', uciPv).classed('border-primary', pvLevel === 1).on('click', ev => {
                        const uciPv = pvDiv.attr('data-pv');
                        const firstMove = uciPv.split(/\s+/)[0];
                        const coMove = chessops_1.parseUci(firstMove);
                        if (state_1.state.chess.isLegal(coMove))
                            mutations_1.appendMove({ move: san_1.makeSan(state_1.state.chess, coMove) });
                    });
                    pvDiv.append('span').attr('class', 'pv-score').text('-');
                    pvDiv.append('span').text(' | ');
                    pvDiv.append('span').attr('class', 'pv-moves').text(sanPv);
                    const pvParent = d3.select(tab).select('.engine-principal-variations').node();
                    let nextPv = null;
                    for (let i = 0; i < pvParent.children.length; i++) {
                        const pvEl = pvParent.children[i];
                        if (!pvEl.hasAttribute('data-pv-level'))
                            continue;
                        if ((+pvEl.getAttribute('data-pv-level')) > pvLevel) {
                            nextPv = pvEl;
                            break;
                        }
                    }
                    pvParent.insertBefore(pvDiv.node(), nextPv);
                }
                else {
                    const pvDiv = d3.select(tab).select('[data-pv-level="' + pvLevel + '"]');
                    const prevPv = pvDiv.attr('data-pv');
                    if (uciPv.length > prevPv.length || !prevPv.startsWith(uciPv)) {
                        pvDiv.attr('data-pv', uciPv);
                        pvDiv.select('.pv-moves').text(sanPv);
                    }
                }
            }
            if (stats['score'] !== undefined) {
                const scoreNr = Number(stats['score'].replaceAll(/[^(\d|\+|\-|\.)]/g, ''));
                let scoreText = '-';
                if (stats['score'].includes('mate')) {
                    scoreText = 'M' + scoreNr.toFixed(0);
                }
                else if (stats['score'].includes('cp')) {
                    scoreText = (scoreNr >= 0 ? '+' : '') + (Math.round(scoreNr) / 100).toFixed(2);
                }
                if (stats['multipv'] === undefined || stats['multipv'] === '1') {
                    d3.select(tab).select('[data-stat="score"]').text(scoreText);
                    const headerLink = d3.select('#engine_tabs_headers').select('.engine-link[href="#' + engineId + '"]');
                    headerLink.select('.eval').text(scoreText);
                }
                const pvLevel = (stats['multipv'] !== undefined) ? +(stats['multipv']) : 1;
                if (!d3.select(tab).select('[data-pv-level="' + pvLevel + '"]').empty()) {
                    d3.select(tab).select('[data-pv-level="' + pvLevel + '"] .pv-score').text(scoreText);
                }
            }
            if (stats['depth'] !== undefined) {
                if (stats['multipv'] === '1' || (stats['multipv'] === undefined && stats['pv'] !== undefined)) {
                    const curr = d3.select(tab).select('[data-stat="depth"]').text();
                    const selDepthText = '/' + (curr.includes('/') ? curr.split('/')[1] : '?');
                    const currDepth = Number(curr.split('/')[0]);
                    const depthText = (isNaN(currDepth) || (Number(stats['depth'] > currDepth))) ? stats['depth'] : (currDepth + '');
                    d3.select(tab).select('[data-stat="depth"]').text(depthText + selDepthText);
                }
            }
            if (stats['seldepth'] !== undefined) {
                const curr = d3.select(tab).select('[data-stat="depth"]').text();
                d3.select(tab).select('[data-stat="depth"]').text((curr === '-' ? '?' : (curr.split('/')[0])) + '/' + stats['seldepth']);
            }
            if (stats['time'] !== undefined) {
                d3.select(tab).select('[data-stat="time"]').text(stats['time']);
            }
            if (stats['currmove'] !== undefined) {
                const curr = d3.select(tab).select('[data-stat="currmove"]').text();
                d3.select(tab).select('[data-stat="currmove"]').text((curr === '-' ? '?' : (curr.split(':')[0])) + ': ' + stats['currmove']);
            }
            if (stats['currmovenumber'] !== undefined) {
                const curr = d3.select(tab).select('[data-stat="currmove"]').text();
                d3.select(tab).select('[data-stat="currmove"]').text(stats['currmovenumber'] + (curr === '-' ? ': ?' : (':' + curr.split(':')[1])));
            }
            if (stats['cpuload'] !== undefined) {
                d3.select(tab).select('[data-stat="cpuload"]').text((+(stats['cpuload']) / 10).toFixed(1));
            }
            if (stats['hashfull'] !== undefined) {
                d3.select(tab).select('[data-stat="hashfull"]').text((+(stats['hashfull']) / 10).toFixed(1));
            }
            if (stats['nps'] !== undefined) {
                d3.select(tab).select('[data-stat="nps"]').text(stats['nps']);
            }
            if (stats['tbhits'] !== undefined) {
                d3.select(tab).select('[data-stat="tbhits"]').text(stats['tbhits']);
            }
        }
        else if (line.startsWith('bestmove')) {
            const bm = line.split(/\s+/)[1];
            const coMove = chessops_1.parseUci(bm);
            const sanBm = (coMove !== undefined && state_1.state.chess.isLegal(coMove)) ? san_1.makeSan(state_1.state.chess, chessops_1.parseUci(bm)) : '-';
            d3.select(tab).select('[data-stat="bestmove"]').text(sanBm);
            const headerLink = d3.select('#engine_tabs_headers').select('.engine-link[href="#' + engineId + '"]');
            headerLink.select('.bestmove').text(sanBm);
            if (engine.status === 'searching')
                exports.uciengine.setStatus(engine, 'waiting');
        }
        else if (line.startsWith('registration')) {
            if (line.includes('registration ok')) {
                toasts_1.toasts.showNew('message', 'Engine registered', 'Successfully registered ' + engine.displayName
                    + (engine.registration ? (' with ' + engine.registration.name) : ''), 'UCI', 8000);
            }
            else if (line.includes('registration error')) {
                toasts_1.toasts.showNew('warning', 'Registration failed', 'Failed to register ' + engine.registration.name + ': ' + line, 'UCI', 8000);
            }
        }
        else if (line.startsWith('copyprotection')) {
            if (line.includes('copyprotection ok')) {
                toasts_1.toasts.showNew('message', 'Copyprotection checked', engine.displayName + ' finished checking copyprotection and is now ready to use.', 'UCI', 8000);
            }
            else if (line.includes('copyprotection error')) {
                toasts_1.toasts.showNew('error', 'Copyprotection check failed', engine.displayName + ' might not function properly: ' + line, 'UCI', 8000);
            }
        }
    },
    onPositionChange() {
        for (const openEngine of exports.uciengine.open) {
            exports.uciengine.resetStats(openEngine.id);
            if (openEngine.status === 'searching') {
                exports.uciengine.blockedUntilStop.push(openEngine.id);
                exports.uciengine.stopSearch(openEngine);
            }
        }
    }
};
electron_1.ipcRenderer.on('uci-line', (ev, engineId, line) => {
    exports.uciengine.parse(engineId, line.trim());
});
const uciEngineConfigurationPopup = {
    current: {
        engine: null,
        template: null,
    },
    showSearchOptions(engineOrTemplate) {
        if (!engineOrTemplate.searchOptions)
            engineOrTemplate.searchOptions = { infinite: true };
        d3.select('#cfg_uci_search_infinite').property('checked', !!engineOrTemplate.searchOptions.infinite);
        d3.select('#cfg_uci_search_depth').property('checked', engineOrTemplate.searchOptions.depth !== undefined);
        d3.select('#cfg_uci_search_depth_n').property('value', (+engineOrTemplate.searchOptions.depth) > 0 ? engineOrTemplate.searchOptions.depth : '');
        d3.select('#cfg_uci_search_depth_n').attr('value', (+engineOrTemplate.searchOptions.depth) > 0 ? engineOrTemplate.searchOptions.depth : '');
        d3.select('#cfg_uci_search_nodes').property('checked', engineOrTemplate.searchOptions.nodes !== undefined);
        d3.select('#cfg_uci_search_nodes_n').property('value', (+engineOrTemplate.searchOptions.nodes) > 0 ? engineOrTemplate.searchOptions.nodes : '');
        d3.select('#cfg_uci_search_nodes_n').attr('value', (+engineOrTemplate.searchOptions.nodes) > 0 ? engineOrTemplate.searchOptions.nodes : '');
        d3.select('#cfg_uci_search_movetime').property('checked', engineOrTemplate.searchOptions.movetime !== undefined);
        d3.select('#cfg_uci_search_movetime_n').property('value', (+engineOrTemplate.searchOptions.movetime) > 0 ? (((+engineOrTemplate.searchOptions.movetime) / 1000) + '') : '');
        d3.select('#cfg_uci_search_movetime_n').attr('value', (+engineOrTemplate.searchOptions.movetime) > 0 ? (((+engineOrTemplate.searchOptions.movetime) / 1000) + '') : '');
    },
    showUCIOptions(engineOrTemplate) {
        d3.select('#configure_uci_engine_uci_options').selectAll('*').remove();
        if (engineOrTemplate.options !== undefined) {
            for (let i = 0; i < engineOrTemplate.options.length; i++) {
                const option = engineOrTemplate.options[i];
                if (option.name.startsWith('UCI_'))
                    continue;
                if (option.type === 'button')
                    continue;
                const p = d3.select('#configure_uci_engine_uci_options').append('div').attr('class', 'form-group');
                const l = p.append('label').text(option.name);
                switch (option.type) {
                    case 'combo':
                        const sel = l.append('select').attr('class', 'custom-select')
                            .attr('name', option.name);
                        if (option.predefined !== undefined) {
                            option.predefined.forEach(val => {
                                sel.append('option').attr('value', val).text(val).attr('selected', val === option.default ? '' : null);
                            });
                        }
                        sel.property('value', option.value === undefined ? (option.default === undefined ? '' : option.default) : option.value);
                        break;
                    case 'check':
                        p.attr('class', 'form-check');
                        l.attr('class', 'form-check-label').attr('for', 'cfg_uci_checkbox_' + i);
                        p.insert('input', 'label').attr('id', 'cfg_uci_checkbox_' + i).attr('name', option.name).attr('class', 'form-check-input').attr('type', 'checkbox')
                            .attr('checked', option.default === 'true' ? '' : null)
                            .property('checked', (option.value === undefined ? (option.default === undefined ? false : (option.default === 'true')) : (option.value === 'true')));
                        break;
                    case 'spin':
                        const inp = l.append('input').attr('type', 'number').attr('class', 'form-control').attr('name', option.name)
                            .attr('value', option.default !== undefined ? option.default : '')
                            .property('value', option.value === undefined ? (option.default === undefined ? '' : option.default) : option.value);
                        if (option.min !== undefined)
                            inp.attr('min', option.min);
                        if (option.max !== undefined)
                            inp.attr('max', option.max);
                        break;
                    case 'string':
                        l.append('input').attr('type', 'text').attr('class', 'form-control').attr('name', option.name)
                            .attr('value', option.default !== undefined ? option.default : '')
                            .property('value', option.value === undefined ? (option.default === undefined ? '' : option.default) : option.value);
                        break;
                    default:
                        break;
                }
            }
        }
    },
    async showEngine(engine) {
        d3.select('#configure_uci_template_title').style('display', 'none');
        d3.select('#configure_uci_template').style('display', 'none');
        d3.select('#configure_uci_engine_apply').style('display', null);
        d3.select('#configure_uci_engine_save').style('display', 'none');
        uciEngineConfigurationPopup.current.template = null;
        uciEngineConfigurationPopup.current.engine = engine;
        d3.select('#configure_uci_engine_title').text('Configure "' + engine.displayName + '" instance');
        uciEngineConfigurationPopup.showSearchOptions(engine);
        uciEngineConfigurationPopup.showUCIOptions(engine);
        modals_1.modals.open('configure_uci_engine');
    },
    async showTemplate(template) {
        d3.select('#configure_uci_template_title').style('display', null);
        d3.select('#configure_uci_template').style('display', null);
        d3.select('#configure_uci_engine_apply').style('display', 'none');
        d3.select('#configure_uci_engine_save').style('display', null);
        d3.select('#configure_uci_template_exe_path').text(template.exePath);
        d3.select('#configure_uci_template_name').property('value', template.displayName);
        if (template.options === undefined) {
            let opts;
            try {
                opts = await promisetraffic_1.promiseTraffic.request(state_1.state.windowId, 'uci-fetch-options', [template]);
            }
            catch (error) {
                console.error(error);
                opts = undefined;
            }
            template.options = opts?.response?.options;
        }
        uciEngineConfigurationPopup.current.engine = null;
        uciEngineConfigurationPopup.current.template = template;
        d3.select('#configure_uci_engine_title').text('Configure "' + template.displayName + '" template');
        uciEngineConfigurationPopup.showSearchOptions(template);
        uciEngineConfigurationPopup.showUCIOptions(template);
        modals_1.modals.open('configure_uci_engine');
    },
    changedOptions() {
        const initial = uciEngineConfigurationPopup.current.engine !== null ? uciEngineConfigurationPopup.current.engine.options : uciEngineConfigurationPopup.current.template.options;
        let changed = [];
        if (initial !== undefined) {
            for (const oldOpt of initial) {
                if (d3.select('#configure_uci_engine_uci_options').select('[name="' + oldOpt.name + '"]').empty())
                    continue;
                let nVal = '' + d3.select('#configure_uci_engine_uci_options').select('[name="' + oldOpt.name + '"]').property(oldOpt.type === 'check' ? 'checked' : 'value');
                if (nVal === null || nVal === '' || nVal === oldOpt.default)
                    nVal = undefined;
                if (oldOpt.value !== nVal) {
                    changed.push(Object.assign({}, oldOpt, { value: nVal }));
                }
            }
        }
        console.log(changed);
        return changed;
    },
    async applyCurrent() {
        return await new Promise((resolve, reject) => {
            if (uciEngineConfigurationPopup.current.engine === null)
                return;
            uciEngineConfigurationPopup.current.engine.searchOptions = {
                infinite: !!d3.select('#cfg_uci_search_infinite').property('checked'),
                depth: (!!d3.select('#cfg_uci_search_depth').property('checked')) ? (d3.select('#cfg_uci_search_depth_n').property('value')) : undefined,
                nodes: (!!d3.select('#cfg_uci_search_nodes').property('checked')) ? ((+d3.select('#cfg_uci_search_nodes_n').property('value')) * 1000).toString() : undefined,
                movetime: (!!d3.select('#cfg_uci_search_movetime').property('checked')) ? ((+d3.select('#cfg_uci_search_movetime_n').property('value')) * 1000).toString() : undefined,
            };
            const changes = uciEngineConfigurationPopup.changedOptions();
            for (const changedOption of changes) {
                const oIdx = uciEngineConfigurationPopup.current.engine.options.findIndex(o => o.name === changedOption.name);
                if (oIdx >= 0)
                    uciEngineConfigurationPopup.current.engine.options[oIdx].value = changedOption.value;
            }
            promisetraffic_1.promiseTraffic.request(state_1.state.windowId, 'uci-apply-options', [uciEngineConfigurationPopup.current.engine, changes])
                .then(r => resolve(r))
                .catch((r) => {
                toasts_1.toasts.showNew('error', 'Failed to apply options', r.response.error.message, 'uci config', 8000);
                reject(r);
            });
        });
    },
    async saveCurrent() {
        return await new Promise((resolve, reject) => {
            const templateId = uciEngineConfigurationPopup.current.engine !== null ? uciEngineConfigurationPopup.current.engine.templateId : uciEngineConfigurationPopup.current.template.id;
            const searchOptions = {
                infinite: !!d3.select('#cfg_uci_search_infinite').property('checked'),
                depth: (!!d3.select('#cfg_uci_search_depth').property('checked')) ? (d3.select('#cfg_uci_search_depth_n').property('value')) : undefined,
                nodes: (!!d3.select('#cfg_uci_search_nodes').property('checked')) ? ((+d3.select('#cfg_uci_search_nodes_n').property('value')) * 1000).toString() : undefined,
                movetime: (!!d3.select('#cfg_uci_search_movetime').property('checked')) ? ((+d3.select('#cfg_uci_search_movetime_n').property('value')) * 1000).toString() : undefined,
            };
            const changes = uciEngineConfigurationPopup.changedOptions();
            promisetraffic_1.promiseTraffic.request(state_1.state.windowId, 'apply-to-uci-template', [templateId, searchOptions, changes])
                .then(r => resolve(r))
                .catch((r) => {
                toasts_1.toasts.showNew('error', 'Failed to save template "' +
                    (uciEngineConfigurationPopup.current.engine !== null ? uciEngineConfigurationPopup.current.engine.displayName : uciEngineConfigurationPopup.current.template.displayName)
                    + '"', r.response.error.message, 'uci config', 8000);
                reject(r);
            });
        });
    }
};
electron_1.ipcRenderer.on('add-uci-engine-template', (ev, exePath) => {
    if (document.getElementById('add_engine_template_exe_path'))
        document.getElementById('add_engine_template_exe_path').innerText = exePath;
    modals_1.modals.open('add_engine_template');
});
d3.select('#add_engine_template_registration').on('change', ev => {
    const disabledValue = d3.select('#add_engine_template_registration').property('checked') ? null : '';
    d3.select('#add_engine_template_registration_name').attr('disabled', disabledValue);
    d3.select('#add_engine_template_registration_code').attr('disabled', disabledValue);
});
d3.select('#add_engine_template_confirm').on('click', ev => {
    d3.select('#add_engine_template_confirm').attr('disabled', '');
    const name = d3.select('#add_engine_template_display_name').property('value');
    const exePath = d3.select('#add_engine_template_exe_path').text().trim();
    if (name === '') {
        ;
        d3.select('#add_engine_template_display_name').node().focus();
    }
    const template = {
        displayName: name,
        exePath: exePath,
        options: undefined,
        info: undefined,
        id: Date.now() + ''
    };
    promisetraffic_1.promiseTraffic.request(state_1.state.windowId, 'uci-fetch-options', [template])
        .then((r) => {
        template.options = r.response.options;
        template.info = r.response.info;
    }).catch((r) => {
        console.error(r);
        toasts_1.toasts.showNew('error', 'Could not fetch options', 'Are you sure that "' + template.exePath + '" is a UCI chess engine?', 'uci', 8000);
    }).finally(() => {
        promisetraffic_1.promiseTraffic.request(state_1.state.windowId, 'save-engine-template', [template]).then(r => {
            modals_1.modals.close('add_engine_template');
            d3.select('#add_engine_template_confirm').attr('disabled', null);
        }).catch((r) => {
            console.error(r);
            toasts_1.toasts.showNew('error', 'Template was not saved', r.response.error.message, 'uci', 8000);
            d3.select('#add_engine_template_confirm').attr('disabled', null);
        });
    });
});
d3.select('#new_uci_engine').on('click', ev => {
    electron_1.ipcRenderer.send('add-uci-engine', state_1.state.windowId);
});
electron_1.ipcRenderer.on('list-uci-templates', (ev, templates) => {
    d3.selectAll('#enginelist .template-item').remove();
    d3.select('#enginelist_divider').style('display', templates.length === 0 ? 'none' : null);
    for (let i = 0; i < templates.length; i++) {
        const template = templates[i];
        d3.select('#enginelist').append('a').attr('class', 'dropdown-item template-item').attr('role', 'button')
            .text(template.displayName).on('click', ev => {
            exports.uciengine.openTab(exports.uciengine.createFromTemplate(template));
        });
    }
});
electron_1.ipcRenderer.on('open-uci-engine', (ev, template) => {
    exports.uciengine.openTab(exports.uciengine.createFromTemplate(template));
});
electron_1.ipcRenderer.on('open-uci-settings', (ev, template) => {
    uciEngineConfigurationPopup.showTemplate(template);
});
/*d3.select('#configure_uci_template_set_exe_path').on('click', ev => {
    // (TODO) show popup to select .exe, if confirmed & different from prior path fetch options from new engine
})
d3.select('#configure_uci_template_name').on('change', ev => {
    // (TODO) set name of current template (in popup), then save & re-list templates
})*/
d3.select('#configure_uci_engine_defaults').on('click', ev => {
    ;
    d3.select('#configure_uci_engine_search_options').node().reset();
    d3.select('#configure_uci_engine_uci_options').node().reset();
});
d3.select('#configure_uci_engine_apply').on('click', async (ev) => {
    await uciEngineConfigurationPopup.saveCurrent();
    await uciEngineConfigurationPopup.applyCurrent();
    modals_1.modals.close('configure_uci_engine');
});
d3.select('#configure_uci_engine_save').on('click', async (ev) => {
    await uciEngineConfigurationPopup.saveCurrent();
    modals_1.modals.close('configure_uci_engine');
});
//#region lichess engine
exports.liEngine = {
    cloudAnalysisEnabled: false,
    explorerEnabled: false,
    tab: d3.select('#lichess_engine'),
    headerLink: d3.select('.engine-link[href="#lichess_engine"'),
    analysisReady: false,
    explorerReady: false,
    analysisCache: new Map(),
    explorerCache: new Map(),
    explorerType(position) {
        if (position.isEnd())
            return 'none';
        if (position.board.occupied.size() < 8)
            return 'tb';
        return 'op';
    },
    onPositionChange() {
        exports.liEngine.analysisReady = false;
        exports.liEngine.explorerReady = false;
        if (!exports.liEngine.tab.classed('active'))
            return;
        exports.liEngine.onTabShown();
    },
    onTabShown() {
        if (exports.liEngine.cloudAnalysisEnabled)
            exports.liEngine.fetchAnalysis();
        if (exports.liEngine.explorerEnabled)
            exports.liEngine.fetchExplorer();
    },
    disableAnalysis() {
        exports.liEngine.cloudAnalysisEnabled = false;
        exports.liEngine.showAnalysis({ pvs: [], depth: NaN, knodes: NaN });
    },
    enableAnalysis() {
        exports.liEngine.cloudAnalysisEnabled = true;
        if (exports.liEngine.tab.classed('active')) {
            exports.liEngine.analysisReady = false;
            exports.liEngine.fetchAnalysis();
        }
    },
    disableExplorer() {
        exports.liEngine.explorerEnabled = false;
        d3.select('.lichess-engine .explorer-loading').style('display', 'none');
        d3.select('.lichess-engine .no-explorer').style('display', 'none');
        d3.select('.lichess-engine .tb-explorer').style('display', 'none');
        d3.select('.lichess-engine .op-explorer').style('display', 'none');
    },
    enableExplorer() {
        exports.liEngine.explorerEnabled = true;
        if (exports.liEngine.tab.classed('active')) {
            exports.liEngine.explorerReady = false;
            exports.liEngine.fetchExplorer();
        }
    },
    showAnalysis(anal) {
        if (('number' === typeof anal.depth) && isNaN(anal.depth))
            anal.depth = '-';
        if (('number' === typeof anal.knodes) && isNaN(anal.knodes))
            anal.knodes = '-';
        d3.select('.lichess-engine .analstats [data-stat="depth"').text(anal.depth);
        d3.select('.lichess-engine .analstats [data-stat="knodes"').text(anal.knodes);
        let scoreText = '-';
        if (anal.pvs[0]) {
            if (anal.pvs[0].cp !== undefined) {
                const cp = anal.pvs[0].cp;
                scoreText = (((cp >= 0) ? '+' : '') + (cp / 100).toFixed(2));
            }
            else if (anal.pvs[0].mate !== undefined) {
                scoreText = 'M' + anal.pvs[0].mate;
            }
        }
        d3.select('.lichess-engine .analstats [data-stat="score"').text(scoreText);
        d3.select('#engine_tabs_headers').select('a[href="#lichess_engine"]').select('.eval').text(scoreText);
        for (let i = 0; i < 3; i++) {
            const pv = anal.pvs[i];
            if (i === 0) {
                let bm = '-';
                if (pv !== undefined) {
                    const firstMove = pv.moves.split('/\s+/')[0];
                    const coMove = chessops_1.parseUci(firstMove);
                    if (coMove && state_1.state.chess.isLegal(coMove)) {
                        bm = san_1.makeSan(state_1.state.chess, coMove);
                    }
                }
                d3.select('#engine_tabs_headers').select('a[href="#lichess_engine"]').select('.bestmove').text(bm);
            }
            d3.select('.lichess-engine .analpvs [data-li-multipv="' + (i + 1) + '"]').text((pv === undefined) ? '+-.-- | -' : ((pv.cp === undefined ? ('M' + pv.mate.toString().padStart(2, '0')) : (((pv.cp >= 0) ? '+' : '') + (pv.cp / 100).toFixed(2)))
                + ' | ' + exports.uciengine.sanVariation(state_1.state.chess, pv.moves))).attr('data-li-pv', pv === undefined ? '' : pv.moves.trim());
        }
    },
    showTbExplorer(tbData) {
        d3.select('#li_tb_moves').selectAll('*').remove();
        for (let i = 0; i < tbData.moves.length; i++) {
            const move = tbData.moves[i];
            const m = d3.select('#li_tb_moves').append('li')
                .attr('class', 'list-group-item tb-move').attr('data-li-move-uci', move.uci)
                .on('click', ev => {
                const uci = m.attr('data-li-move-uci');
                if (!uci)
                    return;
                const coMove = chessops_1.parseUci(uci);
                if (!state_1.state.chess.isLegal(coMove))
                    return;
                mutations_1.appendMove({ move: san_1.makeSan(state_1.state.chess, coMove) });
            });
            m.append('span').attr('class', 'tb-move-san').text(move.san);
            const badges = m.append('span').attr('class', 'float-right');
            if (move.checkmate)
                badges.append('span').attr('class', 'badge badge-info').text('Checkmate');
            else if (move.stalemate)
                badges.append('span').attr('class', 'badge badge-info').text('Stalemate');
            else if (move.insufficient_material)
                badges.append('span').attr('class', 'badge badge-info').text('Insufficient Material');
            if (move.zeroing)
                badges.append('span').attr('class', 'badge badge-info').text('Zeroing');
            badges.append('span').attr('class', 'badge badge-' + (move.wdl === 0 ? 'secondary' : (move.wdl < 0 ? 'success' : 'danger')))
                .text(move.wdl === 0 ? 'Draw' : (move.wdl < 0 ? 'Win' : 'Loss'));
            if (move.wdl !== 0) {
                badges.append('span').attr('class', 'badge badge-secondary').text('DTZ ' + Math.abs(move.dtz));
                badges.append('span').attr('class', 'badge badge-secondary').text('DTM ' + Math.abs(move.dtm));
            }
        }
        d3.select('.lichess-engine .explorer-loading').style('display', 'none');
        d3.select('.lichess-engine .no-explorer').style('display', 'none');
        d3.select('.lichess-engine .tb-explorer').style('display', null);
        d3.select('.lichess-engine .op-explorer').style('display', 'none');
    },
    showOpExplorer(opData) {
        const total = opData.white + opData.draws + opData.black;
        if (total < 1) {
            exports.liEngine.showNoExplorer();
            return;
        }
        const opExplorer = d3.select('.lichess-engine .op-explorer');
        opExplorer.select('.op-opening').text(opData.opening === null ? '' : (opData.opening.eco + ' ' + opData.opening.name));
        const wPercent = Math.round((opData.white / total) * 100);
        const dPercent = Math.round((opData.draws / total) * 100);
        const bPercent = Math.round((opData.black / total) * 100);
        d3.select('#li_op_wdb').select('.wdb-w').text(wPercent < 1 ? '' : (wPercent + '%'));
        d3.select('#li_op_wdb').select('.wdb-d').text(dPercent < 1 ? '' : (dPercent + '%'));
        d3.select('#li_op_wdb').select('.wdb-b').text(bPercent < 1 ? '' : (bPercent + '%'));
        d3.select('#li_op_wdb').style('grid-template-columns', wPercent + 'fr ' + dPercent + 'fr ' + bPercent + 'fr');
        d3.select('#li_op_games').selectAll('*').remove();
        for (const game of opData.topGames) {
            const g = d3.select('#li_op_games').append('li')
                .attr('class', 'list-group-item d-flex flex-row op-game')
                .attr('data-li-game-id', game.id).on('click', ev => {
                d3.select('#lichess_import').select('[href="#li_import_by_id"]').node().click();
                modals_1.modals.reset('lichess_import');
                d3.select('#li_import_ids').property('value', g.attr('data-li-game-id'));
                modals_1.modals.open('lichess_import', false);
            });
            g.append('span').attr('class', 'text-primary text-nowrap').text(game.winner === 'white' ? '1-0' : (game.winner === 'black' ? '0-1' : '1/2-1/2'));
            g.append('span').attr('class', 'text-center flex-grow-1').text(`${game.white.name} (${game.white.rating}) - ${game.black.name} (${game.black.rating})`);
            g.append('span').attr('class', 'text-info').text(game.year);
        }
        d3.select('#li_op_moves').selectAll('*').remove();
        for (let i = 0; i < opData.moves.length; i++) {
            const move = opData.moves[i];
            const m = d3.select('#li_op_moves').append('li')
                .attr('class', 'list-group-item op-move d-flex flex-row')
                .attr('data-li-move-uci', move.uci).on('click', ev => {
                const uci = m.attr('data-li-move-uci');
                if (!uci)
                    return;
                const coMove = chessops_1.parseUci(uci);
                if (!state_1.state.chess.isLegal(coMove))
                    return;
                mutations_1.appendMove({ move: san_1.makeSan(state_1.state.chess, coMove) });
            });
            m.append('span').attr('class', 'op-move-san').text(move.san);
            m.append('span').attr('class', 'text-info pl-4 pr-4').text('Avg. rating: ' + move.averageRating);
            const total = move.white + move.draws + move.black;
            m.attr('title', total + ' game(s)');
            const w = Math.round(move.white / total * 100);
            const d = Math.round(move.draws / total * 100);
            const b = Math.round(move.black / total * 100);
            const wdb = m.append('div').attr('class', 'flex-grow-1 text-nowrap wdb-bar border rounded border-dark')
                .style('grid-template-columns', w + 'fr ' + d + 'fr ' + b + 'fr');
            wdb.append('span').attr('class', 'wdb-w').text(w < 1 ? '' : (w + '%'));
            wdb.append('span').attr('class', 'wdb-d').text(d < 1 ? '' : (d + '%'));
            wdb.append('span').attr('class', 'wdb-b').text(b < 1 ? '' : (b + '%'));
        }
        d3.select('.lichess-engine .explorer-loading').style('display', 'none');
        d3.select('.lichess-engine .no-explorer').style('display', 'none');
        d3.select('.lichess-engine .tb-explorer').style('display', 'none');
        d3.select('.lichess-engine .op-explorer').style('display', null);
    },
    showNoExplorer() {
        d3.select('.lichess-engine .explorer-loading').style('display', 'none');
        d3.select('.lichess-engine .no-explorer').style('display', null);
        d3.select('.lichess-engine .tb-explorer').style('display', 'none');
        d3.select('.lichess-engine .op-explorer').style('display', 'none');
    },
    fetchAnalysis() {
        if (exports.liEngine.analysisReady)
            return;
        exports.liEngine.analysisReady = true;
        const fenThen = fen_1.makeFen(state_1.state.chess.toSetup());
        d3.select('.lichess-engine .analstats').selectAll('.engine-stat [data-stat]').text('-');
        d3.select('.lichess-engine .analpvs').selectAll('.engine-pv').text('... | Loading...');
        new Promise((resolve, reject) => {
            if (exports.liEngine.analysisCache.has(fenThen)) {
                resolve(exports.liEngine.analysisCache.get(fenThen));
            }
            else {
                setTimeout(() => {
                    const fenNow = fen_1.makeFen(state_1.state.chess.toSetup());
                    if (fenNow === fenThen && exports.liEngine.cloudAnalysisEnabled) {
                        promisetraffic_1.promiseTraffic.request(state_1.state.windowId, 'li-eval', [fenThen, 3])
                            .then(r => { resolve(r); }).catch(err => { reject(err); });
                    }
                }, 1000);
            }
        }).then((r) => {
            exports.liEngine.analysisCache.set(fenThen, r);
            const fenNow = fen_1.makeFen(state_1.state.chess.toSetup());
            if (fenNow === fenThen)
                exports.liEngine.showAnalysis(r.response);
        }).catch((err) => {
            if (err.response.error.message === 'Request failed with status code 404') {
                exports.liEngine.analysisCache.set(fenThen, err);
            }
            else {
                if (err.response === undefined)
                    console.error(err);
                else
                    console.error(err.response.error);
            }
            const fenNow = fen_1.makeFen(state_1.state.chess.toSetup());
            if (fenNow === fenThen)
                exports.liEngine.showAnalysis({ pvs: [], depth: NaN, knodes: NaN });
        });
    },
    fetchExplorer() {
        if (exports.liEngine.explorerReady)
            return;
        exports.liEngine.explorerReady = true;
        const fenThen = fen_1.makeFen(state_1.state.chess.toSetup());
        const type = exports.liEngine.explorerType(state_1.state.chess);
        d3.select('.lichess-engine .explorer-loading').style('display', null);
        d3.select('.lichess-engine .no-explorer').style('display', 'none');
        d3.select('.lichess-engine .tb-explorer').style('display', 'none');
        d3.select('.lichess-engine .op-explorer').style('display', 'none');
        new Promise((resolve, reject) => {
            if (type === 'none') {
                reject({ response: { error: 'Position is not eligible for any explorer' } });
            }
            else if (exports.liEngine.explorerCache.has(fenThen)) {
                resolve(exports.liEngine.explorerCache.get(fenThen));
            }
            else {
                setTimeout(() => {
                    const fenNow = fen_1.makeFen(state_1.state.chess.toSetup());
                    if (fenNow === fenThen && exports.liEngine.explorerEnabled) {
                        (type === 'op' ? promisetraffic_1.promiseTraffic.request(state_1.state.windowId, 'li-opening', ['master', fenThen, 10, 2]) : promisetraffic_1.promiseTraffic.request(state_1.state.windowId, 'li-tablebase', [fenThen]))
                            .then(r => { resolve(r); }).catch(err => { reject(err); });
                    }
                }, 1000);
            }
        }).then((r) => {
            exports.liEngine.explorerCache.set(fenThen, r);
            const fenNow = fen_1.makeFen(state_1.state.chess.toSetup());
            if (fenNow === fenThen) {
                if (type === 'tb')
                    exports.liEngine.showTbExplorer(r.response);
                else if (type === 'op')
                    exports.liEngine.showOpExplorer(r.response);
                else
                    exports.liEngine.showNoExplorer();
            }
        }).catch((err) => {
            if (err.response?.error.message === 'Request failed with status code 404') {
                exports.liEngine.explorerCache.set(fenThen, err);
            }
            else {
                if (err.response === undefined)
                    console.error(err);
                else
                    console.error(err.response.error);
            }
            const fenNow = fen_1.makeFen(state_1.state.chess.toSetup());
            if (fenNow === fenThen)
                exports.liEngine.showNoExplorer();
        });
    }
};
d3.selectAll('.lichess-engine .analpvs .engine-pv').on('click', ev => {
    const pv = ev.target.getAttribute('data-li-pv');
    if (pv === undefined || pv === null || pv === '')
        return;
    const firstMove = pv.split(/\s+/)[0];
    const coMove = chessops_1.parseUci(firstMove);
    if (coMove && state_1.state.chess.isLegal(coMove)) {
        mutations_1.appendMove({ move: san_1.makeSan(state_1.state.chess, coMove) });
    }
});
d3.select('#cloudanal_toggle').on('change', ev => {
    const enabled = d3.select('#cloudanal_toggle').property('checked');
    if (enabled)
        exports.liEngine.enableAnalysis();
    else
        exports.liEngine.disableAnalysis();
});
d3.select('#explorer_toggle').on('change', ev => {
    const enabled = d3.select('#explorer_toggle').property('checked');
    if (enabled)
        exports.liEngine.enableExplorer();
    else
        exports.liEngine.disableExplorer();
});
exports.liEngine.headerLink.on('click', exports.liEngine.onTabShown);
//#endregion
