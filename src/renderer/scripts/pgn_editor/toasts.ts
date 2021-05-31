import d3 = require("d3")

export const toasts = {
    showNew(type: 'error' | 'warning' | 'message', title: string, content: string, context: string, delay: number) {
        const textClass = type === 'error' ? 'text-danger' : (type === 'warning' ? 'text-warning' : '')
        if (type === 'error') title = 'Error: ' + title
        const t = d3.select('#toasts').append('div')
        .attr('class', 'toast show').attr('role', 'alert')
        const th = t.append('div').attr('class', 'toast-header')
        th.append('strong').attr('class', 'mr-auto ' + textClass).text(title)
        th.append('small').attr('class', 'text-muted').text(context)
        th.append('button').attr('type', 'button').attr('class', 'ml-2 mb-1 close').on('click', ev => {
            t.remove()
        }).append('span').html('&times;')
        t.append('div').attr('class', 'toast-body').text(content)
        if (delay > 0) {
            setTimeout(() => {
                t.remove()
            }, delay)
        }
    }
}
