Param(
  [int]$PaperRuns = 5,
  [int]$GpuRuns = 2,
  [switch]$SkipGpu = $false,
  [switch]$SkipServers = $false,
  [switch]$SkipTests = $false,
  [switch]$InstallPythonDeps = $true
)

$ErrorActionPreference = "Stop"

function Write-Section([string]$title) {
  $line = "=" * 70
  Write-Host ""
  Write-Host $line
  Write-Host $title
  Write-Host $line
}

function Invoke-Logged([string]$cmd, [string]$logPath) {
  Write-Host ""
  Write-Host ("[RUN] " + $cmd)
  $timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
  Add-Content -Path $logPath -Value ("`n`n==== " + $timestamp + " ====`n" + "[RUN] " + $cmd + "`n")
  try {
    # 使用 cmd /c 让 npm/py 在 PowerShell 下行为一致
    cmd /c $cmd 2>&1 | Tee-Object -FilePath $logPath -Append
    $code = $LASTEXITCODE
    if ($code -ne 0) {
      throw ("Command failed with exit code " + $code + ": " + $cmd)
    }
  } catch {
    Add-Content -Path $logPath -Value ("`n[ERROR] " + $_.Exception.Message + "`n")
    throw
  }
}

$repoRoot = Split-Path -Parent $PSScriptRoot
Set-Location $repoRoot

$ts = Get-Date -Format "yyyyMMdd_HHmmss"
$logDir = Join-Path $repoRoot ("reports\\overnight_logs\\" + $ts)
New-Item -ItemType Directory -Force -Path $logDir | Out-Null
$logPath = Join-Path $logDir "overnight.log"

Write-Section "T-NSEC-CORE Overnight Runner"
Write-Host ("Repo: " + $repoRoot)
Write-Host ("Log:  " + $logPath)
Write-Host ("PaperRuns=" + $PaperRuns + ", GpuRuns=" + $GpuRuns + ", SkipGpu=" + $SkipGpu + ", SkipServers=" + $SkipServers + ", SkipTests=" + $SkipTests)

Write-Section "Step 0: Quick environment snapshot"
Invoke-Logged "node --version" $logPath
Invoke-Logged "npm --version" $logPath
Invoke-Logged "py -3.12 --version" $logPath
try { Invoke-Logged "nvidia-smi" $logPath } catch { Write-Host "nvidia-smi 不可用（忽略）" }

if ($InstallPythonDeps) {
  Write-Section "Step 1: Install python deps for charts (requests/numpy/matplotlib)"
  Invoke-Logged "py -3.12 -m pip install -U pip" $logPath
  Invoke-Logged "py -3.12 -m pip install -U requests numpy matplotlib" $logPath
}

Write-Section "Step 2: Verify environment (no side effects)"
Invoke-Logged "npm run verify-env" $logPath

if (-not $SkipTests) {
  Write-Section "Step 3: Tests (unit + integration)"
  Invoke-Logged "npm test" $logPath
  Invoke-Logged "npm run integration-test" $logPath
}

if (-not $SkipGpu) {
  Write-Section "Step 4: GPU sanity + GPU benchmark (may take long)"
  Invoke-Logged "npm run verify-gpu" $logPath
  for ($i = 1; $i -le $GpuRuns; $i++) {
    Write-Host ("`n[GPU] Run " + $i + " / " + $GpuRuns)
    Invoke-Logged "npm run benchmark-gpu" $logPath
  }
} else {
  Write-Host "`nSkip GPU benchmarks."
}

if (-not $SkipServers) {
  Write-Section "Step 5: Start multi-model servers in a new console"
  Write-Host "会打开一个新窗口跑 0.5B/1.5B/3B/14B 四个端口 (8080-8083)。"
  Write-Host "注意：这些服务会持续运行；脚本不会自动杀掉它们（避免误伤其他任务）。"
  Start-Process -FilePath "cmd.exe" -WorkingDirectory $repoRoot -ArgumentList "/c", "scripts\\start_models.bat"
  Start-Sleep -Seconds 10
} else {
  Write-Host "`nSkip starting servers."
}

Write-Section "Step 6: Paper benchmark (repeat runs for statistical robustness)"
for ($i = 1; $i -le $PaperRuns; $i++) {
  Write-Host ("`n[PAPER] Run " + $i + " / " + $PaperRuns)
  Invoke-Logged "npm run paper-benchmark" $logPath
  Start-Sleep -Seconds 10
}

Write-Section "Step 7: Generate an index of produced artifacts"
$paperDir = Join-Path $repoRoot "reports\\paper_benchmark"
$indexPath = Join-Path $paperDir ("OVERNIGHT_INDEX_" + $ts + ".md")

$items = @()
if (Test-Path $paperDir) {
  $items = Get-ChildItem -Path $paperDir -File | Sort-Object LastWriteTime
}

@(
  "# Overnight run index",
  "",
  ("**Generated**: " + (Get-Date -Format "yyyy-MM-dd HH:mm:ss")),
  "",
  "## Where to look",
  ("- **Logs**: reports/overnight_logs/" + $ts + "/overnight.log"),
  "- **Paper benchmark outputs**: reports/paper_benchmark/",
  "",
  "## Files",
  ""
) | Set-Content -Path $indexPath -Encoding UTF8

foreach ($it in $items) {
  $rel = $it.FullName.Substring($repoRoot.Length + 1).Replace("\\", "/")
  Add-Content -Path $indexPath -Value ("- " + $rel + " (" + $it.Length + " bytes)")
}

Write-Host ""
Write-Host ("✅ Done. Index: " + $indexPath)


