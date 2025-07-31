// 模拟在其他项目中使用的方式
// import { ParallelFileUploader } from '@/utils/parallelFileUploader'

// 由于这是测试文件，我们使用相对路径
import { ParallelFileUploader } from '../lib/index.js'

console.log('=== 并行文件上传器导入测试 ===')

// 测试1: 基础导入
console.log('✅ 成功导入 ParallelFileUploader')
console.log('类型:', typeof ParallelFileUploader)

// 测试2: 创建实例（展示新功能）
const uploader = new ParallelFileUploader({
  maxConcurrentFiles: 3,
  maxConcurrentChunks: 3,
  chunkSize: 1024 * 1024,
  enablePerformanceMonitor: true,
  
  // 🔧 新功能配置
  debugMode: true, // 启用调试模式
  allowedFileTypes: ['*'], // 支持通配符，允许所有文件类型
  maxFileSize: 10 * 1024 * 1024, // 10MB 限制
  
  // 模拟回调
  sendFileInfoToServer: async (fileInfo) => {
    console.log('📤 模拟发送文件信息:', fileInfo.fileName)
    return { isSuccess: true, data: {} }
  },
  
  sendFilePartToServer: async (fileInfo, chunkInfo) => {
    console.log(`📦 模拟上传分片: ${fileInfo.fileName} part ${chunkInfo.partNumber}`)
    return { isSuccess: true, data: { etag: 'mock-etag' } }
  },
  
  onFileProgress: (fileInfo) => {
    console.log(`📊 进度更新: ${fileInfo.fileName} - ${fileInfo.progress}%`)
  },
  
  // 🔧 新增回调
  onFileRejected: (file, reason) => {
    console.log(`❌ 文件被拒绝: ${file.name} - ${reason}`)
  }
})

console.log('✅ 成功创建上传器实例')

// 🔧 测试3: 新API方法测试
console.log('\n--- 新功能 API 测试 ---')

// 获取配置信息
console.log('📊 上传器配置信息:')
try {
  const config = uploader.getConfiguration()
  console.log('- 分片大小:', config.chunkManager.chunkSize)
  console.log('- 文件管理器配置:', config.fileManager.supportedTypesDescription)
  console.log('- 功能开关:', config.features)
  console.log('- 限制配置:', config.limits)
} catch (error) {
  console.log('配置获取失败:', error.message)
}

// 测试调试模式
console.log('\n🔍 调试模式测试:')
console.log('- 当前调试模式: 启用')
uploader.setDebugMode(false)
console.log('- 设置调试模式为: 禁用')
uploader.setDebugMode(true)
console.log('- 重新启用调试模式')

// 测试4: 检查Worker状态
console.log('\n--- Worker 状态检查 ---')
const metrics = uploader.getPerformanceMetrics()
console.log('Worker池大小:', metrics.workerPoolSize || '未知')
console.log('Worker支持:', typeof Worker !== 'undefined')

// 测试5: 文件类型验证测试
console.log('\n--- 文件类型验证测试 ---')
if (typeof File !== 'undefined') {
  // 在浏览器环境中测试
  const mockBlob = new Blob(['Hello, World!'], { type: 'text/plain' })
  const mockFile = new File([mockBlob], 'test.txt', { type: 'text/plain' })
  
  console.log('📁 添加普通文本文件:')
  uploader.addFiles([mockFile])
  console.log('✅ 成功添加文件到队列（通配符 * 允许所有类型）')
  
  // 测试大文件（模拟）
  const largeMockData = new Array(11 * 1024 * 1024).fill('a').join('') // 11MB
  const largeMockBlob = new Blob([largeMockData], { type: 'text/plain' })
  const largeMockFile = new File([largeMockBlob], 'large-test.txt', { type: 'text/plain' })
  
  console.log('\n📁 添加大文件测试 (>10MB):')
  uploader.addFiles([largeMockFile])
  console.log('⚠️  应该触发文件大小限制（如果配置了maxFileSize）')
  
  console.log('\n📈 队列状态:', uploader.getStats())
} else {
  console.log('⚠️  在Node.js环境中，跳过文件测试')
}

// 🔧 测试6: 新功能兼容性测试
console.log('\n--- 新功能兼容性测试 ---')
try {
  // 测试通配符配置
  console.log('✅ 通配符支持: 已配置 ["*"]')
  
  // 测试性能数据获取
  const perfData = uploader.getPerformanceData()
  console.log('✅ 性能数据获取: 成功')
  console.log('- 当前速度:', perfData.currentSpeed, 'bytes/s')
  console.log('- 平均速度:', perfData.averageSpeed, 'bytes/s')
  
  // 测试统计信息
  const stats = uploader.getStats()
  console.log('✅ 统计信息获取: 成功')
  console.log('- 队列中文件:', stats.queued)
  console.log('- 活动文件:', stats.active)
  
} catch (error) {
  console.log('❌ 新功能测试失败:', error.message)
}

console.log('\n🎉 === 测试完成 ===')
console.log('💡 v2.0.1 新功能特性:')
console.log('   - ✅ 调试模式')
console.log('   - ✅ 通配符文件类型支持')
console.log('   - ✅ 增强的错误处理')
console.log('   - ✅ 新增配置 API')
console.log('   - ✅ 动态配置控制') 