# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [2.0.3] - 2025-01-14

### Added

- 🔍 **调试模式功能**
  - 新增 `debugMode` 配置选项，支持详细日志输出
  - 添加 `setDebugMode()` 方法，支持运行时切换调试模式
  - 新增 `getConfiguration()` 方法，获取当前完整配置信息
  - 详细的初始化信息输出，包括版本、配置、功能状态等

### Enhanced

- 🐛 **错误处理增强**
  - 更详细的错误信息输出，包含文件信息、进度等上下文
  - 增强的错误分类和处理逻辑
  - 改进的文件验证错误处理，提供更友好的错误提示
  - 优化错误回调机制，确保错误信息完整传递

- ⚡ **性能优化**
  - 优化文件验证逻辑，提升大文件处理效率
  - 改进分片处理算法，减少内存占用
  - 优化配置验证流程，提供智能优化建议

- 🛠️ **配置验证系统**
  - 新增 `validateAndOptimizeConfig()` 方法
  - 智能检测配置问题并提供优化建议
  - 分片大小、并发数等关键参数的合理性检查
  - 文件类型配置的自动过滤和验证

### Improved

- 📋 **兼容性改进**
  - 保持向后兼容，新增功能不影响现有API
  - 优化现有方法的实现，提高稳定性
  - 改进类型定义，提供更好的TypeScript支持

- 🎯 **代码质量提升**
  - 遵循SOLID原则和KISS原则重构代码
  - 提高代码可读性和可维护性
  - 优化模块间的依赖关系
  - 增强代码注释和文档

### Fixed

- 🐛 修复文件验证过程中的潜在错误处理问题
- 🐛 优化分片上传过程中的错误恢复机制
- 🐛 改进Worker消息处理的稳定性

## [2.0.2] - 2025-01-14

### Enhanced
- 🔧 **断点续传兼容性增强**
  - 新增智能 partSize 计算功能，支持在没有分片大小信息时自动计算
  - 增强 `resumeFromExistingParts` 方法，移除严格的 partSize 检查
  - 添加 `validateAndFixPartInfo` 方法自动修复缺失的分片数据
  - 添加 `calculateExpectedPartSize` 方法智能计算分片大小
  - 更宽松的数据验证策略，保持重要安全检查的同时提高兼容性
  - 增加详细的调试日志，方便排查断点续传问题

### Improved
- 🔄 断点续传现在完全兼容不提供 partSize 的后端 API
- 📊 增强断点续传统计信息输出，提供更清晰的上传进度反馈
- 🛡️ 保留分片编号合理性检查和 etag 异常检测

## [2.0.0] - 2025-06-03

### Added

- 🏗️ **全新模块化架构**
  - 完全重构代码结构，拆分为独立的功能模块
  - FileManager: 文件队列和状态管理
  - ChunkManager: 分片处理和断点续传
  - WorkerManager: Web Worker池管理和线程调度
  - PerformanceMonitor: 实时性能监控
  - SpeedLimiter: 智能速度控制
  - QueuePersistence: 队列持久化存储

- 🔧 **Worker系统优化**
  - 修复TypeScript编译兼容性问题，支持ES2020模块
  - 实现内联Worker创建，无需外部文件依赖
  - 智能Worker池管理，根据硬件自动调整池大小
  - 完善的错误处理和恢复机制

- 📊 **性能监控系统增强**
  - 新增内存使用情况监控（支持Chrome性能API）
  - 实时上传速度计算和历史记录
  - 预计剩余时间智能估算
  - 格式化工具方法（速度、时间、文件大小）

- 🚦 **速度限制系统**
  - 基于令牌桶算法的精确速度控制
  - 支持运行时动态调整速度限制
  - 平滑的流量控制，避免突发流量

- 💾 **队列持久化机制**
  - 自动保存上传状态到localStorage
  - 支持页面刷新后恢复上传队列
  - 智能过期数据清理（24小时TTL）
  - 存储配额监控和管理

### Fixed

- 🐛 **TypeScript编译问题**
  - 修复`import.meta`语法兼容性问题
  - 更新tsconfig.json配置使用ES2020模块和目标
  - 修复Worker类型声明和环境适配

- 🔄 **Worker相关修复**
  - 修复Worker在测试环境中的初始化问题
  - 完善Worker消息类型定义
  - 简化Worker消息处理逻辑

- 📝 **API一致性修复**
  - 添加向后兼容的API方法（getPerformanceMetrics、getQueueStats）
  - 统一配置选项命名规范
  - 修复示例代码中的API调用错误

### Enhanced

- 📚 **文档和示例完善**
  - 更新README.md，添加新功能说明
  - 修复示例代码中的配置错误
  - 完善JSDoc注释覆盖率
  - 新增API兼容性说明

- 🧪 **测试覆盖增强**
  - Jest测试环境优化，支持Worker跳过
  - 新增模块化测试用例
  - 提高代码测试覆盖率

- ⚡ **性能优化**
  - 优化内存使用，减少不必要的对象创建
  - 改进错误处理机制，减少异常开销
  - 更精确的进度计算和状态管理

### Breaking Changes

- 🔄 **配置选项调整**
  - `useWorker` 选项已移除（Worker默认启用）
  - `speedLimit` 重命名为 `maxUploadSpeed`
  - 部分回调函数参数格式调整

### Technical

- **Dependencies**:
  - TypeScript 5.0+
  - spark-md5 ^3.0.2
  - uuid ^9.0.0
  - Jest 29.0+ (dev)
  - Rollup 3.0+ (dev)
- **Browser Support**: Chrome 60+, Firefox 55+, Safari 12+, Edge 79+
- **Module Format**: ES2020, CommonJS
- **Node.js**: 16.0+ required for development

## [1.0.0] - 2025-06-03

### Added

- 🚀 **模块化架构重构**
  - 将主类拆分为7个功能模块（FileManager、ChunkManager、WorkerManager等）
  - 提高代码可维护性和可测试性

- 📊 **性能监控系统**
  - 实时上传速度监控
  - 内存使用量追踪
  - 预计剩余时间计算
  - 峰值速度统计

- ⚡ **速度限制功能**
  - 令牌桶算法实现平滑速度控制
  - 支持动态调整速度限制
  - 智能等待队列管理

- 💾 **队列持久化**
  - localStorage自动保存上传状态
  - 支持页面刷新后恢复上传
  - 版本化数据存储

- 🔄 **断点续传增强**
  - 智能分片恢复机制
  - 验证已上传分片完整性
  - 自动跳过重复上传

- 🧪 **完整测试覆盖**
  - 27个单元测试用例
  - 核心模块100%测试覆盖
  - Jest测试框架集成

- 📚 **示例应用**
  - 基础功能演示页面
  - 高级特性展示dashboard
  - 完整的使用文档

### Enhanced

- ⚡ Web Worker多线程处理优化
- 🎯 更精确的错误分类和处理
- 📈 完善的事件回调系统
- 🔧 TypeScript类型安全保证

### Technical

- **Dependencies**: TypeScript 5.0+, Jest 29.0+, Rollup 3.0+
- **Browser Support**: Chrome 60+, Firefox 55+, Safari 12+
- **Node.js**: 14.0+ required for development

## [Unreleased]

### Planned

- [ ] 文件去重功能
- [ ] 批量操作API
- [ ] 更多云存储适配器
- [ ] React/Vue组件封装
- [ ] 文件压缩预处理
- [ ] 图片自动缩放功能
