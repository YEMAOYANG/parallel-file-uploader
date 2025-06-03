/**
 * 速度限制器
 * 使用令牌桶算法控制上传速度
 */
export class SpeedLimiter {
  private maxBytesPerSecond: number
  private bucket: number
  private lastRefill: number
  private enabled: boolean

  constructor(maxBytesPerSecond: number = 0, enabled: boolean = false) {
    this.maxBytesPerSecond = maxBytesPerSecond
    this.bucket = maxBytesPerSecond
    this.lastRefill = Date.now()
    this.enabled = enabled
  }

  /**
   * 启用/禁用速度限制
   */
  setEnabled(enabled: boolean): void {
    this.enabled = enabled
  }

  /**
   * 检查是否启用
   */
  isEnabled(): boolean {
    return this.enabled
  }

  /**
   * 设置最大上传速度
   */
  setMaxBytesPerSecond(maxBytesPerSecond: number): void {
    this.maxBytesPerSecond = maxBytesPerSecond
    this.bucket = Math.min(this.bucket, maxBytesPerSecond)
  }

  /**
   * 获取当前速度限制
   */
  getMaxBytesPerSecond(): number {
    return this.maxBytesPerSecond
  }

  /**
   * 请求发送指定字节数的数据
   * 返回需要等待的毫秒数
   */
  async requestBytes(bytes: number): Promise<number> {
    if (!this.enabled || this.maxBytesPerSecond <= 0) {
      return 0
    }

    // 重新填充令牌桶
    this.refillBucket()

    if (bytes <= this.bucket) {
      // 有足够的令牌，直接消费
      this.bucket -= bytes
      return 0
    } else {
      // 令牌不足，计算需要等待的时间
      const deficit = bytes - this.bucket
      const waitTime = Math.ceil((deficit / this.maxBytesPerSecond) * 1000)
      
      // 等待后消费所有令牌
      this.bucket = 0
      
      return waitTime
    }
  }

  /**
   * 等待指定的延迟时间
   */
  async wait(delayMs: number): Promise<void> {
    if (delayMs > 0) {
      await new Promise(resolve => setTimeout(resolve, delayMs))
    }
  }

  /**
   * 重新填充令牌桶
   */
  private refillBucket(): void {
    const now = Date.now()
    const timePassed = (now - this.lastRefill) / 1000 // 转换为秒
    
    if (timePassed > 0) {
      const tokensToAdd = timePassed * this.maxBytesPerSecond
      this.bucket = Math.min(this.bucket + tokensToAdd, this.maxBytesPerSecond)
      this.lastRefill = now
    }
  }

  /**
   * 重置令牌桶
   */
  reset(): void {
    this.bucket = this.maxBytesPerSecond
    this.lastRefill = Date.now()
  }

  /**
   * 获取当前令牌桶状态
   */
  getStatus(): {
    bucket: number
    maxBytesPerSecond: number
    enabled: boolean
    utilizationPercent: number
  } {
    this.refillBucket()
    
    return {
      bucket: this.bucket,
      maxBytesPerSecond: this.maxBytesPerSecond,
      enabled: this.enabled,
      utilizationPercent: this.maxBytesPerSecond > 0 
        ? Math.round(((this.maxBytesPerSecond - this.bucket) / this.maxBytesPerSecond) * 100)
        : 0
    }
  }
} 