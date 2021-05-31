import axios, { AxiosRequestConfig } from "axios";
import { customResponseFunctions, windows } from "./sharedstate";
import { getWindowByID } from "./windows";

const reqDelay = 2000
const timeoutReqDelay = 1000 * 60 * 5

const liclient = {
    waiting: false,
    instance: axios.create({
        baseURL: 'https://lichess.org',
        timeout: 10000,
    }),
    requestQueue: <{r: AxiosRequestConfig, resolve: (value: unknown) => void, reject: (reason?: any) => void, maxCacheAge: number}[]>[],
    cache: new Map<string, {expiration: number, value: any}>(),
    queue(r: AxiosRequestConfig, resolve: (value: unknown) => void, reject: (reason?: any) => void, maxCacheAge: number = Number.POSITIVE_INFINITY) {
        liclient.requestQueue.push({r, resolve, reject, maxCacheAge})
        if (liclient.requestQueue.length === 1 && !liclient.waiting) {
            liclient.nextRequest()
        }
    },
    nextRequest() {
        if (liclient.requestQueue.length === 0 || liclient.waiting) return
        const next = liclient.requestQueue.shift()
        const uri = liclient.instance.getUri(next.r)
        console.log(`LiClient Request: ${uri}`)
        if (liclient.cache.has(uri) && Date.now() < liclient.cache.get(uri).expiration) {
            if (liclient.cache.get(uri).value?.error === 404) {
                next.reject(new Error('Request failed with status code 404'))
            } else {
                next.resolve(liclient.cache.get(uri).value)
            }
            liclient.nextRequest()
        } else {
            liclient.waiting = true
            let delay = reqDelay
            liclient.instance.request(next.r).then(response => {
                if (response.status < 200 || response.status >= 300) {
                    if (response.status === 429) {
                        console.log('Too many requests: ' + response.data)
                        delay = timeoutReqDelay
                    }
                    throw new Error(`HTTP ${response.status}: ${response.statusText}`)
                }
                liclient.cache.set(uri, {
                    expiration: Date.now() + next.maxCacheAge,
                    value: response.data
                })
                next.resolve(response.data)
            }).catch(err => {
                console.log(`LiClient Error: ${err.message}`)
                if (err.message === 'Request failed with status code 404') {
                    liclient.cache.set(uri, {
                        expiration: Date.now() + next.maxCacheAge,
                        value: { error: 404 }
                    })
                }
                next.reject(err)
            }).finally(() => {
                if (liclient.requestQueue.length > 0) {
                    setTimeout(() => {
                        liclient.waiting = false
                        liclient.nextRequest()
                    }, delay)
                } else {
                    liclient.waiting = false
                }
            })
        }
    },
}

customResponseFunctions.set('li-eval', async (fen: string, multiPv: number = 3) => {
    return await new Promise((resolve, reject) => {
        liclient.queue({
            url: '/api/cloud-eval',
            params: {
                'fen': fen,
                'multiPv': multiPv+'',
            }
        }, resolve, reject, 1000 * 60 * 60 * 24)
    })
})
customResponseFunctions.set('li-tablebase', async (fen: string) => {
    return await new Promise((resolve, reject) => {
        liclient.queue({
            baseURL: 'http://tablebase.lichess.ovh',
            url: '/standard',
            params: {
                'fen': fen.replaceAll(' ', '_')
            }
        }, resolve, reject)
    })
})
customResponseFunctions.set('li-opening', async (source: 'master' | 'lichess', fen: string, moves: number, games: number = 0) => {
    if (games > 4) games = 4
    return await new Promise((resolve, reject) => {
        liclient.queue({
            baseURL: 'https://explorer.lichess.ovh',
            url: '/' + source,
            params: {
                'fen': fen,
                'moves': moves+'',
                'topGames': games+''
            }
        }, resolve, reject, 1000 * 60 * 10)
    })
})

