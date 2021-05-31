import { ipcRenderer } from "electron"

export interface CustomResponse {
    id: number
    windowId: string
    channel: string
    args: any[]
    response: any | {error:Error | string}
}
export const promiseTraffic = {
    nextRequestId: 0,
    openRequests: [],
    request(windowId:string, channel: string, args: any[]): Promise<CustomResponse> {
        const request = {
            id: promiseTraffic.nextRequestId,
            windowId,
            channel,
            args
        }
        promiseTraffic.nextRequestId++
        const p = new Promise<CustomResponse>((resolve, reject) => {
            promiseTraffic.openRequests.push({
                request,
                resolve,
                reject
            })
        })
        ipcRenderer.send('custom-request', request)
        return p
    }
}
ipcRenderer.on('custom-response', (ev, response: CustomResponse) => {
    for (let i = 0; i < promiseTraffic.openRequests.length; i++) {
        const openRequest = promiseTraffic.openRequests[i]
        if (openRequest.request.id === response.id) {
            if (response.response.error) {
                openRequest.reject(response)
            } else {
                openRequest.resolve(response)
            }
            promiseTraffic.openRequests.splice(i, 1)
            break
        }
    }
})
