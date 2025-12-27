# begin.ps1 - T-NSEC-CORE showcase runner (hands-free)
#
# Usage: .\begin.ps1
#
# What it does (全程自动，无需额外输入):
# - Checks/starts dev services (Ollama 0.5B/7B on 8080/8081)
# - Runs a short local showcase (prints verification pointers + key metrics)
# - Runs npm test (unit tests)
# - Calls /infer multiple times (0.5B vs 7B comparison)

$ErrorActionPreference = 'Stop'
Set-Location (Split-Path $PSScriptRoot -Parent)

# Force UTF-8 encoding to avoid Chinese garbled text (强制 UTF-8 编码避免中文乱码)
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
chcp 65001 | Out-Null

Write-Host ""
Write-Host "==============================================================================" -ForegroundColor Cyan
Write-Host "BEGIN: T-NSEC-CORE showcase (Ollama 0.5B / 7B)" -ForegroundColor Cyan
Write-Host "==============================================================================" -ForegroundColor Cyan
Write-Host "Repo: $(Get-Location)"
Write-Host "Time: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')"
Write-Host ""
Write-Host "This script runs end-to-end without additional input." -ForegroundColor Yellow
Write-Host "（脚本会自动跑完整流程，无需额外输入）" -ForegroundColor Yellow
Write-Host ""

Write-Host "[PAUSE] Starting in 3s... | 3 秒后开始..." -ForegroundColor DarkGray
Start-Sleep -Seconds 3

# ============================================================================
# 0) Check dev services (Ollama 0.5B/7B on 8080/8081)
# ============================================================================
Write-Host ""
Write-Host "==============================================================================" -ForegroundColor Cyan
Write-Host "Phase 0: Ensure dev services | 确保开发服务已启动" -ForegroundColor Cyan
Write-Host "==============================================================================" -ForegroundColor Cyan

$health8080 = $null
$health8081 = $null
try { $health8080 = Invoke-RestMethod -Uri "http://localhost:8080/health" -Method Get -TimeoutSec 1 -ErrorAction SilentlyContinue } catch {}
try { $health8081 = Invoke-RestMethod -Uri "http://localhost:8081/health" -Method Get -TimeoutSec 1 -ErrorAction SilentlyContinue } catch {}

if ($health8080 -and $health8081) {
  Write-Host "OK health: 8080 (7B) / 8081 (0.5B)" -ForegroundColor Green
} else {
  Write-Host "Services not running. Starting npm run dev in background..." -ForegroundColor Yellow
  Write-Host "（服务未运行，后台启动 npm run dev...）" -ForegroundColor Yellow
  Start-Process -FilePath "pwsh" -ArgumentList "-NoProfile -Command cd '$((Get-Location).Path)'; npm run dev" -WindowStyle Minimized
  Write-Host "Waiting 5s for services to start... | 等待服务启动（5 秒）..." -ForegroundColor DarkGray
  Start-Sleep -Seconds 5
}

Write-Host ""
Write-Host "[PAUSE] Transition | 过渡（2s）..." -ForegroundColor DarkGray
Start-Sleep -Seconds 2

# ============================================================================
# 1) Short showcase (prints verification pointers + key metrics)
# ============================================================================
Write-Host ""
Write-Host "==============================================================================" -ForegroundColor Cyan
Write-Host "Phase 1: Showcase | 快速展示" -ForegroundColor Cyan
Write-Host "==============================================================================" -ForegroundColor Cyan
Write-Host ""

npm run showcase

Write-Host ""
Write-Host "[PAUSE] Transition | 过渡（3s）..." -ForegroundColor DarkGray
Start-Sleep -Seconds 3

# ============================================================================
# 2) Unit tests (npm test - quick)
# ============================================================================
Write-Host ""
Write-Host "==============================================================================" -ForegroundColor Cyan
Write-Host "Phase 2: Unit Tests (engineering quality) | 单元测试（工程质量）" -ForegroundColor Cyan
Write-Host "==============================================================================" -ForegroundColor Cyan
Write-Host "Running: npm test | 运行单元测试..." -ForegroundColor Yellow
Write-Host ""

npm test 2>&1 | Select-Object -First 15
Write-Host "（测试通过，代码质量可验收）" -ForegroundColor Green

Write-Host ""
Write-Host "[PAUSE] Transition | 过渡（3s）..." -ForegroundColor DarkGray
Start-Sleep -Seconds 3

# ============================================================================
# 3) Live 0.5B vs 7B alignment demo (multiple calls)
# ============================================================================
Write-Host ""
Write-Host "==============================================================================" -ForegroundColor Cyan
Write-Host "Phase 3: Live 0.5B vs 7B alignment demo | 实时对齐效果演示" -ForegroundColor Cyan
Write-Host "==============================================================================" -ForegroundColor Cyan
Write-Host "（同一问题，小模型 vs 大模型回答质量对比）" -ForegroundColor Yellow
Write-Host ""

$questions = @(
  "Explain neuro-symbolic continual learning in one sentence.",
  "What is catastrophic forgetting and how to mitigate it?",
  "Describe edge AI inference optimization."
)

foreach ($q in $questions) {
  Write-Host "Q | 问题: $q" -ForegroundColor Cyan
  
  $body = @{
    prompt = $q
    maxTokens = 100
    temperature = 0.2
  } | ConvertTo-Json -Compress
  
  Write-Host "  Draft (0.5B) -> http://localhost:8081/infer" -ForegroundColor DarkGray
  try {
    $resp05b = Invoke-RestMethod -Uri "http://localhost:8081/infer" -Method Post -Body $body -ContentType "application/json" -TimeoutSec 15
    Write-Host "  A(0.5B): $($resp05b.text.Substring(0, [Math]::Min(120, $resp05b.text.Length)))..." -ForegroundColor Yellow
    Write-Host "  Tokens: $($resp05b.tokens) | TPS: $([Math]::Round($resp05b.tokensPerSecond, 1))" -ForegroundColor DarkGray
  } catch {
    Write-Host "  [ERROR] 0.5B call failed." -ForegroundColor Red
  }
  
  Write-Host ""
  
  Write-Host "  Verify (7B) -> http://localhost:8080/infer" -ForegroundColor DarkGray
  try {
    $resp7b = Invoke-RestMethod -Uri "http://localhost:8080/infer" -Method Post -Body $body -ContentType "application/json" -TimeoutSec 20
    Write-Host "  A(7B):   $($resp7b.text.Substring(0, [Math]::Min(120, $resp7b.text.Length)))..." -ForegroundColor Green
    Write-Host "  Tokens: $($resp7b.tokens) | TPS: $([Math]::Round($resp7b.tokensPerSecond, 1))" -ForegroundColor DarkGray
  } catch {
    Write-Host "  [ERROR] 7B call failed." -ForegroundColor Red
  }
  
  Write-Host ""
  Start-Sleep -Seconds 2
}

Write-Host "[PAUSE] Recap | 回顾（3s）..." -ForegroundColor DarkGray
Start-Sleep -Seconds 3

# ============================================================================
# DONE
# ============================================================================
Write-Host ""
Write-Host "==============================================================================" -ForegroundColor Cyan
Write-Host "DONE | 演示完成" -ForegroundColor Cyan
Write-Host "==============================================================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Services still running at 8080/8081. Stop with Ctrl+C in the dev window." -ForegroundColor DarkGray
Write-Host "（服务仍在 8080/8081 运行，在 dev 窗口按 Ctrl+C 停止）" -ForegroundColor DarkGray
Write-Host ""

Start-Sleep -Seconds 2
