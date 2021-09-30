import { Chess } from "chessops/chess"
import { makeFen, parseFen } from "chessops/fen"
import { parseSan } from "chessops/san"
import { chessgroundDests, chessgroundMove } from "chessops/compat"

import d3 = require("d3")

import { Game, Move } from "../../../common/pgn"

import { state } from "../../scripts/pgn_editor/state"
import { tags } from "../../scripts/pgn_editor/tags"
import { fenOf, indexOf } from "../../scripts/pgn_editor/utils"
import { liEngine, uciengine } from "../../scripts/pgn_editor/engines"
import { gamelist } from "../../scripts/pgn_editor/gamelist"
import { comments, nags } from "../../scripts/pgn_editor/annotation"
import { movelist } from "../../scripts/pgn_editor/movelist"

export const selection = {
    selectGame(game: Game) {
        if (game === state.selected.game) return
        state.selected.game = game
        d3.select('#elo_bottom').text('-')
        d3.select('#elo_top').text('-')
        tags.show(game)
        const fen = fenOf(game)
        const setupErr = parseFen(fen)
        if (setupErr.isErr) throw new Error(setupErr.error.name + ': ' + setupErr.error.message)
        state.chess = Chess.fromSetup(setupErr.unwrap()).unwrap()
        if (state.chessground.getFen() !== fen) {
            uciengine.onPositionChange()
        }
        state.chessground.set({
            fen: fen,
            movable: {
                dests: chessgroundDests(state.chess), 
            },
            lastMove: null,
            check: state.chess.isCheck(),
            turnColor: state.chess.turn
        });
        (<any>gamelist.menu.selectChildren('.game.current').node())?.classList?.remove('current')
        movelist.clear()
        if (game === null) {
            selection.selectMove(null)
        } else {
            movelist.show(game)
            const gameBtn = <HTMLAnchorElement>(gamelist.menu.selectChild((ch: any) => {
                return ch.getAttribute('data-game-index') === (state.pgn.indexOf(game) + '')
            }).node())
            if (gameBtn !== null) gameBtn.classList.add('current')

            if (game.moves.length > 0) selection.selectMove(game.moves[0])
            else selection.selectMove(null)
        }
        gamelist.clear()
        gamelist.list(state.pgn)
    },
    selectMove(move: Move, force: boolean = false) {
        if (move === state.selected.move && !force) return
        selection.selectIndex(indexOf(move), force || (move !== state.selected.move))
    },
    selectIndex(index: number[], force: boolean = false) {
        if (index === state.selected.moveIndex && !force) return
        state.selected.moveIndex = index

        const fen = fenOf(state.selected.game)
        const setupErr = parseFen(fen)
        if (setupErr.isErr) throw new Error(setupErr.error.name + ': ' + setupErr.error.message)
        state.chess = Chess.fromSetup(setupErr.unwrap()).unwrap()

        let lastMove = null
        if (state.selected.game === null) {
            state.selected.move = null
            state.selected.next = null
        } else {
            for (let i = -1; i < index.length; i += 2) {
                const variation = i < 0 ? state.selected.game : state.selected.move.ravs[index[i]]
                const j = index[i+1]
                for (let m = 0; m < j; m++) {
                    lastMove = parseSan(state.chess, variation.moves[m].move)
                    state.chess.play(lastMove)
                }
                state.selected.move = variation.moves[j]
                state.selected.next = variation.moves[j+1]
            }
            if (state.selected.next === undefined) state.selected.next = null
            if (state.selected.move === undefined) state.selected.move = null
            if (state.selected.move !== null) {
                lastMove = parseSan(state.chess, state.selected.move.move)
                state.chess.play(lastMove)
            }
        }

        const fen1 = makeFen(state.chess.toSetup())
        if (state.chessground.getFen() !== fen1) {
            uciengine.onPositionChange()
            liEngine.onPositionChange()
        }
        state.chessground.set({
            fen: fen1,
            movable: {
                dests: chessgroundDests(state.chess, {chess960: false}),
            },
            check: state.chess.isCheck(),
            lastMove: lastMove === null ? lastMove : chessgroundMove(lastMove),
            turnColor: state.chess.turn
        })

        d3.select('#promotion_popup').style('display', 'none')

        comments.show(state.selected.move)
        nags.show(state.selected.move)

        document.getElementById('moves').querySelector('.move.active')?.classList.remove('active')
        const moveEl = movelist.getMoveElement(state.selected.move)
        if (moveEl !== null) moveEl.classList.add('active')
    },
    select(game: Game, move: Move | number[]) {
        selection.selectGame(game)
        if (Array.isArray(move)) selection.selectIndex(move)
        else selection.selectMove(move)
    }
}