customResponseFunctions.set('li-tournament-games', async (windowId: string, id: string, type: 'swiss' | 'tournament', clocks: boolean, evals: boolean, opening: boolean) => {
    return await new Promise((resolve, reject) => {
        liclient.queue({
            url: '/api/' + type + '/' + id + '/games',
            headers: {
                'Content-type': 'application/x-chess-pgn'
            },
            params: {
                clocks,
                evals,
                opening
            },
            onDownloadProgress: (ev: ProgressEvent) => {
                const w = getWindowByID(windowId)
                if (!w) return
                w.webContents.send('progress', ev.loaded / ev.total, windowId+'liclient_li-tournament-games')
            }
        }, resolve, reject, 0)
    })
})
customResponseFunctions.set('li-studies-user', async (windowId: string, username: string, clocks: boolean, comments: boolean, variations: boolean) => {
    return await new Promise((resolve, reject) => {
        liclient.queue({
            url: '/study/by/' + username.toLowerCase() + '/export.pgn',
            params: {
                clocks,
                comments,
                variations
            },
            onDownloadProgress: (ev: ProgressEvent) => {
                const w = getWindowByID(windowId)
                if (!w) return
                w.webContents.send('progress', ev.loaded / ev.total, windowId+'liclient_li-studies-user')
            }
        }, resolve, reject, 0)
    })
})
customResponseFunctions.set('li-study', async (windowId: string, id: string, clocks: boolean, comments: boolean, variations: boolean) => {
    return await new Promise((resolve, reject) => {
        liclient.queue({
            url: '/study/' + id + '.pgn',
            params: {
                clocks,
                comments,
                variations
            },
            onDownloadProgress: (ev: ProgressEvent) => {
                const w = getWindowByID(windowId)
                if (!w) return
                w.webContents.send('progress', ev.loaded / ev.total, windowId+'liclient_li-study')
            }
        }, resolve, reject, 0)
    })
})
customResponseFunctions.set('li-chapter', async (windowId: string, studyId: string, chapterId: string, clocks: boolean, comments: boolean, variations: boolean) => {
    return await new Promise((resolve, reject) => {
        liclient.queue({
            url: '/study/' + studyId + '/' + chapterId + '.pgn',
            params: {
                clocks,
                comments,
                variations
            },
            onDownloadProgress: (ev: ProgressEvent) => {
                const w = getWindowByID(windowId)
                if (!w) return
                w.webContents.send('progress', ev.loaded / ev.total, windowId+'liclient_li-chapter')
            }
        }, resolve, reject, 0)
    })
})
customResponseFunctions.set('li-games', async (windowId: string, idList: string, clocks: boolean, evals: boolean, opening: boolean) => {
    idList = idList.replaceAll(' ', '')
    return await new Promise((resolve, reject) => {
        liclient.queue({
            url: '/games/export/_ids',
            method: 'post',
            headers: {
                'Content-type': 'application/x-chess-pgn'
            },
            params: {
                clocks,
                evals,
                opening
            },
            data: idList,
            onDownloadProgress: (ev: ProgressEvent) => {
                const w = getWindowByID(windowId)
                if (!w) return
                w.webContents.send('progress', ev.loaded / ev.total, windowId+'liclient_li-games')
            }
        }, resolve, reject, 0)
    })
})
customResponseFunctions.set('li-user-games', async (windowId: string, username: string, 
    since: number | undefined, until: number | undefined, max: number | null, 
    vs: string | undefined, rated: boolean | null, perfs: string[], color: string | null,
    analysed: boolean | null, clocks: boolean, evals: boolean, opening: boolean) => {
    return await new Promise((resolve, reject) => {
        liclient.queue({
            timeout: 600000,
            responseType: 'stream',
            url: '/api/games/user/' + username.toLowerCase(),
            headers: {
                'Content-type': 'application/x-chess-pgn'
            },
            params: {
                since, until,
                max, vs, rated,
                analysed, color,
                perfType: perfs.length > 0 ? perfs.join(',') : undefined,
                clocks, evals, opening
            },
            onDownloadProgress: (ev: ProgressEvent) => {
                const w = getWindowByID(windowId)
                if (!w) return
                w.webContents.send('progress', ev.loaded / ev.total, windowId+'liclient_li-user-games')
            }
        }, resolve, reject, 0)
    })
})
