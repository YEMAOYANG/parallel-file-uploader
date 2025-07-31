import { WorkerMessage } from '../type'

/**
 * Worker管理器
 * 管理Web Worker线程池，处理数据分片处理
 */
export class WorkerManager {
  private workerPool: Worker[] = []
  private workerBusy: Map<Worker, boolean> = new Map()
  private messageHandlers: Map<Worker, (event: MessageEvent) => void> = new Map()

  constructor() {
    this.initializeWorkers()
  }

  /**
   * 创建Worker实例
   */
  private createWorker(): Worker {
    // 在浏览器环境中，创建内联Worker
    if (typeof window !== 'undefined' && typeof Blob !== 'undefined') {
      try {
        // 创建包含worker代码的内联Worker
        const workerCode = `
          // Web Worker实现文件分片处理
          // 专门负责数据处理，不进行网络请求

          // 适配Worker环境
          const ctx = self;

          ctx.onmessage = async function (e) {
            const message = e.data;

            // 处理所有包含文件数据的消息
            if (message.fileId && message.chunkInfo) {
              const { fileId, chunkInfo } = message;
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
                });
              } catch (error) {
                // 发送错误消息
                ctx.postMessage({
                  type: 'error',
                  fileId,
                  chunkInfo,
                  error: error instanceof Error ? error.message : String(error),
                });
              }
            }
          };

          // 通知主线程Worker已经准备就绪
          ctx.postMessage({ type: 'ready' });
        `;
        
        const blob = new Blob([workerCode], { type: 'application/javascript' });
        const workerUrl = URL.createObjectURL(blob);
        const worker = new Worker(workerUrl);
        
        // 清理Blob URL（可选，但是好的实践）
        worker.addEventListener('message', () => {
          URL.revokeObjectURL(workerUrl);
        }, { once: true });
        
        return worker;
      } catch (e) {
        console.warn('Failed to create inline worker:', e);
      }
    }

    // 回退方案：尝试加载外部worker文件
    try {
      // 在开发环境中，尝试加载编译后的文件
      return new Worker('./lib/worker.js');
    } catch (e) {
      try {
        // 生产环境的另一个路径
        return new Worker('/lib/worker.js');
      } catch (e2) {
        // 最终回退
        return new Worker('./worker.js');
      }
    }
  }

  /**
   * 初始化Worker池
   */
  private initializeWorkers(): void {
    if (typeof Worker === 'undefined') {
      console.warn('Web Workers not supported in this environment')
      return
    }

    // 在测试环境中跳过Worker初始化
    if (typeof process !== 'undefined' && process.env && process.env.NODE_ENV === 'test') {
      console.log('Skipping worker initialization in test environment')
      return
    }

    const workerCount = Math.min(navigator.hardwareConcurrency || 4, 8)
    
    for (let i = 0; i < workerCount; i++) {
      try {
        const worker = this.createWorker()

        const messageHandler = this.createMessageHandler.bind(this)
        worker.onmessage = messageHandler
        
        this.workerPool.push(worker)
        this.workerBusy.set(worker, false)
        this.messageHandlers.set(worker, messageHandler)
      } catch (error) {
        console.error('Failed to create worker:', error)
        break
      }
    }

    console.log(`Initialized ${this.workerPool.length} workers`)
  }

  /**
   * 创建消息处理器
   */
  private createMessageHandler(event: MessageEvent): void {
    const message: WorkerMessage = event.data
    const worker = event.target as Worker

    // 处理Worker就绪消息
    if (message.type === 'ready') {
      console.log('Worker ready')
      this.workerBusy.set(worker, false)
      return
    }

    // 标记Worker为可用
    this.workerBusy.set(worker, false)

    // 触发全局消息处理器
    if (this.globalMessageHandler) {
      this.globalMessageHandler(event)
    }
  }

  private globalMessageHandler?: (event: MessageEvent) => void

  /**
   * 设置全局消息处理器
   */
  setMessageHandler(handler: (event: MessageEvent) => void): void {
    this.globalMessageHandler = handler
  }

  /**
   * 获取可用的Worker
   */
  getAvailableWorker(): Worker | null {
    for (const worker of this.workerPool) {
      if (!this.workerBusy.get(worker)) {
        return worker
      }
    }
    return null
  }

  /**
   * 标记Worker为忙碌
   */
  markWorkerBusy(worker: Worker): void {
    this.workerBusy.set(worker, true)
  }

  /**
   * 标记Worker为空闲
   */
  markWorkerIdle(worker: Worker): void {
    this.workerBusy.set(worker, false)
  }

  /**
   * 向Worker发送消息
   */
  postMessage(worker: Worker, message: WorkerMessage, transferable?: Transferable[]): void {
    if (transferable) {
      worker.postMessage(message, transferable)
    } else {
      worker.postMessage(message)
    }
  }

  /**
   * 检查是否有可用的Worker
   */
  hasAvailableWorker(): boolean {
    return this.getAvailableWorker() !== null
  }

  /**
   * 获取Worker池统计信息
   */
  getStats(): {
    total: number
    busy: number
    idle: number
  } {
    const total = this.workerPool.length
    let busy = 0
    
    for (const worker of this.workerPool) {
      if (this.workerBusy.get(worker)) {
        busy++
      }
    }

    return {
      total,
      busy,
      idle: total - busy
    }
  }

  /**
   * 销毁所有Worker
   */
  destroy(): void {
    for (const worker of this.workerPool) {
      worker.terminate()
    }
    
    this.workerPool = []
    this.workerBusy.clear()
    this.messageHandlers.clear()
    this.globalMessageHandler = undefined
  }

  /**
   * 🔧 检查是否支持 Web Worker
   */
  isSupported(): boolean {
    return typeof Worker !== 'undefined' && typeof window !== 'undefined'
  }
} 