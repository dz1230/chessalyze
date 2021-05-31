import { makeUci } from "chessops/util"
import { parseSan } from "chessops/san"

import { Game, Move, PGN, RAV, sanitizeHeaders, sanitizeMoves, sanitizePgn, sanitizeResult } from "../../../common/pgn"

import { state } from "../../scripts/pgn_editor/state"
import { indexOf, indexOfVariation, moveAt, variationOf } from "../../scripts/pgn_editor/utils"
import { tags } from "../../scripts/pgn_editor/tags"
import { gamelist } from "../../scripts/pgn_editor/gamelist"
import { selection } from "../../scripts/pgn_editor/selection"
import { movelist } from "../../scripts/pgn_editor/movelist"

const checkForGameEnd = () => {
    if (state.chess.isEnd()) {
        tags.set('Result', state.chess.isCheckmate() ? (state.chess.turn === "white" ? '1-0' : '0-1') : '1/2-1/2')
        tags.set('Termination', 'normal')
        return true
    }
    tags.set('Result', '*')
    if (tags.has('Termination')) tags.set('Termination', 'unterminated')
    return false
}

export const appendMove = (move: Move) => {
    if (state.selected.next !== null) {
        if (makeUci(parseSan(state.chess, state.selected.next.move)) === makeUci(parseSan(state.chess, move.move))) {
            //move is the next one in the current variation
            selection.selectMove(state.selected.next)
            return
        } 
        if (state.selected.next.ravs !== undefined && state.selected.next.ravs !== null) {
            for (const rav of state.selected.next.ravs) {
                if (rav.moves.length > 0 && rav.moves[0] && makeUci(parseSan(state.chess, move.move)) === makeUci(parseSan(state.chess, rav.moves[0].move))) {
                    //move is the next one in a different variation
                    selection.selectMove(rav.moves[0])
                    return
                }
            }
        }
        //move is a new variation
        move.move_number = state.selected.next.move_number
        if (move.move_number === undefined) move.move_number = state.selected.move.move_number
        move.isFirstInVariation = true
        move.isBlackMove = state.selected.next.isBlackMove
        if (state.selected.next.ravs === undefined || state.selected.next.ravs === null) state.selected.next.ravs = []
        state.selected.next.ravs.push({moves: [move]})
        const selectedVariation = variationOf(state.selected.next)
        const next2 = selectedVariation.moves[selectedVariation.moves.indexOf(state.selected.next)+1]
        if (next2 !== undefined && next2.isBlackMove) next2.move_number = state.selected.next.move_number
        movelist.insertLastVariationOf(state.selected.next)
        selection.selectMove(move)
        return
    }
    if (state.selected.move !== null) {
        //move becomes the next one in the current variation
        const variation = variationOf(state.selected.move)
        if (!state.selected.move.isBlackMove) {
            move.isBlackMove = true
            if (state.selected.move.ravs !== undefined && state.selected.move.ravs.length > 0) {
                move.move_number = state.selected.move.move_number
            }
        } else if (state.selected.move.isFirstInVariation) {
            move.move_number = state.selected.move.move_number + 1
        } else {
            move.move_number = variation.moves[variation.moves.indexOf(state.selected.move)-1].move_number + 1
        }
        variation.moves.push(move)
        movelist.newMove(move)
        selection.selectMove(move)
        if (variation === state.selected.game) {
            if (tags.has('PlyCount')) tags.set('PlyCount', state.selected.game.moves.length + '')
            checkForGameEnd()
        }
        return
    }
    //move is the first one in the game
    move.move_number = 1
    move.isFirstInVariation = true
    if (state.selected.game !== null && state.selected.game.moves.length > 0) throw new Error("Error: null|null selection in a non-empty game")
    if (state.selected.game === null && state.pgn.length > 0) throw new Error("Error: no game selected in a non-empty pgn");
    if (state.selected.game === null) {
        appendGame('new', move)
    } else {
        state.selected.game.moves.push(move)
        movelist.newMove(move)
        selection.selectMove(move)
    }
    if (tags.has('PlyCount')) tags.set('PlyCount', '1')
    checkForGameEnd()
}
export const deleteMove = (move: Move | number[]) => {
    if (!Array.isArray(move)) move = indexOf(move)
    const index = <number[]>move
    if (index[0] < 0) return
    let variation: RAV = state.selected.game
    let pVariation: RAV = null
    let p: Move = null
    let m: Move = variation.moves[index[0]]
    for (let i = 1; i < index.length; i += 2) {
        p = m
        pVariation = variation
        variation = m.ravs[index[i]]
        m = variation.moves[index[i+1]]
    }
    const j = index[index.length-1]
    variation.moves.splice(j)
    if (j === 0) {
        if (p !== null) {
            p.ravs.splice(p.ravs.indexOf(variation, 1))
            //remove move number from black move with that does not come after ravs anymore
            if (p.ravs.length === 0) {
                const nextAfterP = pVariation.moves[pVariation.moves.indexOf(p)+1]
                if (nextAfterP !== undefined && nextAfterP.isBlackMove) nextAfterP.move_number = undefined
            }
        }
        movelist.show(state.selected.game)
        selection.selectMove(p)
    } else {
        movelist.show(state.selected.game)
        selection.selectMove(variation[j-1])
    }
    if (variation === state.selected.game) {
        if (tags.has('PlyCount')) tags.set('PlyCount', state.selected.game.moves.length + '')
        if (tags.has('Termination')) tags.set('Termination', 'unterminated')
        tags.set('Result', '*')
    }
}
export const appendGame = (game: Game | 'new', firstMove: Move = null) => {
    if (typeof game === 'string') {
        if (game !== 'new') throw new Error("Invalid game creation string");
        const date = new Date(Date.now())
        game = {headers: [
            {name: 'Date', value: `${(date.getFullYear() + '').padStart(4, '0')}.${((date.getMonth()+1) + '').padStart(2, '0')}.${(date.getDate() + '').padStart(2, '0')}`},
            {name: 'UTCDate', value: `${(date.getUTCFullYear() + '').padStart(4, '0')}.${((date.getUTCMonth()+1) + '').padStart(2, '0')}.${(date.getUTCDate() + '').padStart(2, '0')}`},
            {name: 'UTCTime', value: `${(date.getUTCHours() + '').padStart(2, '0')}:${(date.getUTCMinutes() + '').padStart(2, '0')}:${(date.getUTCSeconds() + '').padStart(2, '0')}`},
            {name: 'PlyCount', value: '0'}
        ], moves: firstMove === null ? [] : [firstMove], result: '*'}
    }
    if (state.pgn.includes(game)) return
    game.result = sanitizeResult(game.result)
    game.headers = sanitizeHeaders(game)
    game.moves = sanitizeMoves(game.moves)
    state.pgn.push(game)
    selection.selectGame(game)
}
export const deleteGame = (game: Game) => {
    const i = state.pgn.indexOf(game)
    if (i < 0) return
    state.pgn.splice(i, 1)
    if (state.selected.game === game) {
        if (i < state.pgn.length) selection.selectGame(state.pgn[i])
        else if (state.pgn.length > 0) selection.selectGame(state.pgn[state.pgn.length-1])
        else selection.selectGame(null)
    }
    gamelist.clear()
    gamelist.list(state.pgn)
}
export const moveVariation = (rav: RAV, step: number) => {
    if (rav === null) return
    let pIndex = indexOfVariation(rav)
    pIndex.pop()
    const parentMove = moveAt(pIndex)
    if (parentMove === null && step <= 0) return
    const currPos = parentMove === null ? -1 : parentMove.ravs.indexOf(rav)
    const nPos = Math.max(-1, parentMove === null ? 0 : Math.min(parentMove.ravs.length, currPos+step))
    if (nPos === currPos) return
    if (parentMove === null || nPos === parentMove.ravs.length) {
        if (state.selected.move.ravs !== undefined && state.selected.move.ravs.length > 0) {
            const m = state.selected.move
            moveVariation(state.selected.move.ravs[0], -1)
            selection.selectMove(m)
        }
    } else if (nPos < 0) {
        parentMove.ravs.splice(currPos, 1)
        const parentVariation = variationOf(parentMove)
        const i = parentVariation.moves.indexOf(parentMove)
        const nRav: RAV = {moves: parentVariation.moves.splice(i)}
        parentVariation.moves.push(...rav.moves)
        parentVariation.moves[i].ravs = [nRav].concat(parentMove.ravs)
        parentMove.ravs = undefined
        parentMove.isFirstInVariation = true
        if (parentMove.isBlackMove && i > 0) parentMove.move_number = parentVariation.moves[i-1].move_number
        if (nRav.moves.length > 1 && nRav.moves[1].isBlackMove) nRav.moves[1].move_number = undefined
        parentVariation.moves[i].isFirstInVariation = (i === 0)
        if (parentVariation.moves[i].isBlackMove && (i > 0)) parentVariation.moves[i].move_number = undefined
        if (parentVariation.moves.length > i+1 && parentVariation.moves[i+1].isBlackMove) parentVariation.moves[i+1].move_number = parentVariation.moves[i].move_number
        movelist.show(state.selected.game)
        selection.selectMove(parentVariation.moves[i], true)
    } else {
        let step = nPos > currPos ? 1 : -1
        for (let i = currPos; ((nPos > currPos) && (i < nPos)) || ((nPos < currPos) && (i > nPos)); i += step) {
            parentMove.ravs[i] = parentMove.ravs[i+step]
        }
        parentMove.ravs[nPos] = rav
        movelist.show(state.selected.game)
        selection.selectMove(state.selected.move, true)
    }
}
export const deleteVariation = (rav: RAV) => {
    if (rav === null) return
    if (rav === state.selected.game) {
        state.selected.game.moves.splice(0)
        movelist.show(state.selected.game)
        selection.selectMove(null)
        return
    }
    let pIndex = indexOfVariation(rav)
    pIndex.pop()
    const parentMove = moveAt(pIndex)
    parentMove.ravs.splice(parentMove.ravs.indexOf(rav), 1)
    movelist.show(state.selected.game)
    selection.selectMove(parentMove)
}

export const loadPgn = (nPgn: PGN) => {
    state.pgn = sanitizePgn(nPgn)
    gamelist.clear()
    gamelist.list(state.pgn)
    if (state.pgn.length === 0) selection.selectGame(null)
    else selection.selectGame(state.pgn[0])
    selection.selectMove(null)
}
