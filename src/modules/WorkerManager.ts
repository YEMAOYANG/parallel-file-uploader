import { WorkerMessage } from '../type'

/**
 * Worker管理器
 * 负责Web Worker的创建、调度和消息处理
 */
export class WorkerManager {
  /** Worker线程池 */
  private workerPool: Worker[] = []
  /** Worker忙碌状态映射表 */
  private workerBusy: Map<Worker, boolean> = new Map()
  /** Worker任务映射表 */
  private workerTasks: Map<Worker, { fileId: string; partNumber: number }> = new Map()
  
  /** 是否使用Worker */
  private useWorker: boolean
  /** 消息处理回调 */
  private onMessage?: (event: MessageEvent) => void
  /** Worker代码（inline方式） */
  private workerCode: string
  
  constructor(useWorker: boolean = true) {
    this.useWorker = useWorker
    this.workerCode = this.getInlineWorkerCode()
  }
  
  /**
   * 初始化Worker池
   */
  initialize(onMessage: (event: MessageEvent) => void): void {
    this.onMessage = onMessage
    
    if (!this.useWorker || typeof Worker === 'undefined') {
      console.log('Worker not supported or disabled')
      return
    }
    
    // 根据CPU核心数创建Worker
    const workerCount = Math.min(navigator.hardwareConcurrency || 4, 8)
    
    for (let i = 0; i < workerCount; i++) {
      try {
        const worker = this.createWorker()
        if (worker) {
          this.workerPool.push(worker)
          this.workerBusy.set(worker, false)
        }
      } catch (error) {
        console.error('Failed to create worker:', error)
        this.useWorker = false
        break
      }
    }
    
    console.log(`WorkerManager initialized with ${this.workerPool.length} workers`)
  }
  
  /**
   * 获取inline Worker代码
   */
  private getInlineWorkerCode(): string {
    return `
// Web Worker实现文件分片上传
const ctx = self;

ctx.onmessage = async function (e) {
  const message = e.data;

  // 处理上传消息 - 传统方式，直接在Worker中发送请求
  if (
    message.type === 'upload' &&
    message.fileId &&
    message.chunkInfo &&
    message.chunk &&
    message.uploadUrl
  ) {
    const { fileId, chunkInfo, chunk, uploadUrl } = message;

    try {
      // 创建FormData对象
      const formData = new FormData();

      // 将Blob对象添加到FormData
      const blob = new Blob([chunk]);
      formData.append('file', blob);
      formData.append('fileId', fileId);
      formData.append('partNumber', chunkInfo.partNumber.toString());

      // 验证上传URL
      if (!uploadUrl) {
        throw new Error('Upload URL is required for worker upload');
      }

      // 发送上传请求
      const response = await fetch(uploadUrl, {
        method: 'POST',
        body: formData,
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error(\`HTTP error \${response.status}: \${response.statusText}\`);
      }

      const result = await response.json();

      // 发送成功消息
      ctx.postMessage({
        type: 'response',
        fileId,
        chunkInfo,
        result,
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
  // 只处理数据的新方式，不发送请求
  else if (message.type === 'process' && message.fileId && message.chunkInfo) {
    const { fileId, chunkInfo } = message;
    try {
      // 将处理后的数据发送回主线程
      ctx.postMessage({
        type: 'response',
        fileId,
        chunkInfo,
        processed: true,
        result: {
          file: chunkInfo.file,
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
  // 处理中止消息
  else if (message.type === 'abort') {
    // Worker中止任务，暂时无操作
    console.log('Worker task aborted:', message.fileId);
  }
};

// 通知主线程Worker已经准备就绪
ctx.postMessage({ type: 'ready' });
`;
  }
  
