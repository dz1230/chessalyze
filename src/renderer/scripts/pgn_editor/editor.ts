import {  Role } from "chessground/types"
import { parseFen, makeFen, INITIAL_FEN } from "chessops/fen"
import { chessgroundDests } from "chessops/compat"
import { parseUci, parseSquare, squareRank, squareFile } from "chessops/util"
import { makeSan } from "chessops/san"

import { clipboard, ipcRenderer } from "electron"

import d3 = require('d3')

import { stringifyPGN, stringifyGame, stringifyMove, stringifyHeader } from "../../../common/pgn"

import { CustomResponse, promiseTraffic } from "../../scripts/promisetraffic"
import { state } from "../../scripts/pgn_editor/state"
import { variationOf, indexOfVariation, moveAt, selectedVariation } from "../../scripts/pgn_editor/utils"
import { modals } from "../../scripts/pgn_editor/modals"
import { nags, nagTable } from "../../scripts/pgn_editor/annotation"
import { liEngine, uciengine } from "../../scripts/pgn_editor/engines"
import { tags } from "../../scripts/pgn_editor/tags"
import { appendGame, appendMove, deleteGame, deleteMove, deleteVariation, loadPgn, moveVariation } from "../../scripts/pgn_editor/mutations"
import { movelist } from "../../scripts/pgn_editor/movelist"
import { gamelist } from "../../scripts/pgn_editor/gamelist"
import { selection } from "../../scripts/pgn_editor/selection"
import { toasts } from "../../scripts/pgn_editor/toasts"

const promotionData = {
    orig: <string>null,
    dest: <string>null,
    side: <'white' | 'black'>null,
    open() {
        d3.selectAll('#promotion_popup piece').classed('white', false).classed('black', false).classed(promotionData.side, true)
        if ((promotionData.side === 'white' && state.chessground.state.orientation === 'white') ||
        (promotionData.side === 'black' && state.chessground.state.orientation === 'black')) {
            d3.select('#promotion_popup square[data-role="queen"]').style('top', '0%')
            d3.select('#promotion_popup square[data-role="rook"]').style('top', '12.5%')
            d3.select('#promotion_popup square[data-role="bishop"]').style('top', '25%')
            d3.select('#promotion_popup square[data-role="knight"]').style('top', '37.5%')
        } else {
            d3.select('#promotion_popup square[data-role="queen"]').style('top', '87.5%')
            d3.select('#promotion_popup square[data-role="rook"]').style('top', '75%')
            d3.select('#promotion_popup square[data-role="bishop"]').style('top', '62.5%')
            d3.select('#promotion_popup square[data-role="knight"]').style('top', '50%')
        }
        d3.selectAll('#promotion_popup square').style('left', (squareFile(parseSquare(promotionData.dest)) * 12.5) + '%')
        d3.select('#promotion_popup').style('display', null)
    },
    confirm(role: Role) {
        const promLetter = {
            'queen': 'q',
            'rook': 'r',
            'bishop': 'b',
            'knight': 'n'
        }[role]
        const coMove = parseUci(promotionData.orig + promotionData.dest + promLetter)
        if (coMove && state.chess.isLegal(coMove)) appendMove({move: makeSan(state.chess, coMove)})
        else d3.select('#promotion_popup').style('display', 'none')
    }
}
d3.selectAll('#promotion_popup square').on('click', ev => {
    const role = ev.target.parentElement.getAttribute('data-role')
    if (['queen','rook','bishop','knight'].includes(role)) promotionData.confirm(role)
})

