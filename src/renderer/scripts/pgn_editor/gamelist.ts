
import d3 = require("d3")
import { Game, PGN } from "../../../common/pgn"
import { state } from "../../scripts/pgn_editor/state"
import { selection } from "../../scripts/pgn_editor/selection"
import { appendGame } from "../../scripts/pgn_editor/mutations"

export const gamelist = {
    menu: d3.select('#gamelist'),
    gamename(game: Game, w: string = '', b: string = ''): string {
        if (game === null) return 'null'
        const i = state.pgn.indexOf(game)
        let displayName = 'Anon vs Anon'
        if (w === '') w = game.headers.find(h => h.name === 'White')?.value
        if (w === undefined) w = ''
        if (b === '') b = game.headers.find(h => h.name === 'Black')?.value
        if (b === undefined) b = ''
        if (w !== '' && w !== '?') {
            if (b === '?' || b === '') b = 'Anonymous'
            displayName = w + ' - ' + b
        } else if (b !== '' && b !== '?') {
            w = 'Anonymous'
            displayName = w + ' - ' + b
        }
        return (i+1) + '. ' + displayName
    },
    clear() {
        gamelist.menu.selectChildren((ch: HTMLAnchorElement) => ch.hasAttribute('data-game-index')).remove()
        document.getElementById('gamelist_divider').style.display = 'none'
    },
    list(pgn: PGN) {
        if (pgn.length > 0) document.getElementById('gamelist_divider').toggleAttribute('style', false)
        else document.getElementById('gamelist_divider').style.display = 'none'
        for (let i = pgn.length-1; i >= 0; i--) {
            const game = pgn[i]
            const displayName = gamelist.gamename(game)
            const btn = d3.create('a').attr('class', game === state.selected.game ? 'dropdown-item game current' : 'dropdown-item game').attr('href', '#').attr('role', 'button')
            .attr('data-game-index', i+'').text(displayName).on('click', ev => {
                selection.selectGame(game)
            });
            (<HTMLDivElement>gamelist.menu.node()).insertBefore(btn.node(), (<HTMLDivElement>gamelist.menu.node()).firstChild)
        }
    }
}

d3.select('#newgame').on('click', ev => {
    appendGame('new')
})
