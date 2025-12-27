## qwen-sentence-align 证据包（可公开）

### 这是什么

这里收录 qwen‑sentence‑align 的关键公开产物，用于支撑论文写作与技术验证：

- 语义对齐（0.5B→7B）评测指标（v1/v2/v2.1）
- H‑Spec 门控实验报告（模拟/真实/input/output/校准）

### 重要说明（避免误导）

- 数据集中包含 LLM 生成的 synthetic distillation set：可用于方法验证与迭代，但不等价于公开 benchmark。
- output‑level gate 的 accept/reject 取决于门控定义与输出口径，需要阈值校准。

### 文件来源

这些文件已复制进本仓库 `benchmark/qwen-sentence-align/`，避免依赖本机绝对路径。

### 关于 artifacts/（重要）

`benchmark/qwen-sentence-align/artifacts/` 中包含大文件证据（对齐头权重、权重矩阵、对齐矩阵等）。  
为兼顾 **可公开审计** 与 **仓库可维护性**：
- 原始大文件（`.pt/.npy/*matrix*.json`）仍由 `.gitignore` 排除（避免误提交“解压后的拷贝”）。
- 本仓库提供 **压缩归档（ZIP）** 作为唯一可提交版本（并建议使用 Git LFS 跟踪）。

#### 获取与解压
- 归档文件：`benchmark/qwen-sentence-align/artifacts/qwen_sentence_align_v2_1_artifacts.zip`
- 解压位置：`benchmark/qwen-sentence-align/artifacts/`


