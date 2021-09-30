"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const fen_1 = require("chessops/fen");
const compat_1 = require("chessops/compat");
const util_1 = require("chessops/util");
const san_1 = require("chessops/san");
const electron_1 = require("electron");
const d3 = require("d3");
const pgn_1 = require("../../../common/pgn");
const promisetraffic_1 = require("../../scripts/promisetraffic");
const state_1 = require("../../scripts/pgn_editor/state");
const utils_1 = require("../../scripts/pgn_editor/utils");
const modals_1 = require("../../scripts/pgn_editor/modals");
const annotation_1 = require("../../scripts/pgn_editor/annotation");
const engines_1 = require("../../scripts/pgn_editor/engines");
const tags_1 = require("../../scripts/pgn_editor/tags");
const mutations_1 = require("../../scripts/pgn_editor/mutations");
const movelist_1 = require("../../scripts/pgn_editor/movelist");
const gamelist_1 = require("../../scripts/pgn_editor/gamelist");
const selection_1 = require("../../scripts/pgn_editor/selection");
const toasts_1 = require("../../scripts/pgn_editor/toasts");
const promotionData = {
    orig: null,
    dest: null,
    side: null,
    open() {
        d3.selectAll('#promotion_popup piece').classed('white', false).classed('black', false).classed(promotionData.side, true);
        if ((promotionData.side === 'white' && state_1.state.chessground.state.orientation === 'white') ||
            (promotionData.side === 'black' && state_1.state.chessground.state.orientation === 'black')) {
            d3.select('#promotion_popup square[data-role="queen"]').style('top', '0%');
            d3.select('#promotion_popup square[data-role="rook"]').style('top', '12.5%');
            d3.select('#promotion_popup square[data-role="bishop"]').style('top', '25%');
            d3.select('#promotion_popup square[data-role="knight"]').style('top', '37.5%');
        }
        else {
            d3.select('#promotion_popup square[data-role="queen"]').style('top', '87.5%');
            d3.select('#promotion_popup square[data-role="rook"]').style('top', '75%');
            d3.select('#promotion_popup square[data-role="bishop"]').style('top', '62.5%');
            d3.select('#promotion_popup square[data-role="knight"]').style('top', '50%');
        }
        d3.selectAll('#promotion_popup square').style('left', (util_1.squareFile(util_1.parseSquare(promotionData.dest)) * 12.5) + '%');
        d3.select('#promotion_popup').style('display', null);
    },
    confirm(role) {
        const promLetter = {
            'queen': 'q',
            'rook': 'r',
            'bishop': 'b',
            'knight': 'n'
        }[role];
        const coMove = util_1.parseUci(promotionData.orig + promotionData.dest + promLetter);
        if (coMove && state_1.state.chess.isLegal(coMove))
            mutations_1.appendMove({ move: san_1.makeSan(state_1.state.chess, coMove) });
        else
            d3.select('#promotion_popup').style('display', 'none');
    }
};
d3.selectAll('#promotion_popup square').on('click', ev => {
    const role = ev.target.parentElement.getAttribute('data-role');
    if (['queen', 'rook', 'bishop', 'knight'].includes(role))
        promotionData.confirm(role);
});
state_1.state.chessground.set({
    fen: fen_1.INITIAL_FEN,
    orientation: 'white',
    viewOnly: false,
    selectable: {
        enabled: true,
    },
    disableContextMenu: true,
    autoCastle: true,
    highlight: {
        check: true,
        lastMove: true,
    },
    animation: {
        enabled: true,
        duration: 100
    },
    coordinates: true,
    draggable: {
        enabled: true,
        deleteOnDropOff: false,
        showGhost: true,
        autoDistance: true
    },
    predroppable: {
        enabled: false,
    },
    premovable: {
        enabled: false
    },
    drawable: {
        enabled: true,
        defaultSnapToValidMove: false,
        eraseOnClick: true,
        visible: true
    },
    movable: {
        free: false,
        rookCastle: true,
        showDests: true,
        color: "both",
        dests: compat_1.chessgroundDests(state_1.state.chess, { chess960: false }),
        events: {
            after(orig, dest, metadata) {
                promotionData.dest = dest;
                promotionData.orig = orig;
                promotionData.side = null;
                const move = util_1.parseUci(orig + dest);
                let promotion = 'none';
                if (state_1.state.chess.board.get(util_1.parseSquare(orig)).role === 'pawn') {
                    const destNr = util_1.parseSquare(dest);
                    if (state_1.state.chess.turn === 'white') {
                        if (util_1.squareRank(destNr) === util_1.squareRank(util_1.parseSquare('a8'))) {
                            promotion = 'white';
                        }
                    }
                    else {
                        if (util_1.squareRank(destNr) === util_1.squareRank(util_1.parseSquare('a1'))) {
                            promotion = 'black';
                        }
                    }
                }
                if (promotion === 'none') {
                    mutations_1.appendMove({ move: san_1.makeSan(state_1.state.chess, move) });
                }
                else if (promotion === 'white') {
                    promotionData.side = 'white';
                    promotionData.open();
                }
                else if (promotion === 'black') {
                    promotionData.side = 'black';
                    promotionData.open();
                }
            }
        }
    },
    resizable: true,
    events: {
        change: () => {
            engines_1.uciengine.onPositionChange();
        }
    }
});
document.body.firstChild.dispatchEvent(new Event('chessground.resize'));
window.addEventListener('resize', ev => {
    document.body.dispatchEvent(new Event('chessground.resize'));
});
document.body.firstChild.addEventListener('scroll', ev => {
    document.body.dispatchEvent(new Event('chessground.resize'));
});
tags_1.tags.addListener('Result', (prev, value) => {
    if (state_1.state.selected.game !== null)
        state_1.state.selected.game.result = value;
    d3.selectAll('.result').text(value);
    return value;
});
tags_1.tags.addListener('White', (prev, value) => {
    const displayName = (value === '' || value === '?' || value === null) ? 'Anonymous' : value;
    if (state_1.state.chessground.state.orientation === 'white')
        d3.select('#player_bottom').text(displayName);
    else
        d3.select('#player_top').text(displayName);
    d3.select('.game.current').text(gamelist_1.gamelist.gamename(state_1.state.selected.game, displayName));
    return value;
});
tags_1.tags.addListener('Black', (prev, value) => {
    const displayName = (value === '' || value === '?' || value === null) ? 'Anonymous' : value;
    if (state_1.state.chessground.state.orientation === 'black')
        d3.select('#player_bottom').text(displayName);
    else
        d3.select('#player_top').text(displayName);
    d3.select('.game.current').text(gamelist_1.gamelist.gamename(state_1.state.selected.game, '', displayName));
    return value;
});
tags_1.tags.addListener('WhiteElo', (prev, value) => {
    const displayElo = (value === null || value === '') ? '-' : value;
    if (state_1.state.chessground.state.orientation === 'white')
        d3.select('#elo_bottom').text(displayElo);
    else
        d3.select('#elo_top').text(displayElo);
    return value;
});
tags_1.tags.addListener('BlackElo', (prev, value) => {
    const displayElo = (value === null || value === '') ? '-' : value;
    if (state_1.state.chessground.state.orientation === 'black')
        d3.select('#elo_bottom').text(displayElo);
    else
        d3.select('#elo_top').text(displayElo);
    return value;
});
tags_1.tags.addListener('WhiteTitle', (prev, value) => {
    if (state_1.state.chessground.state.orientation === 'white') {
        d3.select('#title_bottom').text(value);
    }
    else {
        d3.select('#title_top').text(value);
    }
    return value;
});
tags_1.tags.addListener('BlackTitle', (prev, value) => {
    if (state_1.state.chessground.state.orientation === 'black') {
        d3.select('#title_bottom').text(value);
    }
    else {
        d3.select('#title_top').text(value);
    }
    return value;
});
d3.selectAll('.action.adjudication').on('click', ev => {
    tags_1.tags.set('Result', ev.target.getAttribute('data-result'));
    tags_1.tags.set('Termination', 'adjudication');
});
tags_1.tags.addListener('FEN', (prev, value) => {
    if (value !== null && fen_1.parseFen(value).isErr)
        value = fen_1.INITIAL_FEN;
    if (value !== null)
        tags_1.tags.set('SetUp', value === fen_1.INITIAL_FEN ? '0' : '1');
    else
        tags_1.tags.set('SetUp', null);
    return value;
});
tags_1.tags.addListener('FEN', (prev, value) => {
    if (prev !== value) {
        let fen = value === null ? fen_1.INITIAL_FEN : value;
        if (state_1.state.selected.game !== null) {
            if (!state_1.state.selected.game.headers.some(h => h.name === 'FEN'))
                state_1.state.selected.game.headers.push({ name: 'FEN', value: fen });
            else
                state_1.state.selected.game.headers.find(h => h.name === 'FEN').value = fen;
            state_1.state.selected.game.moves.splice(0);
            movelist_1.movelist.show(state_1.state.selected.game);
            selection_1.selection.selectMove(null, true);
        }
    }
    return value;
});
for (const tag of tags_1.tags.list.selectChildren()) {
    if (tags_1.tags.roster.includes(tag.getAttribute('data-tag'))) {
        tag.addEventListener('change', tags_1.tags.changeListener);
    }
}
d3.select('#board').on('wheel', ev => {
    if (ev.deltaY > 1) {
        if (state_1.state.selected.next === null)
            return;
        selection_1.selection.selectMove(state_1.state.selected.next);
    }
    else if (ev.deltaY < -1) {
        if (state_1.state.selected.move === null)
            return;
        const variation = utils_1.variationOf(state_1.state.selected.move);
        const j = variation.moves.indexOf(state_1.state.selected.move);
        if (j === 0) {
            let index = utils_1.indexOfVariation(variation);
            index.pop();
            while (index.length > 0 && index[index.length - 1] === 0) {
                index.pop();
                index.pop();
            }
            if (index.length > 0) {
                index[index.length - 1] -= 1;
                selection_1.selection.selectMove(utils_1.moveAt(index));
            }
            else {
                selection_1.selection.selectMove(null);
            }
        }
        else {
            selection_1.selection.selectMove(variation.moves[j - 1]);
        }
    }
});
d3.select('#lichess_import_confirm').on('click', ev => {
    const m = d3.select('#lichess_import');
    const importType = m.select('.nav-link[href="#li_import_by_study"]').classed('active') ? 'study' : (m.select('.nav-link[href="#li_import_by_id"]').classed('active') ? 'id' : (m.select('.nav-link[href="#li_import_by_user"]').classed('active') ? 'user' : (m.select('.nav-link[href="#li_import_by_tournament"]').classed('active') ? 'tournament' : 'none')));
    d3.select('#progress_title').text('Importing games...');
    modals_1.modals.open('progress');
    modals_1.modals.close('lichess_import');
    (() => {
        switch (importType) {
            case 'study':
                const clocks = !!d3.select('#li_study_clocks').property('value');
                const comments = !!d3.select('#li_study_comments').property('value');
                const variations = !!d3.select('#li_study_variations').property('value');
                if (d3.select('#li_study_by_user').property('checked')) {
                    const username = d3.select('#li_study_user').property('value').trim().toLowerCase();
                    if (username === '')
                        return Promise.reject('Missing username');
                    return promisetraffic_1.promiseTraffic.request(state_1.state.windowId, 'li-studies-user', [
                        state_1.state.windowId, username, clocks, comments, variations
                    ]);
                }
                else {
                    const studyId = d3.select('#study_id').property('value').trim();
                    if (studyId === '')
                        return Promise.reject('Missing study id');
                    const chapterId = d3.select('#li_study_chapter').property('value').trim();
                    if (chapterId !== '') {
                        return promisetraffic_1.promiseTraffic.request(state_1.state.windowId, 'li-chapter', [
                            state_1.state.windowId, studyId, chapterId, clocks, comments, variations
                        ]);
                    }
                    else {
                        return promisetraffic_1.promiseTraffic.request(state_1.state.windowId, 'li-study', [
                            state_1.state.windowId, studyId, clocks, comments, variations
                        ]);
                    }
                }
            case 'id':
                const idList = d3.select('#li_import_ids').property('value').replaceAll(/\s/g, '');
                if (idList === '')
                    return Promise.reject('No ids given');
                return promisetraffic_1.promiseTraffic.request(state_1.state.windowId, 'li-games', [
                    state_1.state.windowId, idList,
                    !!d3.select('#li_import_ids_clocks').property('checked'),
                    !!d3.select('#li_import_ids_evals').property('checked'),
                    !!d3.select('#li_import_ids_openings').property('checked'),
                ]);
            case 'user':
                const username = d3.select('#li_import_user').property('value').trim();
                if (username === '')
                    return Promise.reject('Username cannot be empty');
                const sinceDate = d3.select('#li_import_user_since').property('value');
                const since = sinceDate === '' ? undefined : new Date(sinceDate).valueOf();
                const untilDate = d3.select('#li_import_user_until').property('value');
                const until = untilDate === '' ? undefined : new Date(untilDate).valueOf();
                const vsUser = d3.select('#li_import_opponent').property('value');
                const vs = vsUser === '' ? undefined : vsUser.trim().toLowerCase();
                const ratedGames = d3.select('#li_import_rated').property('checked');
                const casualGames = d3.select('#li_import_casual').property('checked');
                if (!ratedGames && !casualGames)
                    return Promise.reject('Neither casual nor rated games selected. No games to import.');
                const rated = (ratedGames && casualGames) ? null : ratedGames;
                const analysedGames = d3.select('#li_import_analysed').property('value');
                const nonAnalysedGames = d3.select('#li_import_nonanalysed').property('value');
                if (!analysedGames && !nonAnalysedGames)
                    return Promise.reject('Neither analysed nor non-analysed games selected. No games to import.');
                const analysed = (analysedGames && nonAnalysedGames) ? null : analysedGames;
                const perfs = [...d3.select('#li_import_perfType').node().selectedOptions].map(o => o.value);
                const colorWhite = d3.select('#li_imp_user input[name="color"][value="white"]').property('checked');
                const colorBlack = d3.select('#li_imp_user input[name="color"][value="black"]').property('checked');
                const color = colorWhite ? 'white' : (colorBlack ? 'black' : null);
                return promisetraffic_1.promiseTraffic.request(state_1.state.windowId, 'li-user-games', [
                    state_1.state.windowId, username, since, until, null, vs,
                    rated, perfs, color, analysed,
                    !!d3.select('#li_import_clocks').property('checked'),
                    !!d3.select('#li_import_evals').property('checked'),
                    !!d3.select('#li_import_opening').property('checked'),
                ]);
            case 'tournament':
                const id = d3.select('#li_tournament_id').property('value')
                    .replaceAll(/[\s,]/g, '');
                if (id === '')
                    return Promise.reject(new Error('Missing tournament id'));
                const type = d3.select('#li_imp_tournament input[name="tSystem"][value="swiss"]').property('checked') ? 'swiss' : 'tournament';
                return promisetraffic_1.promiseTraffic.request(state_1.state.windowId, 'li-tournament-games', [
                    state_1.state.windowId, id, type,
                    !!d3.select('#li_tournament_clocks').property('checked'),
                    !!d3.select('#li_tournament_evals').property('checked'),
                    !!d3.select('#li_tournament_opening').property('checked'),
                ]);
            default:
                return Promise.reject(new Error('No import form selected'));
        }
    })().then((async (r) => {
        console.log(r);
        if (r.response.error)
            throw r.response.error;
        const parsed = await promisetraffic_1.promiseTraffic.request(state_1.state.windowId, 'parse-pgn', [r.response]);
        mutations_1.loadPgn(state_1.state.pgn.concat(parsed.response));
        selection_1.selection.selectGame(state_1.state.pgn.length > 0 ? state_1.state.pgn[state_1.state.pgn.length - 1] : null);
    })).catch(((err) => {
        toasts_1.toasts.showNew('error', 'Import failed', err.message ? err.message : err.response.error.message, 'LiClient', 10000);
        console.error(err);
        modals_1.modals.open('lichess_import', false);
    })).finally(() => {
        modals_1.modals.close('progress');
    });
});
d3.select('#add_export_tag_condition').on('click', ev => {
    const form = d3.select('#export_conditions').insert('li', '.export-condition-add')
        .attr('class', 'list-group-item export-condition export-tag-condition').append('form');
    form.append('div').attr('class', 'row').append('div').attr('class', 'col')
        .append('h5').text('Tag filter #' + (d3.select('#export_conditions').selectChildren().size() - 1));
    const r1 = form.append('div').attr('class', 'row');
    const typeSelGroup = r1.append('div').attr('class', 'col').append('div').attr('class', 'form-group');
    typeSelGroup.append('label').text('Type:');
    const typeSel = typeSelGroup.append('select').attr('class', 'custom-select condition-type-select');
    typeSel.append('option').attr('value', 'exact-match').text('Exactly matches');
    typeSel.append('option').attr('value', 'contains').text('Contains');
    typeSel.append('option').attr('value', 'starts-with').text('Starts with');
    typeSel.append('option').attr('value', 'ends-with').text('Ends with');
    typeSel.append('option').attr('value', 'regex').text('Regular Expression (ECMA)');
    r1.append('div').attr('class', 'col').append('button')
        .attr('class', 'btn btn-danger').attr('type', 'button')
        .text('Remove').on('click', ev => {
        form.node().parentElement.remove();
    });
    const r2 = form.append('div').attr('class', 'row');
    const tagNameGroup = r2.append('div').attr('class', 'col').append('div').attr('class', 'form-group');
    tagNameGroup.append('label').text('Tag:');
    tagNameGroup.append('input').attr('class', 'form-control export-tag-name').attr('type', 'text');
    const tagValueGroup = r2.append('div').attr('class', 'col').append('div').attr('class', 'form-group');
    tagValueGroup.append('label').text('Value:');
    tagValueGroup.append('input').attr('class', 'form-control export-tag-value').attr('type', 'text');
});
d3.select('#add_export_movetext_condition').on('click', ev => {
    const form = d3.select('#export_conditions').insert('li', '.export-condition-add')
        .attr('class', 'list-group-item export-condition export-movetext-condition').append('form');
    form.append('div').attr('class', 'row').append('div').attr('class', 'col')
        .append('h5').text('Movetext filter #' + (d3.select('#export_conditions').selectChildren().size() - 1));
    const r1 = form.append('div').attr('class', 'row');
    const typeSelGroup = r1.append('div').attr('class', 'col').append('div').attr('class', 'form-group');
    typeSelGroup.append('label').text('Type:');
    const typeSel = typeSelGroup.append('select').attr('class', 'custom-select condition-type-select');
    typeSel.append('option').attr('value', 'exact-match').text('Exactly matches');
    typeSel.append('option').attr('value', 'contains').text('Contains');
    typeSel.append('option').attr('value', 'starts-with').text('Starts with');
    typeSel.append('option').attr('value', 'ends-with').text('Ends with');
    typeSel.append('option').attr('value', 'regex').text('Regular Expression (ECMA)');
    r1.append('div').attr('class', 'col').append('button')
        .attr('class', 'btn btn-danger').attr('type', 'button')
        .text('Remove').on('click', ev => {
        form.node().parentElement.remove();
    });
    const r2 = form.append('div').attr('class', 'row');
    const tagNameGroup = r2.append('div').attr('class', 'col').append('div').attr('class', 'form-group');
    tagNameGroup.append('label').text('PGN movetext:');
    tagNameGroup.append('input').attr('class', 'form-control export-movetext').attr('type', 'text');
});
d3.select('#condition_export_confirm').on('click', ev => {
    let filteredPGN = state_1.state.pgn.slice(0);
    d3.select('#export_conditions').selectAll('.export-tag-condition').each((d, i, arr) => {
        const li = arr[i];
        const type = li.getElementsByClassName('condition-type-select')[0].value;
        const tagName = li.getElementsByClassName('export-tag-name')[0].value;
        const tagValue = li.getElementsByClassName('export-tag-value')[0].value;
        filteredPGN = filteredPGN.filter(game => {
            if (!game.headers.some(h => h.name === tagName))
                return false;
            const h = game.headers.find(h => h.name === tagName);
            switch (type) {
                case 'exact-match':
                    return h.value === tagValue;
                case 'contains':
                    return h.value.includes(tagValue);
                case 'starts-with':
                    return h.value.startsWith(tagValue);
                case 'ends-with':
                    return h.value.startsWith(tagValue);
                case 'regex':
                    try {
                        const regExp = new RegExp(tagValue);
                        return regExp.test(h.value);
                    }
                    catch (error) {
                        console.error(error);
                        return false;
                    }
                default:
                    return true;
            }
        });
    });
    d3.select('#export_conditions').selectAll('.export-movetext-condition').each((d, i, arr) => {
        const li = arr[i];
        const type = li.getElementsByClassName('condition-type-select')[0].value;
        const pgnText = li.getElementsByClassName('export-movetext')[0].value;
        filteredPGN = filteredPGN.filter(game => {
            const movetext = pgn_1.stringifyGame(game, false, true);
            switch (type) {
                case 'exact-match':
                    return movetext === pgnText;
                case 'contains':
                    return movetext.includes(pgnText);
                case 'starts-with':
                    return movetext.startsWith(pgnText);
                case 'ends-with':
                    return movetext.startsWith(pgnText);
                case 'regex':
                    try {
                        const regExp = new RegExp(pgnText);
                        return regExp.test(movetext);
                    }
                    catch (error) {
                        console.error(error);
                        return false;
                    }
                default:
                    return true;
            }
        });
    });
    const pgn = pgn_1.stringifyPGN(filteredPGN);
    electron_1.ipcRenderer.send('save-pgn', pgn, null, state_1.state.windowId, filteredPGN.length);
    modals_1.modals.close('condition_export');
});
//#region ipc listeners
electron_1.ipcRenderer.on('window-id', (ev, id) => {
    state_1.state.windowId = id;
    console.log(`Window id: ${state_1.state.windowId}`);
});
electron_1.ipcRenderer.on('progress', (ev, prog, ctx) => {
    if (ctx.startsWith(state_1.state.windowId)) {
        modals_1.modals.setProgress(prog, ctx);
    }
});
electron_1.ipcRenderer.on('annotation', (ev, nag) => {
    if (state_1.state.selected.move === null)
        return;
    if (state_1.state.selected.move.nags === undefined)
        state_1.state.selected.move.nags = [];
    if (state_1.state.selected.move.nags.includes(nag)) {
        state_1.state.selected.move.nags.splice(state_1.state.selected.move.nags.indexOf(nag), 1);
    }
    else {
        state_1.state.selected.move.nags.push(nag);
    }
    annotation_1.nags.show(state_1.state.selected.move);
    const moveEl = movelist_1.movelist.getMoveElement(state_1.state.selected.move);
    if (moveEl !== null)
        moveEl.innerText = movelist_1.Movelist.getMovetext(state_1.state.selected.move);
});
electron_1.ipcRenderer.on('cut-move', (ev) => {
    if (state_1.state.selected.move === null)
        return;
    mutations_1.deleteMove(state_1.state.selected.move);
});
electron_1.ipcRenderer.on('move-variation', (ev, step) => {
    if (state_1.state.selected.move === null || state_1.state.selected.game === null)
        return;
    const variation = utils_1.variationOf(state_1.state.selected.move);
    mutations_1.moveVariation(variation, step);
});
electron_1.ipcRenderer.on('cut-variation', (ev) => {
    if (state_1.state.selected.move === null || state_1.state.selected.game === null)
        return;
    const variation = utils_1.variationOf(state_1.state.selected.move);
    mutations_1.deleteVariation(variation);
});
electron_1.ipcRenderer.on('cut-game', (ev) => {
    if (state_1.state.selected.game === null)
        return;
    mutations_1.deleteGame(state_1.state.selected.game);
});
electron_1.ipcRenderer.on('copy', (ev, descriptor) => {
    switch (descriptor) {
        case 'move':
            if (state_1.state.selected.move !== null)
                electron_1.clipboard.writeText(movelist_1.Movelist.getMovetext(state_1.state.selected.move));
            else
                electron_1.clipboard.writeText('');
            break;
        case 'rav':
        case 'variation':
            if (state_1.state.selected.move === null || state_1.state.selected.game === null) {
                electron_1.clipboard.writeText('');
            }
            else {
                const v = utils_1.selectedVariation();
                let vText = v.moves.map(m => pgn_1.stringifyMove(Object.assign(Object.assign({}, m), descriptor === 'variation' ? { ravs: undefined, comments: undefined } : {}))).join(' ');
                if (v.moves.length > 0)
                    vText += ' ';
                if (v.moves[v.moves.length - 1] === state_1.state.selected.game.moves[state_1.state.selected.game.moves.length - 1])
                    vText += state_1.state.selected.game.result;
                else
                    vText += '*';
                electron_1.clipboard.writeText(vText);
            }
            break;
        case 'tags':
        case 'movetext':
        case 'game':
            if (state_1.state.selected.game === null) {
                electron_1.clipboard.writeText('');
            }
            else {
                const pgnText = pgn_1.stringifyGame(state_1.state.selected.game, descriptor !== 'movetext', descriptor !== 'tags');
                electron_1.clipboard.writeText(pgnText);
            }
            break;
        case 'roster':
            const roster = ['Event', 'Site', 'Date', 'Round', 'White', 'Black', 'Result'];
            const minPgnText = state_1.state.pgn.map(g => {
                return g.headers.slice(0).filter(t => roster.includes(t.name)).sort((a, b) => {
                    const aI = roster.indexOf(a.name), bI = roster.indexOf(b.name);
                    return aI - bI;
                }).map(h => pgn_1.stringifyHeader(h)).join('\r\n') + '\r\n\r\n' + g.result;
            }).join('\r\n\r\n');
            electron_1.clipboard.writeText(minPgnText);
            break;
        case 'pgn':
            const pgnText = pgn_1.stringifyPGN(state_1.state.pgn);
            electron_1.clipboard.writeText(pgnText);
            break;
        case 'fen':
            const fen = fen_1.makeFen(state_1.state.chess.toSetup());
            electron_1.clipboard.writeText(fen);
            break;
        case 'epd':
            let epd = fen_1.makeFen(state_1.state.chess.toSetup(), { epd: true });
            epd += ` hmvc ${state_1.state.chess.halfmoves}; fmvn ${state_1.state.chess.fullmoves};`;
            if (state_1.state.selected.move !== null && state_1.state.selected.move.comments !== undefined) {
                for (let i = 0; i < state_1.state.selected.move.comments.length; i++) {
                    const comment = state_1.state.selected.move.comments[i];
                    epd += ` c${i} ${comment.text};`;
                }
            }
            electron_1.clipboard.writeText(epd);
            break;
        default:
            break;
    }
});
electron_1.ipcRenderer.on('paste', (ev, descriptor) => {
    switch (descriptor) {
        case 'nag':
            if (state_1.state.selected.move === null)
                return;
            let nag = electron_1.clipboard.readText();
            if (!nag.startsWith('$')) {
                for (const nag1 in annotation_1.nagTable) {
                    if (Object.prototype.hasOwnProperty.call(annotation_1.nagTable, nag1)) {
                        const nagSymbol = annotation_1.nagTable[nag1];
                        if (nag === nagSymbol) {
                            nag = nag1;
                            break;
                        }
                    }
                }
            }
            if (!nag.startsWith('$') || /[^\d]/.test(nag.slice(1))) {
                toasts_1.toasts.showNew('error', 'Could not paste annotation', `"${nag}" is not a valid annotation`, 'paste', 4000);
                return;
            }
            if (state_1.state.selected.move.nags === undefined)
                state_1.state.selected.move.nags = [];
            if (!state_1.state.selected.move.nags.includes(nag))
                state_1.state.selected.move.nags.push(nag);
            annotation_1.nags.show(state_1.state.selected.move);
            const moveEl = movelist_1.movelist.getMoveElement(state_1.state.selected.move);
            if (moveEl !== null)
                moveEl.innerText = movelist_1.Movelist.getMovetext(state_1.state.selected.move);
            break;
        case 'epd':
            const epd = electron_1.clipboard.readText();
            let fenPart = epd.split(' ').slice(0, 4).join(' ');
            const commands = epd.substring(fenPart.length).split(';').map(c => c.substring(0, c.length - 1).trim());
            if (commands.findIndex(c => c.startsWith('hmvc ')) >= 0) {
                const hmvc = Number(commands.find(c => c.startsWith('hmvc ')).split(' ')[1]);
                if (!isNaN(hmvc))
                    fenPart += ' ' + hmvc;
                else
                    fenPart += ' 0';
            }
            else {
                fenPart += ' 0';
            }
            if (commands.findIndex(c => c.startsWith('fmvn ')) >= 0) {
                const fmvn = Number(commands.find(c => c.startsWith('fmvn ')).split(' ')[1]);
                if (!isNaN(fmvn))
                    fenPart += ' ' + fmvn;
                else
                    fenPart += ' 1';
            }
            else {
                fenPart += ' 1';
            }
            const epdSetup = fen_1.parseFen(fenPart);
            if (epdSetup.isErr) {
                toasts_1.toasts.showNew('error', 'Failed to create game from EPD', epdSetup.error.message, 'paste', 8000);
                console.error(`Failed to create game from ${epd}: ${epdSetup.error}`);
                return;
            }
            mutations_1.appendGame('new');
            tags_1.tags.set('FEN', fenPart);
            break;
        case 'fen':
            const fen = electron_1.clipboard.readText();
            const setup = fen_1.parseFen(fen);
            if (setup.isErr) {
                toasts_1.toasts.showNew('error', 'Failed to create game from FEN', setup.error.message, 'paste', 8000);
                console.error(`Failed to create game from ${fen}: ${setup.error}`);
                return;
            }
            mutations_1.appendGame('new');
            tags_1.tags.set('FEN', fen);
            break;
        case 'pgn':
            const pgn = electron_1.clipboard.readText();
            promisetraffic_1.promiseTraffic.request(state_1.state.windowId, 'parse-pgn', [pgn])
                .then(r => {
                const parsedPgn = r.response;
                //TODO interpret as pgn file: try matching every game as an rav based on the move number at the start of each game's movetext. disregard games that don't fit (aren't legal as ravs)
            }).catch((r) => {
                toasts_1.toasts.showNew('error', 'Could not insert pgn', r.response.error.message, 'paste', 8000);
                console.error(r.response.error);
            });
            break;
        default:
            break;
    }
});
electron_1.ipcRenderer.on('load-pgn', (ev, parsedPgn, append) => {
    if (append === 'after')
        parsedPgn = state_1.state.pgn.concat(parsedPgn);
    else if (append === 'before')
        parsedPgn = parsedPgn.concat(state_1.state.pgn);
    mutations_1.loadPgn(parsedPgn);
});
electron_1.ipcRenderer.on('fetch-pgn', (ev, info) => {
    if (info?.back === 'save-pgn') {
        const pgnString = pgn_1.stringifyPGN(state_1.state.pgn);
        ev.sender.send('save-pgn', pgnString, ...info.args);
    }
});
electron_1.ipcRenderer.on('import-web-games', (ev, source) => {
    if (source === 'lichess')
        modals_1.modals.open('lichess_import');
});
electron_1.ipcRenderer.on('export-condition', (ev) => {
    modals_1.modals.open('condition_export');
});
const setUserPreference = (name, value) => {
    console.log(`Setting ${name} to "${value}"`);
    state_1.state.prefs[name] = value;
    switch (name) {
        case 'btrapTheme':
            document.getElementById('theme_sheet').href = value;
            setTimeout(() => {
                state_1.state.chessground.redrawAll();
            }, 50);
            break;
        case 'board':
            document.getElementById('board_sheet').href = value;
            break;
        case 'pieceset':
            document.getElementById('piece_sheet').href = value;
            break;
        case 'rookCastle':
            state_1.state.chessground.set({ movable: { rookCastle: value } });
            state_1.state.chessground.redrawAll();
            break;
        case 'snapArrowsToValidMove':
            state_1.state.chessground.set({ drawable: { defaultSnapToValidMove: value } });
            state_1.state.chessground.redrawAll();
            break;
        case 'eraseArrowsOnClick':
            state_1.state.chessground.set({ drawable: { eraseOnClick: value } });
            state_1.state.chessground.redrawAll();
            break;
        case 'showDests':
            state_1.state.chessground.set({ movable: { showDests: value } });
            state_1.state.chessground.redrawAll();
            break;
        case 'coordinates':
            state_1.state.chessground.set({ coordinates: value });
            state_1.state.chessground.redrawAll();
            break;
        case 'orientation':
            state_1.state.chessground.set({ orientation: value });
            state_1.state.chessground.redrawAll();
            break;
        case 'ghost':
            state_1.state.chessground.set({ draggable: { showGhost: value } });
            state_1.state.chessground.redrawAll();
            break;
        case 'animation':
            state_1.state.chessground.set({ animation: { enabled: value } });
            state_1.state.chessground.redrawAll();
            break;
        case 'highlightLastMove':
            state_1.state.chessground.set({ highlight: { lastMove: value } });
            state_1.state.chessground.redrawAll();
            break;
        case 'highlightCheck':
            state_1.state.chessground.set({ highlight: { check: value } });
            state_1.state.chessground.redrawAll();
            break;
        default:
            break;
    }
};
electron_1.ipcRenderer.on('set-pref', (ev, key, value) => {
    setUserPreference(key, value);
});
electron_1.ipcRenderer.on('load-prefs', (ev, prefs) => {
    for (const key in prefs) {
        if (Object.prototype.hasOwnProperty.call(prefs, key)) {
            const prefValue = prefs[key];
            setUserPreference(key, prefValue);
        }
    }
});
//TODO add undo/redo for: 1. adding a move 2. deleting a move 3. deleting a variation 4. moving a variation up or down. Keyboard shortcuts should only work if focus is on board or movelist. Histories are local to a game, i.e. undo/redo only works for moves & variations of the current selected game (but actions are saved so re-selecting another game will make undoing previous actions on that game possible)
//#endregion
mutations_1.loadPgn(state_1.state.pgn);
engines_1.liEngine.onPositionChange();
