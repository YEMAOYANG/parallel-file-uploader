import { SpeedLimiter } from '../src/modules/SpeedLimiter'

describe('SpeedLimiter', () => {
  let speedLimiter: SpeedLimiter
  
  beforeEach(() => {
    jest.useFakeTimers()
  })
  
  afterEach(() => {
    jest.useRealTimers()
    if (speedLimiter) {
      speedLimiter.destroy()
    }
  })
  
  describe('基本功能', () => {
    it('应该在未启用时允许任意速度', async () => {
      speedLimiter = new SpeedLimiter(1000, false) // 1KB/s，但未启用
      
      const allowed = await speedLimiter.requestBytes(10000) // 请求10KB
      expect(allowed).toBe(10000)
    })
    
    it('应该在速度限制为0时允许任意速度', async () => {
      speedLimiter = new SpeedLimiter(0, true) // 无限制
      
      const allowed = await speedLimiter.requestBytes(10000)
      expect(allowed).toBe(10000)
    })
  })
  
  describe('速度限制', () => {
    it('应该限制上传速度', async () => {
      speedLimiter = new SpeedLimiter(1000, true) // 1KB/s
      
      // 第一次请求应该成功（初始令牌桶是满的）
      const allowed1 = await speedLimiter.requestBytes(1000)
      expect(allowed1).toBe(1000)
      
      // 第二次请求应该被限制
      const promise = speedLimiter.requestBytes(1000)
      
      // 推进时间1秒，让令牌桶重新填充
      jest.advanceTimersByTime(1000)
      
      const allowed2 = await promise
      expect(allowed2).toBeGreaterThan(0)
    })
    
    it('应该正确计算延迟时间', () => {
      speedLimiter = new SpeedLimiter(1000, true) // 1KB/s
      
      // 消耗所有令牌
      speedLimiter.requestBytes(1000)
      
      // 计算需要2KB的延迟
      const delay = speedLimiter.calculateDelay(2000)
      expect(delay).toBe(2000) // 需要等待2秒
    })
  })
  
  describe('令牌桶算法', () => {
    it('应该随时间累积令牌', async () => {
      speedLimiter = new SpeedLimiter(1000, true) // 1KB/s
      
      // 消耗所有令牌
      await speedLimiter.requestBytes(1000)
      expect(speedLimiter.getAvailableTokens()).toBe(0)
      
      // 0.5秒后应该有500个令牌
      jest.advanceTimersByTime(500)
      expect(speedLimiter.getAvailableTokens()).toBeCloseTo(500, 0)
      
      // 再过0.5秒应该有1000个令牌（达到上限）
      jest.advanceTimersByTime(500)
      expect(speedLimiter.getAvailableTokens()).toBe(1000)
    })
    
    it('应该不超过最大令牌数', async () => {
      speedLimiter = new SpeedLimiter(1000, true) // 1KB/s
      
      // 等待足够长的时间
      jest.advanceTimersByTime(5000)
      
      // 令牌数不应超过限制
      expect(speedLimiter.getAvailableTokens()).toBe(1000)
    })
  })
  
  describe('动态配置', () => {
    it('应该支持动态修改速度限制', async () => {
      speedLimiter = new SpeedLimiter(1000, true) // 初始1KB/s
      
      // 消耗初始令牌
      await speedLimiter.requestBytes(1000)
      
      // 修改为2KB/s
      speedLimiter.setSpeedLimit(2000)
      
      // 推进时间让令牌重新填充
      jest.advanceTimersByTime(1000)
      
      // 应该能使用新的限制
      const allowed = await speedLimiter.requestBytes(2000)
      expect(allowed).toBe(2000)
    })
    
    it('应该支持启用/禁用速度限制', async () => {
      speedLimiter = new SpeedLimiter(1000, true)
      
      // 禁用速度限制
      speedLimiter.setEnabled(false)
      
      // 应该允许任意速度
      const allowed = await speedLimiter.requestBytes(10000)
      expect(allowed).toBe(10000)
      
      // 重新启用
      speedLimiter.setEnabled(true)
      
      // 应该重新开始限制
      const allowed2 = await speedLimiter.requestBytes(2000)
      expect(allowed2).toBeLessThanOrEqual(1000)
    })
  })
  
  describe('等待队列', () => {
    it('应该维护等待队列', () => {
      speedLimiter = new SpeedLimiter(1000, true)
      
      // 消耗所有令牌
      speedLimiter.requestBytes(1000)
      
      // 添加多个请求到队列
      speedLimiter.requestBytes(500)
      speedLimiter.requestBytes(300)
      speedLimiter.requestBytes(200)
      
      expect(speedLimiter.getQueueLength()).toBe(3)
    })
    
    it('应该在销毁时释放所有等待的请求', async () => {
      speedLimiter = new SpeedLimiter(1000, true)
      
      // 消耗所有令牌
      await speedLimiter.requestBytes(1000)
      
      // 添加等待请求
      const promises = [
        speedLimiter.requestBytes(500),
        speedLimiter.requestBytes(300)
      ]
      
      // 销毁速度限制器
      speedLimiter.destroy()
      
      // 所有请求应该立即返回
      const results = await Promise.all(promises)
      expect(results[0]).toBe(500)
      expect(results[1]).toBe(300)
    })
  })
}) 