state.chessground.set({
    fen: INITIAL_FEN,
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
        dests: chessgroundDests(state.chess, {chess960: false}),
        events: {
            after(orig, dest, metadata) {
                promotionData.dest = dest
                promotionData.orig = orig
                promotionData.side = null
                const move = parseUci(orig+dest)
                let promotion = 'none'
                if (state.chess.board.get(parseSquare(orig)).role === 'pawn') {
                    const destNr = parseSquare(dest)
                    if (state.chess.turn === 'white') {
                        if (squareRank(destNr) === squareRank(parseSquare('a8'))) {
                            promotion = 'white'
                        }
                    } else {
                        if (squareRank(destNr) === squareRank(parseSquare('a1'))) {
                            promotion = 'black'
                        }
                    }
                }
                if (promotion === 'none') {
                    appendMove({move: makeSan(state.chess, move)})
                } else if (promotion === 'white') {
                    promotionData.side = 'white'
                    promotionData.open()
                } else if (promotion === 'black') {
                    promotionData.side = 'black'
                    promotionData.open()
                }
            }
        }
    },
    resizable: true,
    events: {
        change: () => {
            uciengine.onPositionChange()
        }
    }
})

document.body.firstChild.dispatchEvent(new Event('chessground.resize'))
window.addEventListener('resize', ev => {
    document.body.dispatchEvent(new Event('chessground.resize'))
})
document.body.firstChild.addEventListener('scroll', ev => {
    document.body.dispatchEvent(new Event('chessground.resize'))
})

tags.addListener('Result', (prev, value) => {
    if (state.selected.game !== null) state.selected.game.result = <any>value
    d3.selectAll('.result').text(value)
    return value
})

tags.addListener('White', (prev, value) => {
    const displayName = (value === '' || value === '?' || value === null) ? 'Anonymous' : value
    if (state.chessground.state.orientation === 'white') d3.select('#player_bottom').text(displayName)
    else d3.select('#player_top').text(displayName)
    d3.select('.game.current').text(gamelist.gamename(state.selected.game, displayName))
    return value
})
tags.addListener('Black', (prev, value) => {
    const displayName = (value === '' || value === '?' || value === null) ? 'Anonymous' : value
    if (state.chessground.state.orientation === 'black') d3.select('#player_bottom').text(displayName)
    else d3.select('#player_top').text(displayName)
    d3.select('.game.current').text(gamelist.gamename(state.selected.game, '', displayName))
    return value
})
tags.addListener('WhiteElo', (prev, value) => {
    const displayElo = (value === null || value === '') ? '-' : value
    if (state.chessground.state.orientation === 'white') d3.select('#elo_bottom').text(displayElo)
    else d3.select('#elo_top').text(displayElo)
    return value
})
tags.addListener('BlackElo', (prev, value) => {
    const displayElo = (value === null || value === '') ? '-' : value
    if (state.chessground.state.orientation === 'black') d3.select('#elo_bottom').text(displayElo)
    else d3.select('#elo_top').text(displayElo)
    return value
})
tags.addListener('WhiteTitle', (prev, value) => {
    if (state.chessground.state.orientation === 'white') {
        d3.select('#title_bottom').text(value)
    } else {
        d3.select('#title_top').text(value)
    }
    return value
})
tags.addListener('BlackTitle', (prev, value) => {
    if (state.chessground.state.orientation === 'black') {
        d3.select('#title_bottom').text(value)
    } else {
        d3.select('#title_top').text(value)
    }
    return value
})
d3.selectAll('.action.adjudication').on('click', ev => {
    tags.set('Result', ev.target.getAttribute('data-result'))
    tags.set('Termination', 'adjudication')
})

tags.addListener('FEN', (prev, value) => {
    if (value !== null && parseFen(value).isErr) value = INITIAL_FEN
    if (value !== null) tags.set('SetUp', value === INITIAL_FEN ? '0' : '1')
    else tags.set('SetUp', null)
    return value
})
tags.addListener('FEN', (prev, value) => {
    if (prev !== value) {
        let fen = value === null ? INITIAL_FEN : value
        if (state.selected.game !== null) {
            if (!state.selected.game.headers.some(h => h.name === 'FEN')) state.selected.game.headers.push({name: 'FEN', value: fen})
            else state.selected.game.headers.find(h => h.name === 'FEN').value = fen
            state.selected.game.moves.splice(0)
            movelist.show(state.selected.game)
            selection.selectMove(null, true)
        }
    }
    return value
})

