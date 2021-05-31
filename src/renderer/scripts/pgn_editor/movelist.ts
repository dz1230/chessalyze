import d3 = require("d3")
import { Game, Move, RAV } from "../../../common/pgn"
import { nagTable } from "../../scripts/pgn_editor/annotation"
import { selection } from "../../scripts/pgn_editor/selection"
import { state } from "../../scripts/pgn_editor/state"
import { indexOfVariation, ravLevel, variationOf } from "../../scripts/pgn_editor/utils"

export const movelist = {
    list: document.getElementById('moves'),
    nagSymbol(nag: string): string {
        const nagName = nagTable[nag]
        return nagName === undefined ? nag : nagName
    },
    getMovetext(move: Move): string {
        return (move.move_number !== undefined ? (move.move_number + '.') : '') + 
        ((move.move_number !== undefined) ? (move.isBlackMove ? '..' : ' ') : '') + 
        move.move +
        (move.nags !== undefined ? move.nags.map(nag => movelist.nagSymbol(nag)).join('') : '')
    },
    createMove(move: Move): HTMLSpanElement {
        const m = move
        return d3.create('span').attr('class', 'move')
        .text(movelist.getMovetext(move)).on('click', ev => {
            selection.selectMove(m)
        })
        .node()
    },
    clear() {
        while (movelist.list.children.length > 0) {
            movelist.list.children[0].remove()
        }
    },
    show(game: Game) {
        movelist.clear()
        movelist.newVariation(game, null, 0, 0)
        const r = document.createElement('span')
        r.className = 'result'
        r.innerText = game.result
        let varDiv: HTMLDivElement
        if (movelist.list.lastElementChild?.classList.contains('main')) {
            varDiv = <HTMLDivElement>movelist.list.lastElementChild
        } else {
            varDiv = document.createElement('div')
            varDiv.className = 'variation main'
            varDiv.setAttribute('data-variation', '[]')
            movelist.list.appendChild(varDiv)
        }
        varDiv.appendChild(r)
    },
    newMove(move: Move) {
        const variation = variationOf(move)
        const varDiv = movelist.findLastVariationDiv(variation)
        const prevLastMove = variation.moves[variation.moves.length-2]
        if (variation !== state.selected.game && prevLastMove !== undefined && prevLastMove.ravs !== undefined && prevLastMove.ravs.length > 0) {
            if (varDiv.lastChild.textContent === ')') varDiv.lastChild.remove()
            const prevMoveRavDiv = movelist.findLastVariationDiv(prevLastMove.ravs[prevLastMove.ravs.length-1])
            movelist.newVariation(variation, prevMoveRavDiv, variation.moves.indexOf(move))
        } else {
            varDiv.insertBefore(movelist.createMove(move), varDiv.lastChild)
        }
    },
    insertLastVariationOf(move: Move) {
        if (move.ravs.length === 1) {
            const variation = variationOf(move)
            const varDiv = movelist.findVariationDiv(move)
            const lastVarEl = movelist.findLastVariationDiv(variation)
            let el1 = varDiv.el
            while (el1 !== lastVarEl) {
                if (el1 === null || el1 === undefined) break
                let rmEl = el1
                el1 = <HTMLDivElement>el1.nextElementSibling
                if (rmEl !== varDiv.el) rmEl.remove()
            }
            const nVarDiv = movelist.newVariation(move.ravs[move.ravs.length-1], varDiv.el)
            const splitVarDiv = movelist.newVariation(variation, nVarDiv, variation.moves.indexOf(move)+1, -1, variation === state.selected.game)
            if (variation === state.selected.game) splitVarDiv.appendChild(lastVarEl.lastChild)
            while (varDiv.index < varDiv.el.children.length-1) {
                varDiv.el.children[varDiv.index+1].remove()
            }
            if (varDiv.el !== lastVarEl) lastVarEl.remove()
        } else {
            const varDiv = movelist.findLastVariationDiv(move.ravs[move.ravs.length-2])
            movelist.newVariation(move.ravs[move.ravs.length-1], varDiv)
        }
    },
    newVariation(rav: RAV, after: HTMLDivElement, offset: number = 0, level: number = -1, createEmpty: boolean = false) {
        if (!createEmpty && rav.moves.length-offset <= 0) return
        if (level < 0) level = ravLevel(rav, state.selected.game)
        const index = JSON.stringify(indexOfVariation(rav))
        const variationDiv = document.createElement('div')
        variationDiv.setAttribute('data-variation', index)
        variationDiv.className = 'variation'
        variationDiv.classList.add(level === 0 ? 'main' : 'rav')
        variationDiv.style.marginLeft = (level * 15) + 'px'
        if (level > 0) {
            variationDiv.setAttribute('data-rav-level', level+'')
            variationDiv.append('(')
        }
        movelist.list.insertBefore(variationDiv, after?.nextSibling)
        let i = offset
        let last = variationDiv
        for (; i < rav.moves.length; i++) {
            const move = rav.moves[i]
            variationDiv.appendChild(movelist.createMove(move))
            if (move.ravs !== undefined && move.ravs.length > 0) {
                for (let j = 0; j < move.ravs.length; j++) {
                    const rav1 = move.ravs[j]
                    last = movelist.newVariation(rav1, last, 0, level+1)
                }
                break
            }
        }
        if (i === rav.moves.length) {
            if (level > 0) variationDiv.append(')')
        } else {
            last = movelist.newVariation(rav, last, i+1, level)
        }
        return last
    },
    findVariationDiv(move: Move): {el: HTMLDivElement, index: number} {
        const el = movelist.findMoveElement(move)
        return {
            el: <HTMLDivElement>el.parentElement,
            index: [...el.parentElement.children].indexOf(el)
        }
    },
    findLastVariationDiv(rav: RAV): HTMLDivElement {
        const index = JSON.stringify(indexOfVariation(rav))
        let elem: HTMLDivElement = null
        for (let i = 0; i < movelist.list.children.length; i++) {
            const child = movelist.list.children[i]
            if (child.getAttribute('data-variation') === index) {
                elem = <HTMLDivElement>child
            }
        }
        return elem
    },
    findMoveElement(move: Move): HTMLSpanElement {
        if (move === null) return null
        const variation = variationOf(move)
        const index = JSON.stringify(indexOfVariation(variation))
        const mIndex = variation.moves.indexOf(move)
        let vmIndex = 0
        for (let i = 0; i < movelist.list.children.length; i++) {
            const child = movelist.list.children[i]
            if (child.getAttribute('data-variation') === index) {
                vmIndex += child.childElementCount
                if (mIndex < vmIndex) {
                    return <HTMLSpanElement>(child.children[mIndex-(vmIndex-child.childElementCount)])
                }
            }
        }
        return null
    }
}
