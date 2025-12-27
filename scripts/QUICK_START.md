# 快速启动指南 - 多模型服务器

## 🚀 一键启动（推荐）

### Windows
```bash
scripts\start_models.bat
```

### Linux/Mac
```bash
python3.12 scripts/start_models.py
```

## 📋 配置摘要

| 项目 | 配置 |
|------|------|
| **Python版本** | 3.12.7 ✅ |
| **CUDA加速** | 已启用 ✅ |
| **GPU层数** | 999 (全部层在GPU) ✅ |
| **量化格式** | Q4_K_M (4-bit) ✅ |

## 🔌 端口配置

| 模型 | 端口 | 健康检查 | 推理接口 |
|------|------|----------|----------|
| 0.5B | 8080 | http://localhost:8080/health | POST http://localhost:8080/infer |
| 1.5B | 8081 | http://localhost:8081/health | POST http://localhost:8081/infer |
| 3B   | 8082 | http://localhost:8082/health | POST http://localhost:8082/infer |
| 14B  | 8083 | http://localhost:8083/health | POST http://localhost:8083/infer |

## 📝 测试请求示例

```bash
# 测试0.5B模型
curl -X POST http://localhost:8080/infer \
  -H "Content-Type: application/json" \
  -d '{"prompt": "你好", "maxTokens": 100}'

# 测试14B模型
curl -X POST http://localhost:8083/infer \
  -H "Content-Type: application/json" \
  -d '{"prompt": "解释一下机器学习", "maxTokens": 512, "level": "L3"}'
```

## ✅ 验证步骤

1. **检查Python版本**
   ```bash
   py -3.12 --version
   # 应显示: Python 3.12.7
   ```

2. **检查CUDA**
   ```bash
   nvidia-smi
   # 应显示CUDA版本和GPU信息
   ```

3. **验证服务**
   ```bash
   curl http://localhost:8080/health
   curl http://localhost:8081/health
   curl http://localhost:8082/health
   curl http://localhost:8083/health
   ```

## 🛑 停止服务器

按 `Ctrl+C` 停止所有服务器。