for (const tag of tags.list.selectChildren()) {
    if (tags.roster.includes((<any>tag).getAttribute('data-tag'))) {
        (<any>tag).addEventListener('change', tags.changeListener)
    }
}

d3.select('#board').on('wheel', ev => {
    if (ev.deltaY > 1) {
        if (state.selected.next === null) return
        selection.selectMove(state.selected.next)
    } else if (ev.deltaY < -1) {
        if (state.selected.move === null) return
        const variation = variationOf(state.selected.move)
        const j = variation.moves.indexOf(state.selected.move)
        if (j === 0) {
            let index = indexOfVariation(variation)
            index.pop()
            while (index.length > 0 && index[index.length-1] === 0) {
                index.pop()
                index.pop()
            }
            if (index.length > 0) {
                index[index.length-1] -= 1
                selection.selectMove(moveAt(index))
            } else {
                selection.selectMove(null)
            }
        } else {
            selection.selectMove(variation.moves[j-1])
        }
    }
})

d3.select('#lichess_import_confirm').on('click', ev => {
    const m = d3.select('#lichess_import')
    const importType = 
    m.select('.nav-link[href="#li_import_by_study"]').classed('active') ? 'study' : (
    m.select('.nav-link[href="#li_import_by_id"]').classed('active') ? 'id' : (
    m.select('.nav-link[href="#li_import_by_user"]').classed('active') ? 'user' : (
    m.select('.nav-link[href="#li_import_by_tournament"]').classed('active') ? 'tournament' : 'none'
    )))
    d3.select('#progress_title').text('Importing games...')
    modals.open('progress')
    modals.close('lichess_import')
    ;(() => {
        switch (importType) {
            case 'study':
                const clocks = !!d3.select('#li_study_clocks').property('value')
                const comments = !!d3.select('#li_study_comments').property('value')
                const variations = !!d3.select('#li_study_variations').property('value')
                if (d3.select('#li_study_by_user').property('checked')) {
                    const username = d3.select('#li_study_user').property('value').trim().toLowerCase()
                    if (username === '') return Promise.reject('Missing username')
                    return promiseTraffic.request(state.windowId, 'li-studies-user', [
                        state.windowId, username, clocks, comments, variations
                    ])
                } else {
                    const studyId = d3.select('#study_id').property('value').trim()
                    if (studyId === '') return Promise.reject('Missing study id')
                    const chapterId = d3.select('#li_study_chapter').property('value').trim()
                    if (chapterId !== '') {
                        return promiseTraffic.request(state.windowId, 'li-chapter', [
                            state.windowId, studyId, chapterId, clocks, comments, variations
                        ])
                    } else {
                        return promiseTraffic.request(state.windowId, 'li-study', [
                            state.windowId, studyId, clocks, comments, variations
                        ])
                    }
                }
            case 'id':
                const idList = d3.select('#li_import_ids').property('value').replaceAll(/\s/g, '')
                if (idList === '') return Promise.reject('No ids given')
                return promiseTraffic.request(state.windowId, 'li-games', [
                    state.windowId, idList,
                    !!d3.select('#li_import_ids_clocks').property('checked'),
                    !!d3.select('#li_import_ids_evals').property('checked'),
                    !!d3.select('#li_import_ids_openings').property('checked'),
                ])
            case 'user':
                const username = d3.select('#li_import_user').property('value').trim()
                if (username === '') return Promise.reject('Username cannot be empty')
                const sinceDate: string = d3.select('#li_import_user_since').property('value')
                const since = sinceDate === '' ? undefined : new Date(sinceDate).valueOf()
                const untilDate: string = d3.select('#li_import_user_until').property('value')
                const until = untilDate === '' ? undefined : new Date(untilDate).valueOf()
                const vsUser: string = d3.select('#li_import_opponent').property('value')
                const vs = vsUser === '' ? undefined : vsUser.trim().toLowerCase()
                const ratedGames = d3.select('#li_import_rated').property('checked') 
                const casualGames = d3.select('#li_import_casual').property('checked') 
                if (!ratedGames && !casualGames) return Promise.reject('Neither casual nor rated games selected. No games to import.')
                const rated = (ratedGames && casualGames) ? null : ratedGames
                const analysedGames = d3.select('#li_import_analysed').property('value')
                const nonAnalysedGames = d3.select('#li_import_nonanalysed').property('value')
                if (!analysedGames && !nonAnalysedGames) return Promise.reject('Neither analysed nor non-analysed games selected. No games to import.')
                const analysed = (analysedGames && nonAnalysedGames) ? null : analysedGames
                const perfs = [...(<HTMLSelectElement>d3.select('#li_import_perfType').node()).selectedOptions].map(o => o.value)
                const colorWhite = d3.select('#li_imp_user input[name="color"][value="white"]').property('checked')
                const colorBlack = d3.select('#li_imp_user input[name="color"][value="black"]').property('checked')
                const color = colorWhite ? 'white' : (colorBlack ? 'black': null)
                return promiseTraffic.request(state.windowId, 'li-user-games', [
                    state.windowId, username, since, until, null, vs, 
                    rated, perfs, color, analysed, 
                    !!d3.select('#li_import_clocks').property('checked'),
                    !!d3.select('#li_import_evals').property('checked'),
                    !!d3.select('#li_import_opening').property('checked'),
                ])
            case 'tournament':
                const id: string = d3.select('#li_tournament_id').property('value')
                .replaceAll(/[\s,]/g, '')
                if (id === '') return Promise.reject(new Error('Missing tournament id'))
                const type = d3.select('#li_imp_tournament input[name="tSystem"][value="swiss"]').property('checked') ? 'swiss' : 'tournament'
                return promiseTraffic.request(state.windowId, 'li-tournament-games', [
                    state.windowId, id, type,
                    !!d3.select('#li_tournament_clocks').property('checked'),
                    !!d3.select('#li_tournament_evals').property('checked'),
                    !!d3.select('#li_tournament_opening').property('checked'),
                ])
            default:
                return Promise.reject(new Error('No import form selected'))
        }
    })().then((async r => {
        console.log(r)
        if (r.response.error) throw r.response.error
        const parsed = await promiseTraffic.request(state.windowId, 'parse-pgn', [r.response])
        loadPgn(state.pgn.concat(parsed.response))
        selection.selectGame(state.pgn.length > 0 ? state.pgn[state.pgn.length-1] : null)
    })).catch(((err: Error | CustomResponse) => {
        toasts.showNew('error', 'Import failed', (<Error>err).message ? (<Error>err).message : (<CustomResponse>err).response.error.message, 'LiClient', 10000)
        console.error(err)
        modals.open('lichess_import', false)
    })).finally(() => {
        modals.close('progress')
    })
})

