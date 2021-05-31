"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.gamelist = void 0;
const d3 = require("d3");
const state_1 = require("../../scripts/pgn_editor/state");
const selection_1 = require("../../scripts/pgn_editor/selection");
const mutations_1 = require("../../scripts/pgn_editor/mutations");
exports.gamelist = {
    menu: d3.select('#gamelist'),
    gamename(game, w = '', b = '') {
        if (game === null)
            return 'null';
        const i = state_1.state.pgn.indexOf(game);
        let displayName = 'Anon vs Anon';
        if (w === '')
            w = game.headers.find(h => h.name === 'White')?.value;
        if (w === undefined)
            w = '';
        if (b === '')
            b = game.headers.find(h => h.name === 'Black')?.value;
        if (b === undefined)
            b = '';
        if (w !== '' && w !== '?') {
            if (b === '?' || b === '')
                b = 'Anonymous';
            displayName = w + ' - ' + b;
        }
        else if (b !== '' && b !== '?') {
            w = 'Anonymous';
            displayName = w + ' - ' + b;
        }
        return (i + 1) + '. ' + displayName;
    },
    clear() {
        exports.gamelist.menu.selectChildren((ch) => ch.hasAttribute('data-game-index')).remove();
        document.getElementById('gamelist_divider').style.display = 'none';
    },
    list(pgn) {
        if (pgn.length > 0)
            document.getElementById('gamelist_divider').toggleAttribute('style', false);
        else
            document.getElementById('gamelist_divider').style.display = 'none';
        for (let i = pgn.length - 1; i >= 0; i--) {
            const game = pgn[i];
            const displayName = exports.gamelist.gamename(game);
            const btn = d3.create('a').attr('class', game === state_1.state.selected.game ? 'dropdown-item game current' : 'dropdown-item game').attr('href', '#').attr('role', 'button')
                .attr('data-game-index', i + '').text(displayName).on('click', ev => {
                selection_1.selection.selectGame(game);
            });
            exports.gamelist.menu.node().insertBefore(btn.node(), exports.gamelist.menu.node().firstChild);
        }
    }
};
d3.select('#newgame').on('click', ev => {
    mutations_1.appendGame('new');
});
