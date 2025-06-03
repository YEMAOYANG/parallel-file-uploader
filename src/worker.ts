/**
 * Web Worker 文件分片处理器
 * 专门负责数据处理，不进行网络请求
 */

/**
 * 工作器消息处理器
 * @param e 消息事件
 */
onmessage = async function (e: MessageEvent) {
  const message = e.data;

  try {
    // 处理所有包含文件数据的消息
    if (message.fileId && message.chunkInfo) {
      const { fileId, chunkInfo } = message;
      
      // 这里可以进行更复杂的数据处理
      // 目前简单返回处理后的数据
      const result = {
        file: chunkInfo.file, // 返回处理后的Blob
        partNumber: chunkInfo.partNumber,
        partSize: chunkInfo.partSize,
        processedAt: Date.now()
      };

      // 将处理后的数据发送回主线程
      postMessage({
        type: 'response',
        fileId,
        chunkInfo,
        processed: true,
        result
      });
    }
  } catch (error) {
    // 发送错误消息
    postMessage({
      type: 'error',
      fileId: message.fileId,
      chunkInfo: message.chunkInfo,
      error: error instanceof Error ? error.message : String(error)
    });
  }
};

// 通知主线程Worker已经准备就绪
postMessage({ type: 'ready' }); 