d3.select('#add_export_tag_condition').on('click', ev => {
    const form = d3.select('#export_conditions').insert('li', '.export-condition-add')
    .attr('class', 'list-group-item export-condition export-tag-condition').append('form')

    form.append('div').attr('class', 'row').append('div').attr('class', 'col')
    .append('h5').text('Tag filter #' + (d3.select('#export_conditions').selectChildren().size()-1))

    const r1 = form.append('div').attr('class', 'row')
    const typeSelGroup = r1.append('div').attr('class', 'col').append('div').attr('class', 'form-group')
    typeSelGroup.append('label').text('Type:')
    const typeSel = typeSelGroup.append('select').attr('class', 'custom-select condition-type-select')
    typeSel.append('option').attr('value', 'exact-match').text('Exactly matches')
    typeSel.append('option').attr('value', 'contains').text('Contains')
    typeSel.append('option').attr('value', 'starts-with').text('Starts with')
    typeSel.append('option').attr('value', 'ends-with').text('Ends with')
    typeSel.append('option').attr('value', 'regex').text('Regular Expression (ECMA)')
    r1.append('div').attr('class', 'col').append('button')
    .attr('class', 'btn btn-danger').attr('type', 'button')
    .text('Remove').on('click', ev => {
        form.node().parentElement.remove()
    })

    const r2 = form.append('div').attr('class', 'row')
    const tagNameGroup = r2.append('div').attr('class', 'col').append('div').attr('class', 'form-group')
    tagNameGroup.append('label').text('Tag:')
    tagNameGroup.append('input').attr('class', 'form-control export-tag-name').attr('type', 'text')
    const tagValueGroup = r2.append('div').attr('class', 'col').append('div').attr('class', 'form-group')
    tagValueGroup.append('label').text('Value:')
    tagValueGroup.append('input').attr('class', 'form-control export-tag-value').attr('type', 'text')
})
d3.select('#add_export_movetext_condition').on('click', ev => {
    const form = d3.select('#export_conditions').insert('li', '.export-condition-add')
    .attr('class', 'list-group-item export-condition export-movetext-condition').append('form')
    
    form.append('div').attr('class', 'row').append('div').attr('class', 'col')
    .append('h5').text('Movetext filter #' + (d3.select('#export_conditions').selectChildren().size()-1))
    
    const r1 = form.append('div').attr('class', 'row')
    const typeSelGroup = r1.append('div').attr('class', 'col').append('div').attr('class', 'form-group')
    typeSelGroup.append('label').text('Type:')
    const typeSel = typeSelGroup.append('select').attr('class', 'custom-select condition-type-select')
    typeSel.append('option').attr('value', 'exact-match').text('Exactly matches')
    typeSel.append('option').attr('value', 'contains').text('Contains')
    typeSel.append('option').attr('value', 'starts-with').text('Starts with')
    typeSel.append('option').attr('value', 'ends-with').text('Ends with')
    typeSel.append('option').attr('value', 'regex').text('Regular Expression (ECMA)')
    r1.append('div').attr('class', 'col').append('button')
    .attr('class', 'btn btn-danger').attr('type', 'button')
    .text('Remove').on('click', ev => {
        form.node().parentElement.remove()
    })
    
    const r2 = form.append('div').attr('class', 'row')
    const tagNameGroup = r2.append('div').attr('class', 'col').append('div').attr('class', 'form-group')
    tagNameGroup.append('label').text('PGN movetext:')
    tagNameGroup.append('input').attr('class', 'form-control export-movetext').attr('type', 'text')
})
d3.select('#condition_export_confirm').on('click', ev => {
    let filteredPGN = state.pgn.slice(0)
    d3.select('#export_conditions').selectAll('.export-tag-condition').each((d, i, arr) => {
        const li = <HTMLLIElement>arr[i]
        const type = (<HTMLSelectElement>li.getElementsByClassName('condition-type-select')[0]).value
        const tagName = (<HTMLInputElement>li.getElementsByClassName('export-tag-name')[0]).value
        const tagValue = (<HTMLInputElement>li.getElementsByClassName('export-tag-value')[0]).value
        filteredPGN = filteredPGN.filter(game => {
            if (!game.headers.some(h => h.name === tagName)) return false
            const h = game.headers.find(h => h.name === tagName)
            switch (type) {
                case 'exact-match':
                    return h.value === tagValue
                case 'contains':
                    return h.value.includes(tagValue)
                case 'starts-with':
                    return h.value.startsWith(tagValue)
                case 'ends-with':
                    return h.value.startsWith(tagValue)
                case 'regex':
                    try {
                        const regExp = new RegExp(tagValue)
                        return regExp.test(h.value)
                    } catch (error) {
                        console.error(error)
                        return false
                    }
                default:
                    return true
            }
        })
    })
    d3.select('#export_conditions').selectAll('.export-movetext-condition').each((d, i, arr) => {
        const li = <HTMLLIElement>arr[i]
        const type = (<HTMLSelectElement>li.getElementsByClassName('condition-type-select')[0]).value
        const pgnText = (<HTMLInputElement>li.getElementsByClassName('export-movetext')[0]).value
        filteredPGN = filteredPGN.filter(game => {
            const movetext = stringifyGame(game, false, true)
            switch (type) {
                case 'exact-match':
                    return movetext === pgnText
                case 'contains':
                    return movetext.includes(pgnText)
                case 'starts-with':
                    return movetext.startsWith(pgnText)
                case 'ends-with':
                    return movetext.startsWith(pgnText)
                case 'regex':
                    try {
                        const regExp = new RegExp(pgnText)
                        return regExp.test(movetext)
                    } catch (error) {
                        console.error(error)
                        return false
                    }
                default:
                    return true
            }
        })
    })
    const pgn = stringifyPGN(filteredPGN)
    ipcRenderer.send('save-pgn', pgn, null, state.windowId, filteredPGN.length)
    modals.close('condition_export')
})

