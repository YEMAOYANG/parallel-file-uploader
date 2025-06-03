/**
 * 速度限制器
 * 实现上传速度限制功能
 */
export class SpeedLimiter {
  /** 速度限制（字节/秒），0表示不限制 */
  private speedLimit: number = 0
  
  /** 令牌桶 */
  private tokens: number = 0
  
  /** 最大令牌数 */
  private maxTokens: number = 0
  
  /** 上次更新时间 */
  private lastUpdateTime: number = Date.now()
  
  /** 是否启用速度限制 */
  private enabled: boolean = false
  
  /** 等待队列 */
  private waitQueue: Array<{
    bytes: number
    resolve: (allowed: number) => void
    timestamp: number
  }> = []
  
  /** 更新定时器 */
  private updateTimer?: number
  
  constructor(speedLimit: number = 0, enabled: boolean = false) {
    this.setSpeedLimit(speedLimit)
    this.enabled = enabled
    
    if (this.enabled && this.speedLimit > 0) {
      this.start()
    }
  }
  
  /**
   * 设置速度限制
   */
  setSpeedLimit(bytesPerSecond: number): void {
    this.speedLimit = Math.max(0, bytesPerSecond)
    this.maxTokens = this.speedLimit
    this.tokens = Math.min(this.tokens, this.maxTokens)
  }
  
  /**
   * 获取当前速度限制
   */
  getSpeedLimit(): number {
    return this.speedLimit
  }
  
  /**
   * 启用/禁用速度限制
   */
  setEnabled(enabled: boolean): void {
    this.enabled = enabled
    
    if (this.enabled && this.speedLimit > 0) {
      this.start()
    } else {
      this.stop()
      // 释放所有等待的请求
      this.releaseAllWaiting()
    }
  }
  
  /**
   * 检查是否启用
   */
  isEnabled(): boolean {
    return this.enabled && this.speedLimit > 0
  }
  
  /**
   * 请求上传字节数
   * @returns Promise<number> 返回允许上传的字节数
   */
  async requestBytes(bytes: number): Promise<number> {
    if (!this.isEnabled()) {
      return bytes
    }
    
    // 更新令牌
    this.updateTokens()
    
    // 如果有足够的令牌，立即返回
    if (this.tokens >= bytes) {
      this.tokens -= bytes
      return bytes
    }
    
    // 如果部分令牌可用，返回可用部分
    if (this.tokens > 0) {
      const allowed = Math.floor(this.tokens)
      this.tokens -= allowed
      return allowed
    }
    
    // 没有可用令牌，加入等待队列
    return new Promise<number>((resolve) => {
      this.waitQueue.push({
        bytes,
        resolve,
        timestamp: Date.now()
      })
    })
  }
  
  /**
   * 更新令牌
   */
  private updateTokens(): void {
    const now = Date.now()
    const elapsed = (now - this.lastUpdateTime) / 1000 // 转换为秒
    
    if (elapsed > 0) {
      // 根据经过的时间添加令牌
      const newTokens = elapsed * this.speedLimit
      this.tokens = Math.min(this.tokens + newTokens, this.maxTokens)
      this.lastUpdateTime = now
    }
  }
  
  /**
   * 处理等待队列
   */
  private processWaitQueue(): void {
    if (!this.isEnabled() || this.waitQueue.length === 0) return
    
    this.updateTokens()
    
    const now = Date.now()
    const maxWaitTime = 30000 // 最大等待30秒
    
    // 处理等待队列
    const newQueue: typeof this.waitQueue = []
    
    for (const request of this.waitQueue) {
      // 检查是否超时
      if (now - request.timestamp > maxWaitTime) {
        request.resolve(0) // 超时返回0
        continue
      }
      
      if (this.tokens >= request.bytes) {
        // 有足够的令牌
        this.tokens -= request.bytes
        request.resolve(request.bytes)
      } else if (this.tokens > 0) {
        // 部分令牌可用
        const allowed = Math.floor(this.tokens)
        this.tokens -= allowed
        request.resolve(allowed)
      } else {
        // 没有令牌，继续等待
        newQueue.push(request)
      }
    }
    
    this.waitQueue = newQueue
  }
  
  /**
   * 释放所有等待的请求
   */
  private releaseAllWaiting(): void {
    for (const request of this.waitQueue) {
      request.resolve(request.bytes)
    }
    this.waitQueue = []
  }
  
  /**
   * 开始速度限制
   */
  private start(): void {
    if (this.updateTimer) return
    
    // 初始化令牌
    this.tokens = this.maxTokens
    this.lastUpdateTime = Date.now()
    
    // 定期处理等待队列
    this.updateTimer = window.setInterval(() => {
      this.processWaitQueue()
    }, 100) // 每100ms处理一次
  }
  
  /**
   * 停止速度限制
   */
  private stop(): void {
    if (this.updateTimer) {
      clearInterval(this.updateTimer)
      this.updateTimer = undefined
    }
  }
  
  /**
   * 获取等待队列长度
   */
  getQueueLength(): number {
    return this.waitQueue.length
  }
  
  /**
   * 获取当前可用令牌数
   */
  getAvailableTokens(): number {
    this.updateTokens()
    return Math.floor(this.tokens)
  }
  
  /**
   * 重置速度限制器
   */
  reset(): void {
    this.tokens = this.maxTokens
    this.lastUpdateTime = Date.now()
    this.releaseAllWaiting()
  }
  
  /**
   * 销毁速度限制器
   */
  destroy(): void {
    this.stop()
    this.releaseAllWaiting()
  }
  
  /**
   * 计算延迟时间
   * @param bytes 需要的字节数
   * @returns 需要等待的毫秒数
   */
  calculateDelay(bytes: number): number {
    if (!this.isEnabled()) return 0
    
    this.updateTokens()
    
    if (this.tokens >= bytes) {
      return 0
    }
    
    const neededTokens = bytes - this.tokens
    const delay = (neededTokens / this.speedLimit) * 1000 // 转换为毫秒
    
    return Math.ceil(delay)
  }
} 