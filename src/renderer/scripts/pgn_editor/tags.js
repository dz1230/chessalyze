"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.tags = void 0;
const d3 = require("d3");
const state_1 = require("../../scripts/pgn_editor/state");
const mutations_1 = require("../../scripts/pgn_editor/mutations");
exports.tags = {
    list: d3.select('#headers'),
    roster: ['Event', 'Site', 'Date', 'Round', 'White', 'Black', 'Result'],
    special: ['new', 'other'],
    listeners: [],
    has(name) {
        if (state_1.state.selected.game === null)
            return false;
        return state_1.state.selected.game.headers.some(h => h.name === name);
    },
    show(game) {
        exports.tags.list.selectChildren((ch, i, all) => {
            return !(exports.tags.special.includes(ch.getAttribute('data-tag')) || exports.tags.roster.includes(ch.getAttribute('data-tag')));
        }).remove();
        if (game === null) {
            for (const tag of exports.tags.list.node().children) {
                if (exports.tags.roster.includes(tag.getAttribute('data-tag'))) {
                    const n = tag.getAttribute('data-tag');
                    tag.getElementsByClassName('tag-value')[0].value = n === 'Date' ? '' : (n === 'Result' ? '*' : '?');
                    for (let i = 0; i < exports.tags.listeners.length; i++) {
                        const l = exports.tags.listeners[i];
                        if (l.tagName === n) {
                            l.listener(null, n === 'Date' ? '????.??.??' : (n === 'Result' ? '*' : '?'));
                        }
                    }
                }
            }
        }
        else {
            for (let i = 0; i < game.headers.length; i++) {
                const h = game.headers[i];
                exports.tags.set(h.name, h.value);
            }
        }
    },
    set(name, value) {
        if (state_1.state.selected.game === null)
            mutations_1.appendGame('new');
        const prevValue = state_1.state.selected.game.headers.find(h => h.name === name)?.value;
        for (let i = 0; i < exports.tags.listeners.length; i++) {
            const l = exports.tags.listeners[i];
            if (l.tagName !== name)
                continue;
            value = l.listener(prevValue === undefined ? null : prevValue, value);
        }
        if (value === null) {
            state_1.state.selected.game.headers.splice(state_1.state.selected.game.headers.findIndex(h => h.name === name), 1);
            exports.tags.list.selectChild((child) => child.getAttribute('data-tag') === name).remove();
        }
        else {
            if (!state_1.state.selected.game.headers.some(h => h.name === name))
                state_1.state.selected.game.headers.push({ name, value });
            else
                state_1.state.selected.game.headers.find(h => h.name === name).value = value;
            const h = exports.tags.list.selectChild((child) => child.getAttribute('data-tag') === name);
            if (h.empty()) {
                exports.tags.list.node().insertBefore(exports.tags.create({ name, value }, { removable: !exports.tags.roster.includes(name) && (name !== 'SetUp'), editable: name !== 'SetUp' }), exports.tags.list.node().lastElementChild);
            }
            else {
                h.selectChild('.tag-value').property('value', (name === 'Date') ? value.replaceAll('.', '-') : value);
            }
        }
    },
    create(header, options = undefined) {
        options = Object.assign({ removable: true, editable: true }, options);
        const h = d3.create('li').attr('class', 'list-group-item tag').attr('data-tag', header.name);
        const hName = h.append('span');
        if (options.removable) {
            const closeBtn = hName.append('button').attr('type', 'button').attr('class', 'close');
            closeBtn.append('span').html('&times;');
            const name = header.name;
            closeBtn.on('click', ev => {
                exports.tags.set(name, null);
            });
            hName.node().append(header.name);
        }
        else {
            hName.text(header.name);
        }
        const hValue = h.append('input').attr('class', 'form-control tag-value')
            .attr('type', header.name === 'Date' ? 'date' : 'text').property('value', (header.name === 'Date') ? header.value.replace('.', '-') : header.value);
        if (!options.editable)
            hValue.attr('disabled', 'true');
        hValue.on('change', exports.tags.changeListener);
        return h.node();
    },
    addListener(tagName, listener) {
        exports.tags.listeners.push({ tagName, listener });
    },
    changeListener(event) {
        const tagValue = event.target;
        const tagName = tagValue.parentElement.getAttribute('data-tag');
        exports.tags.set(tagName, tagValue.value);
    }
};
exports.tags.addListener('Event', (prev, value) => (value === '' || value === null) ? '?' : value);
exports.tags.addListener('Site', (prev, value) => (value === '' || value === null) ? '?' : value);
exports.tags.addListener('Date', (prev, value) => (value === '' || value === null) ? '????.??.??' : value.replaceAll('-', '.'));
exports.tags.addListener('Round', (prev, value) => (value === '' || value === null) ? '?' : value);
exports.tags.addListener('White', (prev, value) => (value === '' || value === null) ? '?' : value);
exports.tags.addListener('Black', (prev, value) => (value === '' || value === null) ? '?' : value);
exports.tags.addListener('Result', (prev, value) => !['*', '1-0', '1/2-1/2', '0-1'].includes(value) ? '*' : value);
document.getElementById('add_tag_name')?.addEventListener('change', ev => {
    const nameInput = document.getElementById('add_tag_name');
    const valueInput = document.getElementById('add_tag_value');
    const header = {
        name: nameInput.value,
        value: valueInput.value
    };
    if (header.name === '')
        return;
    if (state_1.state.selected.game === null)
        mutations_1.appendGame('new');
    if (state_1.state.selected.game.headers.some(h => h.name === header.name))
        return;
    exports.tags.set(header.name, header.value);
    valueInput.value = '';
    nameInput.value = '';
});
