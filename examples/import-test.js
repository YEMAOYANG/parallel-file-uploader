// 模拟在其他项目中使用的方式
// import { ParallelFileUploader } from '@/utils/parallelFileUploader'

// 由于这是测试文件，我们使用相对路径
import { ParallelFileUploader } from '../lib/index.js'

console.log('=== 并行文件上传器导入测试 ===')

// 测试1: 基础导入
console.log('✅ 成功导入 ParallelFileUploader')
console.log('类型:', typeof ParallelFileUploader)

// 测试2: 创建实例
const uploader = new ParallelFileUploader({
  useWorker: true,
  maxConcurrent: 3,
  chunkSize: 1024 * 1024,
  
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
  }
})

console.log('✅ 成功创建上传器实例')

// 测试3: 检查Worker状态
const metrics = uploader.getPerformanceMetrics()
console.log('Worker池大小:', metrics.workerPoolSize || '未知')
console.log('Worker支持:', typeof Worker !== 'undefined')

// 测试4: 添加模拟文件
if (typeof File !== 'undefined') {
  // 在浏览器环境中测试
  const mockBlob = new Blob(['Hello, World!'], { type: 'text/plain' })
  const mockFile = new File([mockBlob], 'test.txt', { type: 'text/plain' })
  
  uploader.addFiles([mockFile])
  console.log('✅ 成功添加文件到队列')
  
  console.log('队列状态:', uploader.getQueueStats())
} else {
  console.log('⚠️  在Node.js环境中，跳过文件测试')
}

console.log('=== 测试完成 ===') 