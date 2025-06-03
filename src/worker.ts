// Web Worker实现文件分片上传
// 需要将此文件单独编译为worker.js

import { WorkerMessage } from './type'

// 适配Worker环境
const ctx: Worker = self as any

ctx.onmessage = async function (e: MessageEvent) {
  const message: WorkerMessage = e.data

  // 处理上传消息 - 传统方式，直接在Worker中发送请求
  if (
    message.type === 'upload' &&
    message.fileId &&
    message.chunkInfo &&
    message.chunk &&
    message.uploadUrl
  ) {
    const { fileId, chunkInfo, chunk, uploadUrl } = message

    try {
      // 创建FormData对象
      const formData = new FormData()

      // 将Blob对象添加到FormData
      const blob = new Blob([chunk])
      formData.append('file', blob)
      formData.append('fileId', fileId)
      formData.append('partNumber', chunkInfo.partNumber.toString())

      // 验证上传URL
      if (!uploadUrl) {
        throw new Error('Upload URL is required for worker upload')
      }

      // 发送上传请求
      const response = await fetch(uploadUrl, {
        method: 'POST',
        body: formData,
        // 添加凭证支持，允许跨域请求携带cookie
        credentials: 'include',
      })

      if (!response.ok) {
        throw new Error(`HTTP error ${response.status}: ${response.statusText}`)
      }

      const result = await response.json()

      // 发送成功消息
      ctx.postMessage({
        type: 'response',
        fileId,
        chunkInfo,
        result,
      } as WorkerMessage)
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
  // 只处理数据的新方式，不发送请求
  else if (message.type === 'process' && message.fileId && message.chunkInfo) {
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
          partSize: chunkInfo.partSize, // 添加partSize字段，确保与主线程参数名一致
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
