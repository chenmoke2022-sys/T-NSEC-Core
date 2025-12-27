## 模型与权重说明（开源版）

本仓库 **默认使用 Ollama** 做本地推理代理（见根目录 `README.md` 的 Ollama Mode）。  
为保证仓库“可公开、可审计、轻量化”，**任何模型权重与训练中间产物均不会进入 Git**（已由 `.gitignore` 排除）。

### 推荐方式：Ollama（默认路径）

确保 Ollama 运行并拉取两档模型：

```bash
ollama pull qwen2.5:0.5b
ollama pull qwen2.5:7b
```

然后在仓库根目录启动：

```bash
npm run dev
```

### 可选方式：GGUF（legacy）

代码中保留了 GGUF 相关的“legacy”路径用于实验对照，但 **不作为默认路径**。  
如需使用 GGUF，请自行准备对应 `.gguf` 文件并放入本地 `models/`（该目录默认被 Git 忽略）。

## ⚡ 步骤 3：量化模型（Q4_K_M）

使用 `llama.cpp` 的 `quantize` 工具将模型量化为 Q4_K_M 格式：

### 量化 Qwen2.5-0.5B-Instruct

```bash
# 在 llama.cpp 目录下执行
./quantize \
  ../models/Qwen2.5-0.5B-Instruct-f16.gguf \
  ../models/Qwen2.5-0.5B-Instruct-Q4_K_M.gguf \
  Q4_K_M
```

### 量化 Qwen2.5-1.5B-Instruct

```bash
./quantize \
  ../models/Qwen2.5-1.5B-Instruct-f16.gguf \
  ../models/qwen2.5-1.5b-instruct-q4_k_m.gguf \
  Q4_K_M
```

### 量化 Qwen2.5-3B-Instruct

```bash
./quantize \
  ../models/Qwen2.5-3B-Instruct-f16.gguf \
  ../models/qwen2.5-3b-instruct-q4_k_m.gguf \
  Q4_K_M
```

### 量化 Qwen2.5-14B-Instruct

```bash
./quantize \
  ../models/Qwen2.5-14B-Instruct-f16.gguf \
  ../models/qwen2.5-14b-instruct-q4_k_m.gguf \
  Q4_K_M
```

**注意：** 
- Windows 用户需要使用 `quantize.exe` 或 `quantize.exe`（取决于编译配置）
- 量化过程可能需要较长时间，特别是 14B 模型

## ✅ 步骤 4：验证模型文件

量化完成后，验证模型文件是否存在且大小合理：

```bash
# 检查文件大小
ls -lh models/*.gguf

# 预期文件大小（约）：
# Qwen2.5-0.5B-Instruct-Q4_K_M.gguf: ~350 MB
# qwen2.5-1.5b-instruct-q4_k_m.gguf: ~1.04 GB
# qwen2.5-3b-instruct-q4_k_m.gguf: ~2 GB
# qwen2.5-14b-instruct-q4_k_m.gguf: ~8.37 GB
```

## 🔄 完整自动化脚本（可选）

你也可以创建一个自动化脚本来执行所有步骤：

```bash
#!/bin/bash
# download-and-quantize.sh

MODELS_DIR="./models"
LLAMA_CPP_DIR="./llama.cpp"

# 下载所有模型
echo "📥 下载模型..."
huggingface-cli download Qwen/Qwen2.5-0.5B-Instruct --local-dir $MODELS_DIR/Qwen2.5-0.5B-Instruct
huggingface-cli download Qwen/Qwen2.5-1.5B-Instruct --local-dir $MODELS_DIR/Qwen2.5-1.5B-Instruct
huggingface-cli download Qwen/Qwen2.5-3B-Instruct --local-dir $MODELS_DIR/Qwen2.5-3B-Instruct
huggingface-cli download Qwen/Qwen2.5-14B-Instruct --local-dir $MODELS_DIR/Qwen2.5-14B-Instruct

# 转换和量化（需要根据实际情况调整路径）
echo "🔧 转换和量化模型..."
# ... 转换和量化命令 ...

echo "✅ 完成！"
```

## 📝 注意事项

1. **磁盘空间**：确保有足够的磁盘空间（至少 50GB）用于下载和转换过程
2. **内存要求**：量化 14B 模型可能需要 16GB+ 系统内存
3. **时间成本**：完整流程可能需要数小时，建议在稳定网络环境下进行
4. **文件命名**：确保最终量化文件的命名与代码中的路径匹配

## 🆘 故障排除

### 问题：huggingface-cli 下载失败

**解决方案：**
- 检查网络连接
- 尝试使用镜像站点
- 使用 `--resume-download` 参数恢复下载

### 问题：转换工具找不到

**解决方案：**
- 确保已正确编译 llama.cpp
- 检查 Python 环境是否正确安装
- 验证转换脚本路径

### 问题：量化过程内存不足

**解决方案：**
- 关闭其他占用内存的程序
- 考虑使用更低的量化精度（如 Q8_0）
- 分批处理模型

## 📚 参考资源

- [llama.cpp GitHub](https://github.com/ggerganov/llama.cpp)
- [Hugging Face Hub](https://huggingface.co/docs/huggingface_hub)
- [Qwen2.5 模型页面](https://huggingface.co/Qwen)

