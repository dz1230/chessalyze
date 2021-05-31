
import d3 = require("d3")
import { Game, Header } from "../../../common/pgn"
import { state } from "../../scripts/pgn_editor/state"
import { appendGame } from "../../scripts/pgn_editor/mutations"

export const tags = {
    list: d3.select('#headers'),
    roster: ['Event','Site','Date','Round','White','Black','Result'],
    special: ['new','other'],
    listeners: [],
    has(name: string) {
        if (state.selected.game === null) return false
        return state.selected.game.headers.some(h => h.name === name)
    },
    show(game: Game) {
        tags.list.selectChildren((ch: HTMLLIElement, i, all) => {
            return !(tags.special.includes(ch.getAttribute('data-tag')) || tags.roster.includes(ch.getAttribute('data-tag')))
        }).remove()
        if (game === null) {
            for (const tag of (<HTMLUListElement>tags.list.node()).children) {
                if (tags.roster.includes(tag.getAttribute('data-tag'))) {
                    const n = tag.getAttribute('data-tag');
                    (<any>tag.getElementsByClassName('tag-value')[0]).value = n === 'Date' ? '' : (n === 'Result' ? '*' : '?')
                    for (let i = 0; i < tags.listeners.length; i++) {
                        const l = tags.listeners[i]
                        if (l.tagName === n) {
                            l.listener(null, n === 'Date' ? '????.??.??' : (n === 'Result' ? '*' : '?'))
                        }
                    }
                }
            }            
        } else {
            for (let i = 0; i < game.headers.length; i++) {
                const h = game.headers[i]
                tags.set(h.name, h.value)
            }
        }
    },
    set(name: string, value: string) {
        if (state.selected.game === null) appendGame('new')
        const prevValue = state.selected.game.headers.find(h => h.name === name)?.value
        for (let i = 0; i < tags.listeners.length; i++) {
            const l = tags.listeners[i]
            if (l.tagName !== name) continue
            value = l.listener(prevValue === undefined ? null : prevValue, value)
        }
        if (value === null) {
            state.selected.game.headers.splice(state.selected.game.headers.findIndex(h => h.name === name), 1)
            tags.list.selectChild((child: any) => child.getAttribute('data-tag') === name).remove()
        } else {
            if (!state.selected.game.headers.some(h => h.name === name)) state.selected.game.headers.push({name, value})
            else state.selected.game.headers.find(h => h.name === name).value = value
            const h = tags.list.selectChild((child: any) => child.getAttribute('data-tag') === name)
            if (h.empty()) {
                (<HTMLUListElement>tags.list.node()).insertBefore(
                    tags.create({name, value}, {removable: !tags.roster.includes(name) && (name !== 'SetUp'), editable: name !== 'SetUp'}), 
                    (<HTMLUListElement>tags.list.node()).lastElementChild
                )
            } else {
                h.selectChild('.tag-value').property('value', (name === 'Date') ? value.replaceAll('.', '-') : value)
            }
        }
    },
    create(header: Header, options: {
        removable: boolean,
        editable: boolean
    } = undefined): HTMLLIElement {
        options = Object.assign({removable: true, editable: true}, options)
        const h = d3.create('li').attr('class', 'list-group-item tag').attr('data-tag', header.name)
        const hName = h.append('span')
        if (options.removable) {
            const closeBtn = hName.append('button').attr('type', 'button').attr('class', 'close')
            closeBtn.append('span').html('&times;')
            const name = header.name
            closeBtn.on('click', ev => {
                tags.set(name, null)
            })
            hName.node().append(header.name)
        } else {
            hName.text(header.name)
        }
        const hValue = h.append('input').attr('class', 'form-control tag-value')
        .attr('type', header.name === 'Date' ? 'date' : 'text').property('value', (header.name === 'Date') ? header.value.replace('.', '-') : header.value)
        if (!options.editable) hValue.attr('disabled', 'true')
        hValue.on('change', tags.changeListener)
        return h.node()
    },
    addListener(tagName: string, listener: (previousValue: string, newValue: string) => string) {
        tags.listeners.push({tagName, listener})
    },
    changeListener(event: Event) {
        const tagValue = (<HTMLInputElement>event.target)
        const tagName = tagValue.parentElement.getAttribute('data-tag')
        tags.set(tagName, tagValue.value)
    }
}

tags.addListener('Event', (prev, value) => (value === '' || value === null) ? '?' : value)
tags.addListener('Site', (prev, value) => (value === '' || value === null) ? '?' : value)
tags.addListener('Date', (prev, value) => (value === '' || value === null) ? '????.??.??' : value.replaceAll('-', '.'))
tags.addListener('Round', (prev, value) => (value === '' || value === null) ? '?' : value)
tags.addListener('White', (prev, value) => (value === '' || value === null) ? '?' : value)
tags.addListener('Black', (prev, value) => (value === '' || value === null) ? '?' : value)
tags.addListener('Result', (prev, value) => !['*','1-0','1/2-1/2','0-1'].includes(value) ? '*' : value)

document.getElementById('add_tag_name')?.addEventListener('change', ev => {
    const nameInput = <HTMLInputElement>document.getElementById('add_tag_name')
    const valueInput = <HTMLInputElement>document.getElementById('add_tag_value')
    const header: Header = {
        name: nameInput.value,
        value: valueInput.value
    }
    if (header.name === '') return
    if (state.selected.game === null) appendGame('new')
    if (state.selected.game.headers.some(h => h.name === header.name)) return
    tags.set(header.name, header.value)
    valueInput.value = ''
    nameInput.value = ''
})
