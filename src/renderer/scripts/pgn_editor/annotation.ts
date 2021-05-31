import d3 = require("d3")
import { Move, Comment, Game } from "../../../common/pgn"
import { state } from "../../scripts/pgn_editor/state"
import { movelist } from "../../scripts/pgn_editor/movelist"
import { appendGame } from "../../scripts/pgn_editor/mutations"

export const comments = {
    create(comment: Comment, move: Move | Game): HTMLTextAreaElement {
        const m = move
        const tArea = document.createElement('textarea')
        tArea.className = 'comment'
        tArea.value = comment.text
        tArea.addEventListener('change', ev => {
            comment.text = tArea.value
            if (comment.text === '') {
                tArea.remove()
                m.comments.splice(m.comments.indexOf(comment), 1)
                if (m.comments.length === 0) m.comments = undefined
                comments.show(m)
            }
        })
        tArea.spellcheck = false
        tArea.rows = comment.text.includes('\n') ? (comment.text.match(/\n/g) || []).length + 1 : Math.floor(comment.text.length / 60) + 1
        return tArea
    },
    clear() {
        const list = document.getElementById('comment_list')
        while (list.children.length > 0) {
            list.children[0].remove()
        }
    },
    show(move: Move | Game) {
        comments.clear()
        if (move === null || move.comments === undefined) return
        for (let i = 0; i < move.comments.length; i++) {
            const comment = move.comments[i]
            document.getElementById('comment_list').appendChild(comments.create(comment, move))
        }
    }
}

document.getElementById('ncomment').addEventListener('change', ev => {
    const commentText = (<HTMLTextAreaElement>document.getElementById('ncomment')).value
    if (commentText === null || commentText === undefined || commentText === '') return
    const comment: Comment = {text: commentText}
    if (state.selected.move !== null) {
        if (state.selected.move.comments === undefined) state.selected.move.comments = []
        state.selected.move.comments.unshift(comment)
        comments.show(state.selected.move)
    } else {
        if (state.selected.game === null) appendGame('new')
        if (state.selected.game.comments === undefined) state.selected.game.comments = []
        state.selected.game.comments.unshift(comment)
        comments.show(state.selected.game)
    }
    (<HTMLTextAreaElement>document.getElementById('ncomment')).value = ''
})

export const nagTable = {
    '$0': '', '$1': '!', '$2': '?', '$3': '!!',
    '$4': '??', '$5': '!?', '$6': '?!', '$7': '□',
    '$8': '□', '$9': '???', '$10': '=', '$11': '=',
    '$12': '∞=', '$13': '∞', '$14': '⩲', '$15': '⩱',
    '$16': '±', '$17': '∓', '$18': '+−', '$19': '-+',
    '$20': '+−', '$21': '-+', '$22': '⨀', '$23': '⨀',
    '$24': '○', '$25': '○', '$26': '○', '$27': '○', 
    '$28': '○', '$29': '○', '$30': '↑↑', '$31': '↑↑', 
    '$32': '↑↑', '$33': '↑↑', '$34': '↑↑', '$35': '↑↑', 
    '$36': '↑', '$37': '↑', '$38': '↑', '$39': '↑', 
    '$40': '→', '$41': '→', '$42': '=∞', '$43': '=∞', 
    '$44': '=∞', '$45': '=∞', '$46': '=∞', '$47': '=∞',

    '$130': '⇆', '$131': '⇆', '$132': '⇆', '$133': '⇆',
    '$134': '⇆', '$135': '⇆', '$136': '⊕', '$137': '⊕', 
    '$138': '⊕', '$139': '⊕',

    '$140': '∆', '$141': '∇', '$142': '⌓', '$143': '<=',
    '$144': '==', '$145': 'RR', '$146': 'N',

    '$238': '○'
}

export const nags = {
    reset() {
        d3.selectAll('.nag-item').classed('list-group-item-primary', false)
        d3.selectAll('.nag-btn').nodes().forEach((btn: HTMLDivElement) => {
            btn.toggleAttribute('data-nag-curr', false)
        })
    },
    show(move: Move) {
        nags.reset()
        if (move === null || move.nags === undefined || move.nags.length === 0) return
        for (const nag of move.nags) {
            const nagNr = nag.substring(1)
            d3.selectAll('.nag-btn').nodes().forEach((nagBtn: HTMLDivElement) => {
                const accepts = nagBtn.getAttribute('data-nag-accept').split(',')
                if (accepts.includes(nagNr)) {
                    nagBtn.setAttribute('data-nag-curr', nagBtn.hasAttribute('data-nag-curr') ? (nagBtn.getAttribute('data-nag-curr') + ',' + nagNr) : nagNr)
                    nagBtn.parentElement.classList.add('list-group-item-primary')
                }
            })
        }
    }
}

d3.selectAll('.nag-item').on('click', ev => {
    if (state.selected.move === null) return
    const nagBtn: HTMLDivElement = ev.target?.classList?.contains('nag-btn') ? ev.target : ev.target?.querySelector('.nag-btn')
    if (nagBtn.hasAttribute('data-nag-curr')) {
        const current = nagBtn.getAttribute('data-nag-curr').split(',')
        if (state.selected.move.nags !== undefined) {
            for (const nagNr of current) {
                state.selected.move.nags.splice(state.selected.move.nags.indexOf('$' + nagNr), 1)
            }
        }
        nagBtn.toggleAttribute('data-nag-curr', false)
        nagBtn.parentElement.classList.remove('list-group-item-primary')
    } else {
        const nagNr = ((+nagBtn.getAttribute('data-nag')) + ((nagBtn.hasAttribute('data-nag-color-specific') && state.selected.move.isBlackMove) ? 1 : 0))+''
        if (state.selected.move.nags === undefined) state.selected.move.nags = []
        if (!state.selected.move.nags.includes('$'+nagNr)) state.selected.move.nags.push('$'+nagNr)
        nagBtn.setAttribute('data-nag-curr', nagNr)
        nagBtn.parentElement.classList.add('list-group-item-primary')
    }
    const moveEl = movelist.findMoveElement(state.selected.move)
    if (moveEl !== null) moveEl.innerText = movelist.getMovetext(state.selected.move)
})
