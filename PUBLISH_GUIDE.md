# 发布指南 - GitHub & npm

## 📋 发布前检查清单

### ✅ 代码质量

- [x] 所有测试通过 (27/27)
- [x] TypeScript编译通过
- [x] 构建成功
- [x] 文档完善

### ✅ 项目文件

- [x] README.md - 完整项目文档
- [x] LICENSE - MIT许可证
- [x] CHANGELOG.md - 版本更新日志
- [x] package.json - 包信息完整
- [x] .gitignore & .npmignore - 忽略文件配置

## 🚀 GitHub发布流程

### 0. SSH密钥配置（首次使用）

如果还没有配置SSH密钥，需要先设置：

```bash
# 生成SSH密钥（如果还没有）
ssh-keygen -t ed25519 -C "your-email@example.com"
# 或者使用RSA（如果系统不支持ed25519）
# ssh-keygen -t rsa -b 4096 -C "your-email@example.com"

# 启动ssh-agent
eval "$(ssh-agent -s)"

# 添加SSH密钥到ssh-agent
ssh-add ~/.ssh/id_ed25519
# 或者: ssh-add ~/.ssh/id_rsa

# 复制公钥到剪贴板（Windows）
clip < ~/.ssh/id_ed25519.pub
# macOS: pbcopy < ~/.ssh/id_ed25519.pub
# Linux: xclip -sel clip < ~/.ssh/id_ed25519.pub

# 将公钥添加到GitHub
# 访问: https://github.com/settings/keys
# 点击 "New SSH key"，粘贴公钥内容

# 测试SSH连接
ssh -T git@github.com
```

### 1. 创建GitHub仓库

```bash
# 在GitHub上创建新仓库: parallel-file-uploader
# 然后在本地项目中执行：

git init
git add .
git commit -m "feat: 🎉 并行文件上传器 v1.0.0

✨ 新功能:
- 模块化架构重构
- 性能监控系统  
- 速度限制功能
- 队列持久化
- 完整测试覆盖

📊 统计:
- 7个功能模块
- 27个测试用例  
- TypeScript类型安全
- Web Worker多线程支持"

git branch -M main
# 使用SSH方式添加远程仓库
git remote add origin git@github.com:yemaoyang/parallel-file-uploader.git
git push -u origin main
```

### 2. 创建发布标签

```bash
# 创建v1.0.0标签
git tag -a v1.0.0 -m "🎉 v1.0.0: 功能完整的并行文件上传器

主要特性:
- 🚀 模块化架构 
- 📊 性能监控
- ⚡ 速度限制  
- 💾 队列持久化
- 🔄 断点续传
- 🧪 完整测试"

git push origin v1.0.0
```

### 3. 创建GitHub Release

1. 访问 `https://github.com/yemaoyang/parallel-file-uploader/releases`
2. 点击 "Create a new release"
3. 选择标签 `v1.0.0`
4. 发布标题: `🎉 v1.0.0 - 高性能并行文件上传器`
5. 发布说明复制CHANGELOG.md内容
6. 点击 "Publish release"

## 📦 npm发布流程

### 1. 验证包配置

```bash
# 检查包信息
npm pack --dry-run

# 验证包内容
npm publish --dry-run
```

### 2. 构建发布版本

```bash
# 清理并构建
npm run clean
npm run build
npm test

# 检查构建结果
ls -la lib/
```

### 3. npm账户准备

```bash
# 登录npm (如果还没有账户，先注册)
npm login

# 验证登录状态
npm whoami
```

### 4. 发布到npm

```bash
# 发布到npm
npm publish

# 发布成功后验证
npm view parallel-file-uploader
```

## 🔄 版本管理流程

### 语义化版本控制 (SemVer)

- **主版本号 (Major)**: 不兼容的API修改
- **次版本号 (Minor)**: 向下兼容的功能性新增
- **修订号 (Patch)**: 向下兼容的Bug修复

### 版本发布命令

```bash
# 修订版本 (1.0.0 -> 1.0.1)
npm version patch

# 次版本 (1.0.0 -> 1.1.0)  
npm version minor

# 主版本 (1.0.0 -> 2.0.0)
npm version major

# 自动构建、测试、打标签、推送（SSH方式）
npm version patch
git push origin main
git push origin --tags
npm publish
```

## 🔧 SSH故障排除

### 常见问题解决

```bash
# 如果遇到 "Permission denied (publickey)" 错误
# 1. 检查SSH密钥是否添加到ssh-agent
ssh-add -l

# 2. 重新添加密钥
ssh-add ~/.ssh/id_ed25519

# 3. 检查SSH配置
cat ~/.ssh/config

# 4. 测试GitHub连接
ssh -vT git@github.com

# 如果需要，可以创建SSH配置文件
cat >> ~/.ssh/config << EOF
Host github.com
    HostName github.com
    User git
    IdentityFile ~/.ssh/id_ed25519
    IdentitiesOnly yes
EOF
```

## 📊 发布后推广

### 1. 社区推广

- [ ] 在掘金、思否等技术社区发布文章
- [ ] Reddit r/javascript 分享
- [ ] Twitter/X 宣布发布
- [ ] 技术群组分享

### 2. 文档站点

- [ ] 考虑使用 GitHub Pages 部署文档站点
- [ ] 添加在线Demo页面
- [ ] 创建详细的API文档

### 3. 徽章添加

在README.md中添加状态徽章：

```markdown
![npm version](https://img.shields.io/npm/v/parallel-file-uploader.svg)
![npm downloads](https://img.shields.io/npm/dm/parallel-file-uploader.svg)
![GitHub license](https://img.shields.io/github/license/yemaoyang/parallel-file-uploader.svg)
![GitHub stars](https://img.shields.io/github/stars/yemaoyang/parallel-file-uploader.svg)
```

## 🛠 持续集成 (可选)

### GitHub Actions配置

创建 `.github/workflows/ci.yml`:

```yaml
name: CI

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    
    strategy:
      matrix:
        node-version: [14.x, 16.x, 18.x, 20.x]
        
    steps:
    - uses: actions/checkout@v3
    - name: Use Node.js ${{ matrix.node-version }}
      uses: actions/setup-node@v3
      with:
        node-version: ${{ matrix.node-version }}
        
    - run: npm ci
    - run: npm test
    - run: npm run build
```

## 📞 支持

发布后记得:

- 监控GitHub Issues
- 回复npm包相关问题  
- 定期更新依赖
- 收集用户反馈

---

## 🎯 快速发布命令总结

```bash
# SSH方式的一键发布流程
npm test && npm run build && npm version patch && git push origin main && git push origin --tags && npm publish
```

**优势说明**：
- ✅ **SSH更安全**: 使用密钥认证，无需密码
- ✅ **操作便捷**: 一次配置，长期使用
- ✅ **推送稳定**: 避免HTTPS认证问题
- ✅ **企业友好**: 大多数企业环境支持SSH

祝发布顺利！🎉