//#region ipc listeners
ipcRenderer.on('window-id', (ev, id) => {
    state.windowId = id
    console.log(`Window id: ${state.windowId}`)
})
ipcRenderer.on('progress', (ev, prog, ctx) => {
    if (ctx.startsWith(state.windowId)) {
        modals.setProgress(prog, ctx)
    }
})
ipcRenderer.on('annotation', (ev, nag) => {
    if (state.selected.move === null) return
    if (state.selected.move.nags === undefined) state.selected.move.nags = []
    if (state.selected.move.nags.includes(nag)) {
        state.selected.move.nags.splice(state.selected.move.nags.indexOf(nag), 1)
    } else {
        state.selected.move.nags.push(nag)
    }
    nags.show(state.selected.move)
    const moveEl = movelist.findMoveElement(state.selected.move)
    if (moveEl !== null) moveEl.innerText = movelist.getMovetext(state.selected.move)
})
ipcRenderer.on('cut-move', (ev) => {
    if (state.selected.move === null) return
    deleteMove(state.selected.move)
})
ipcRenderer.on('move-variation', (ev, step: number) => {
    if (state.selected.move === null || state.selected.game === null) return
    const variation = variationOf(state.selected.move)
    moveVariation(variation, step)
})
ipcRenderer.on('cut-variation', (ev) => {
    if (state.selected.move === null || state.selected.game === null) return
    const variation = variationOf(state.selected.move)
    deleteVariation(variation)
})
ipcRenderer.on('cut-game', (ev) => {
    if (state.selected.game === null) return
    deleteGame(state.selected.game)
})
ipcRenderer.on('copy', (ev, descriptor) => {
    switch (descriptor) {
        case 'move':
            if (state.selected.move !== null) clipboard.writeText(movelist.getMovetext(state.selected.move))
            else clipboard.writeText('')
            break
        case 'rav':
        case 'variation':
            if (state.selected.move === null || state.selected.game === null) {
                clipboard.writeText('')
            } else {
                const v = selectedVariation()
                let vText = v.moves.map(m => stringifyMove(Object.assign(Object.assign({}, m), descriptor === 'variation' ? {ravs: undefined, comments: undefined} : {}))).join(' ')
                if (v.moves.length > 0) vText += ' '
                if (v.moves[v.moves.length-1] === state.selected.game.moves[state.selected.game.moves.length-1]) vText += state.selected.game.result
                else vText += '*'
                clipboard.writeText(vText)
            }
            break
        case 'tags':
        case 'movetext':
        case 'game':
            if (state.selected.game === null) {
                clipboard.writeText('')
            } else {
                const pgnText = stringifyGame(state.selected.game, descriptor !== 'movetext', descriptor !== 'tags')
                clipboard.writeText(pgnText)
            }
            break
        case 'roster':
            const roster = ['Event','Site','Date','Round','White','Black','Result']
            const minPgnText = state.pgn.map(g => {
                return g.headers.slice(0).filter(t => roster.includes(t.name)).sort((a,b) => {
                    const aI = roster.indexOf(a.name), bI = roster.indexOf(b.name)
                    return aI - bI
                }).map(h => stringifyHeader(h)).join('\r\n') + '\r\n\r\n' + g.result
            }).join('\r\n\r\n')
            clipboard.writeText(minPgnText)
            break
        case 'pgn':
            const pgnText = stringifyPGN(state.pgn)
            clipboard.writeText(pgnText)
            break
        case 'fen':
            const fen = makeFen(state.chess.toSetup())
            clipboard.writeText(fen)
            break
        case 'epd':
            let epd = makeFen(state.chess.toSetup(), {epd: true})
            epd += ` hmvc ${state.chess.halfmoves}; fmvn ${state.chess.fullmoves};`
            if (state.selected.move !== null && state.selected.move.comments !== undefined) {
                for (let i = 0; i < state.selected.move.comments.length; i++) {
                    const comment = state.selected.move.comments[i]
                    epd += ` c${i} ${comment.text};`
                }
            }
            clipboard.writeText(epd)
            break
        default:
            break
    }
})
ipcRenderer.on('paste', (ev, descriptor) => {
    switch (descriptor) {
        case 'nag':
            if (state.selected.move === null) return
            let nag = clipboard.readText()
            if (!nag.startsWith('$')) {
                for (const nag1 in nagTable) {
                    if (Object.prototype.hasOwnProperty.call(nagTable, nag1)) {
                        const nagSymbol = nagTable[nag1]
                        if (nag === nagSymbol) {
                            nag = nag1
                            break
                        }
                    }
                }
            }
            if (!nag.startsWith('$') || /[^\d]/.test(nag.slice(1))) {
                toasts.showNew('error', 'Could not paste annotation', `"${nag}" is not a valid annotation`, 'paste', 4000)
                return
            }
            if (state.selected.move.nags === undefined) state.selected.move.nags = []
            if (!state.selected.move.nags.includes(nag)) state.selected.move.nags.push(nag)
            nags.show(state.selected.move)
            const moveEl = movelist.findMoveElement(state.selected.move)
            if (moveEl !== null) moveEl.innerText = movelist.getMovetext(state.selected.move)
            break
        case 'epd':
            const epd = clipboard.readText()
            let fenPart = epd.split(' ').slice(0, 4).join(' ')
            const commands = epd.substring(fenPart.length).split(';').map(c => c.substring(0, c.length-1).trim())
            if (commands.findIndex(c => c.startsWith('hmvc ')) >= 0) {
                const hmvc = Number(commands.find(c => c.startsWith('hmvc ')).split(' ')[1])
                if (!isNaN(hmvc)) fenPart += ' ' + hmvc
                else fenPart += ' 0'
            } else {
                fenPart += ' 0'
            }
            if (commands.findIndex(c => c.startsWith('fmvn ')) >= 0) {
                const fmvn = Number(commands.find(c => c.startsWith('fmvn ')).split(' ')[1])
                if (!isNaN(fmvn)) fenPart += ' ' + fmvn
                else fenPart += ' 1'
            } else {
                fenPart += ' 1'
            }
            const epdSetup = parseFen(fenPart)
            if (epdSetup.isErr) {
                toasts.showNew('error', 'Failed to create game from EPD', epdSetup.error.message, 'paste', 8000)
                console.error(`Failed to create game from ${epd}: ${epdSetup.error}`)
                return
            }
            appendGame('new')
            tags.set('FEN', fenPart)
            break
        case 'fen':
            const fen = clipboard.readText()
            const setup = parseFen(fen)
            if (setup.isErr) {
                toasts.showNew('error', 'Failed to create game from FEN', setup.error.message, 'paste', 8000)
                console.error(`Failed to create game from ${fen}: ${setup.error}`)
                return
            }
            appendGame('new')
            tags.set('FEN', fen)
            break
        case 'pgn':
            const pgn = clipboard.readText()
            promiseTraffic.request(state.windowId, 'parse-pgn', [pgn])
            .then(r => {
                const parsedPgn = r.response
                //TODO interpret as pgn file: try matching every game as an rav based on the move number at the start of each game's movetext. disregard games that don't fit (aren't legal as ravs)
            }).catch((r: CustomResponse) => {
                toasts.showNew('error', 'Could not insert pgn', r.response.error.message, 'paste', 8000)
                console.error(r.response.error)
            })
            break
        default:
            break
    }
})
ipcRenderer.on('load-pgn', (ev, parsedPgn, append) => {
    if (append === 'after') parsedPgn = state.pgn.concat(parsedPgn)
    else if (append === 'before') parsedPgn = parsedPgn.concat(state.pgn)
    loadPgn(parsedPgn)
})
ipcRenderer.on('fetch-pgn', (ev, info) => {
    if (info?.back === 'save-pgn') {
        const pgnString = stringifyPGN(state.pgn)
        ev.sender.send('save-pgn', pgnString, ...info.args)
    }
})
ipcRenderer.on('import-web-games', (ev, source) => {
    if (source === 'lichess') modals.open('lichess_import')
})
ipcRenderer.on('export-condition', (ev) => {
    modals.open('condition_export')
})
const setUserPreference = (name: string, value: string | boolean) => {
    console.log(`Setting ${name} to "${value}"`)
    state.prefs[name] = value
    switch (name) {
        case 'btrapTheme':
            (<HTMLLinkElement>document.getElementById('theme_sheet')).href = <string>value
            setTimeout(() => {
                state.chessground.redrawAll()
            }, 50)
            break
        case 'board':
            (<HTMLLinkElement>document.getElementById('board_sheet')).href = <string>value
            break
        case 'pieceset':
            (<HTMLLinkElement>document.getElementById('piece_sheet')).href = <string>value
            break
        case 'rookCastle':
            state.chessground.set({movable: {rookCastle: <boolean>value}})
            state.chessground.redrawAll()
            break
        case 'snapArrowsToValidMove':
            state.chessground.set({drawable: {defaultSnapToValidMove: <boolean>value}})
            state.chessground.redrawAll()
            break
        case 'eraseArrowsOnClick':
            state.chessground.set({drawable: {eraseOnClick: <boolean>value}})
            state.chessground.redrawAll()
            break
        case 'showDests':
            state.chessground.set({movable: {showDests: <boolean>value}})
            state.chessground.redrawAll()
            break
        case 'coordinates':
            state.chessground.set({coordinates: <boolean>value})
            state.chessground.redrawAll()
            break
        case 'orientation':
            state.chessground.set({orientation: <any>value})
            state.chessground.redrawAll()
            break
        case 'ghost':
            state.chessground.set({draggable: {showGhost: <boolean>value}})
            state.chessground.redrawAll()
            break
        case 'animation':
            state.chessground.set({animation: {enabled: <boolean>value}})
            state.chessground.redrawAll()
            break
        case 'highlightLastMove':
            state.chessground.set({highlight: {lastMove: <boolean>value}})
            state.chessground.redrawAll()
            break
        case 'highlightCheck':
            state.chessground.set({highlight: {check: <boolean>value}})
            state.chessground.redrawAll()
            break
        default:
            break
    }
}
ipcRenderer.on('set-pref', (ev, key, value) => {
    setUserPreference(key, value)
})
ipcRenderer.on('load-prefs', (ev, prefs) => {
    for (const key in prefs) {
        if (Object.prototype.hasOwnProperty.call(prefs, key)) {
            const prefValue = prefs[key]
            setUserPreference(key, prefValue)
        }
    }
})
//TODO add undo/redo for: 1. adding a move 2. deleting a move 3. deleting a variation 4. moving a variation up or down. Keyboard shortcuts should only work if focus is on board or movelist. Histories are local to a game, i.e. undo/redo only works for moves & variations of the current selected game (but actions are saved so re-selecting another game will make undoing previous actions on that game possible)
//#endregion

loadPgn(state.pgn)

liEngine.onPositionChange()
