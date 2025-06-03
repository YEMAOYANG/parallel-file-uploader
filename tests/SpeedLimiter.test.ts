import { SpeedLimiter } from '../src/modules/SpeedLimiter'

describe('SpeedLimiter', () => {
  let speedLimiter: SpeedLimiter
  
  beforeEach(() => {
    jest.useFakeTimers()
  })
  
  afterEach(() => {
    jest.useRealTimers()
  })
  
  describe('基本功能', () => {
    it('应该在未启用时不限制速度', async () => {
      speedLimiter = new SpeedLimiter(1000, false) // 1KB/s，但未启用
      
      const delay = await speedLimiter.requestBytes(10000) // 请求10KB
      expect(delay).toBe(0) // 无延迟
    })
    
    it('应该在速度限制为0时不限制速度', async () => {
      speedLimiter = new SpeedLimiter(0, true) // 无限制
      
      const delay = await speedLimiter.requestBytes(10000)
      expect(delay).toBe(0) // 无延迟
    })
  })
  
  describe('速度限制', () => {
    it('应该在有足够令牌时无延迟', async () => {
      speedLimiter = new SpeedLimiter(1000, true) // 1KB/s
      
      // 第一次请求应该成功（初始令牌桶是满的）
      const delay1 = await speedLimiter.requestBytes(1000)
      expect(delay1).toBe(0)
      
      // 第二次请求应该需要等待
      const delay2 = await speedLimiter.requestBytes(1000)
      expect(delay2).toBeGreaterThan(0)
    })
    
    it('应该正确计算等待时间', async () => {
      speedLimiter = new SpeedLimiter(1000, true) // 1KB/s
      
      // 消耗所有令牌
      await speedLimiter.requestBytes(1000)
      
      // 请求需要2秒的数据量
      const delay = await speedLimiter.requestBytes(2000)
      expect(delay).toBeGreaterThan(1000) // 应该需要超过1秒的等待
    })
  })
  
  describe('令牌桶状态', () => {
    it('应该正确返回令牌桶状态', () => {
      speedLimiter = new SpeedLimiter(1000, true) // 1KB/s
      
      const status = speedLimiter.getStatus()
      expect(status).toHaveProperty('bucket')
      expect(status).toHaveProperty('maxBytesPerSecond')
      expect(status).toHaveProperty('enabled')
      expect(status).toHaveProperty('utilizationPercent')
      
      expect(status.maxBytesPerSecond).toBe(1000)
      expect(status.enabled).toBe(true)
      expect(status.bucket).toBe(1000) // 初始状态是满的
    })
    
    it('应该随时间重新填充令牌桶', async () => {
      speedLimiter = new SpeedLimiter(1000, true) // 1KB/s
      
      // 消耗所有令牌
      await speedLimiter.requestBytes(1000)
      
      let status = speedLimiter.getStatus()
      expect(status.bucket).toBe(0)
      
      // 模拟1秒后
      jest.advanceTimersByTime(1000)
      
      status = speedLimiter.getStatus()
      expect(status.bucket).toBeCloseTo(1000, 0) // 应该重新填满
    })
  })
  
  describe('动态配置', () => {
    it('应该支持动态修改速度限制', () => {
      speedLimiter = new SpeedLimiter(1000, true) // 初始1KB/s
      
      speedLimiter.setMaxBytesPerSecond(2000)
      
      const status = speedLimiter.getStatus()
      expect(status.maxBytesPerSecond).toBe(2000)
    })
    
    it('应该支持启用/禁用速度限制', async () => {
      speedLimiter = new SpeedLimiter(1000, true)
      
      // 禁用速度限制
      speedLimiter.setEnabled(false)
      expect(speedLimiter.isEnabled()).toBe(false)
      
      // 应该无延迟
      const delay = await speedLimiter.requestBytes(10000)
      expect(delay).toBe(0)
      
      // 重新启用
      speedLimiter.setEnabled(true)
      expect(speedLimiter.isEnabled()).toBe(true)
    })
    
    it('应该支持获取当前速度限制', () => {
      speedLimiter = new SpeedLimiter(1500, true)
      
      expect(speedLimiter.getMaxBytesPerSecond()).toBe(1500)
    })
  })
  
  describe('重置功能', () => {
    it('应该重置令牌桶状态', async () => {
      speedLimiter = new SpeedLimiter(1000, true)
      
      // 消耗所有令牌
      await speedLimiter.requestBytes(1000)
      
      let status = speedLimiter.getStatus()
      expect(status.bucket).toBe(0)
      
      // 重置
      speedLimiter.reset()
      
      status = speedLimiter.getStatus()
      expect(status.bucket).toBe(1000)
    })
  })
  
  describe('等待功能', () => {
    it('应该有等待方法可用', () => {
      speedLimiter = new SpeedLimiter(1000, true)
      
      // 验证wait方法存在
      expect(speedLimiter.wait).toBeDefined()
      expect(typeof speedLimiter.wait).toBe('function')
    })
  })
}) 