  /**
   * 创建Worker实例
   */
  private createWorker(): Worker | null {
    try {
      let worker: Worker | null = null
      
      // 首先尝试使用外部文件加载Worker
      const workerPaths = [
        './worker.js',  // 相对于当前页面
        '/worker.js',   // 网站根目录
        './lib/worker.js',  // lib目录
        './dist/worker.js', // dist目录
        'worker.js'     // 同级目录
      ]
      
      for (const path of workerPaths) {
        try {
          worker = new Worker(path)
          console.log(`Worker created with path: ${path}`)
          break
        } catch (error) {
          // 继续尝试下一个路径
          continue
        }
      }
      
      // 如果所有路径都失败，使用inline Worker
      if (!worker) {
        console.log('Using inline worker as fallback')
        const blob = new Blob([this.workerCode], { type: 'application/javascript' })
        const workerUrl = URL.createObjectURL(blob)
        worker = new Worker(workerUrl)
        
        // 设置清理函数
        worker.addEventListener('error', () => {
          URL.revokeObjectURL(workerUrl)
        })
        
        worker.addEventListener('message', (e) => {
          if (e.data.type === 'ready') {
            URL.revokeObjectURL(workerUrl)
          }
        })
      }
      
      if (!worker) {
        throw new Error('Failed to create worker with all methods')
      }
      
      // 设置消息处理器
      worker.onmessage = (event) => {
        // 标记Worker为空闲
        this.workerBusy.set(worker!, false)
        this.workerTasks.delete(worker!)
        
        // 调用回调
        if (this.onMessage) {
          this.onMessage(event)
        }
      }
      
      worker.onerror = (error) => {
        console.error('Worker error:', error)
        // 标记Worker为空闲
        this.workerBusy.set(worker!, false)
        this.workerTasks.delete(worker!)
        
        // 如果Worker错误太多，禁用Worker功能
        this.handleWorkerError(worker!)
      }
      
      return worker
    } catch (error) {
      console.error('Failed to create worker:', error)
      return null
    }
  }
  
  /**
   * 处理Worker错误
   */
  private handleWorkerError(worker: Worker): void {
    // 从池中移除错误的Worker
    const index = this.workerPool.indexOf(worker)
    if (index > -1) {
      this.workerPool.splice(index, 1)
      this.workerBusy.delete(worker)
      this.workerTasks.delete(worker)
      worker.terminate()
    }
    
    // 如果Worker池为空，禁用Worker功能
    if (this.workerPool.length === 0) {
      console.warn('All workers failed, disabling worker functionality')
      this.useWorker = false
    }
  }
  
  /**
   * 获取可用的Worker
   */
  getAvailableWorker(): Worker | null {
    for (const [worker, busy] of this.workerBusy.entries()) {
      if (!busy) {
        return worker
      }
    }
    return null
  }
  
  /**
   * 发送任务到Worker
   */
  postTask(message: WorkerMessage): boolean {
    if (!this.isEnabled()) {
      return false
    }
    
    const worker = this.getAvailableWorker()
    if (!worker) {
      return false
    }
    
    try {
      // 标记Worker为忙碌
      this.workerBusy.set(worker, true)
      
      // 记录任务信息
      if (message.fileId && message.chunkInfo) {
        this.workerTasks.set(worker, {
          fileId: message.fileId,
          partNumber: message.chunkInfo.partNumber
        })
      }
      
      // 发送消息
      worker.postMessage(message)
      return true
    } catch (error) {
      console.error('Failed to post message to worker:', error)
      // 标记Worker为空闲
      this.workerBusy.set(worker, false)
      this.workerTasks.delete(worker)
      return false
    }
  }
  
  /**
   * 中止Worker任务
   */
  abortTask(fileId: string, partNumber?: number): void {
    for (const [worker, task] of this.workerTasks.entries()) {
      if (task.fileId === fileId && (!partNumber || task.partNumber === partNumber)) {
        try {
          // 发送中止消息
          const message: WorkerMessage = {
            type: 'abort',
            fileId,
            chunkInfo: partNumber ? { partNumber } as any : undefined
          }
          worker.postMessage(message)
        } catch (error) {
          console.error('Failed to send abort message:', error)
        }
        
        // 标记为空闲
        this.workerBusy.set(worker, false)
        this.workerTasks.delete(worker)
      }
    }
  }
  
  /**
   * 中止文件的所有任务
   */
  abortFileTasks(fileId: string): void {
    this.abortTask(fileId)
  }
  
  /**
   * 获取Worker池大小
   */
  getPoolSize(): number {
    return this.workerPool.length
  }
  
  /**
   * 获取忙碌的Worker数量
   */
  getBusyCount(): number {
    let count = 0
    for (const busy of this.workerBusy.values()) {
      if (busy) count++
    }
    return count
  }
  
  /**
   * 检查是否启用了Worker
   */
  isEnabled(): boolean {
    return this.useWorker && this.workerPool.length > 0
  }
  
  /**
   * 重试创建Worker池
   */
  retryInitialize(): boolean {
    if (this.workerPool.length > 0) {
      return true
    }
    
    console.log('Retrying worker initialization...')
    const worker = this.createWorker()
    if (worker) {
      this.workerPool.push(worker)
      this.workerBusy.set(worker, false)
      this.useWorker = true
      return true
    }
    
    return false
  }
  
  /**
   * 销毁所有Worker
   */
  destroy(): void {
    for (const worker of this.workerPool) {
      try {
        worker.terminate()
      } catch (error) {
        console.error('Error terminating worker:', error)
      }
    }
    this.workerPool = []
    this.workerBusy.clear()
    this.workerTasks.clear()
  }
} 