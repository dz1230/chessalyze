import { INITIAL_FEN } from "chessops/fen"

import { Game, Move, RAV } from "../../../common/pgn"

import { state } from "../../scripts/pgn_editor/state"

export const fenOf = (game: Game): string => {
    if (game === null) return INITIAL_FEN
    return game.headers ? (game.headers.some(h => h.name === 'SetUp' && h.value === '1') ? game.headers.find(h => h.name === 'FEN').value : INITIAL_FEN) : INITIAL_FEN
}

export const ravLevel = (rav: RAV, parent: RAV): number => {
    if (rav === parent) return 0
    for (let i = 0; i < parent.moves.length; i++) {
        const move = parent.moves[i]
        if (move.ravs === undefined) continue
        for (let j = 0; j < move.ravs.length; j++) {
            const rav1 = move.ravs[j]
            const level = ravLevel(rav, rav1)
            if (level >= 0) return level + 1
        }
    }
    return -1
}

export const indexInVariation = (variation: RAV, move: Move): number[] => {
    for (let i = 0; i < variation.moves.length; i++) {
        const varMove = variation.moves[i]
        if (varMove === move) return [i]
        if (varMove.ravs !== undefined) {
            for (let j = 0; j < varMove.ravs.length; j++) {
                const rav = varMove.ravs[j]
                const idx = indexInVariation(rav, move)
                if (idx[0] > -1) {
                    return [i, j].concat(idx)
                }
            }
        }
    }
    return [-1]
}

export const indexOf = (move: Move): number[] => {
    if (move === null || state.selected.game === null) return [-1]
    return indexInVariation(state.selected.game, move)
}

export const indexOfVariation = (variation: RAV): number[] => {
    if (variation.moves.length === 0) return null
    let idx = indexOf(variation.moves[0])
    idx.pop()
    return idx
}

export const moveAt = (index: number[]): Move => {
    if (state.selected.game === null) return null
    let move: Move = null
    for (let i = -1; i < index.length; i += 2) {
        const variation: RAV = i < 0 ? state.selected.game : move.ravs[index[i]]
        move = variation.moves[index[i+1]]
    }
    return move === undefined ? null : move
}

export const variationOf = (move: Move): RAV => {
    const index = indexOf(move)
    let variation: RAV = state.selected.game
    let m: Move = variation.moves[index[0]]
    for (let i = 1; i < index.length; i += 2) {
        variation = m.ravs[index[i]]
        m = variation.moves[index[i+1]]
    }
    return variation
}

export const selectedVariation = (): RAV => {
    const idx = state.selected.moveIndex
    const out: RAV = {moves: []}
    if (state.selected.game === null || state.selected.move === null) return out
    let variation: RAV = null
    let m: Move = null
    for (let i = -1; i < idx.length; i += 2) {
        variation = i < 0 ? state.selected.game : m.ravs[idx[i]]
        out.moves.push(...variation.moves.slice(0, idx[i+1]))
        m = variation.moves[idx[i+1]]
    }
    out.moves.push(state.selected.move)
    return out
}
