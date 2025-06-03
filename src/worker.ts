// Web Worker实现文件分片处理
// 专门负责数据处理，不进行网络请求

import { WorkerMessage } from './type'

// 适配Worker环境
const ctx: Worker = self as any

ctx.onmessage = async function (e: MessageEvent) {
  const message: WorkerMessage = e.data

  // 处理所有包含文件数据的消息
  if (message.fileId && message.chunkInfo) {
    const { fileId, chunkInfo } = message
    try {
      // 将处理后的数据发送回主线程
      ctx.postMessage({
        type: 'response',
        fileId,
        chunkInfo,
        processed: true,
        result: {
          file: chunkInfo.file, // 返回处理后的Blob
          partNumber: chunkInfo.partNumber,
          partSize: chunkInfo.partSize,
        },
      })
    } catch (error) {
      // 发送错误消息
      ctx.postMessage({
        type: 'error',
        fileId,
        chunkInfo,
        error: error instanceof Error ? error.message : String(error),
      } as WorkerMessage)
    }
  }
}

// 通知主线程Worker已经准备就绪
ctx.postMessage({ type: 'ready' })
