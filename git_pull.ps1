# Git Pull Automation Script
# 自动处理SSH密钥并拉取最新代码

$ErrorActionPreference = "Stop"

Write-Host "  正在配置SSH环境..." -ForegroundColor Yellow

# 设置GIT_SSH环境变量，禁用StrictHostKeyChecking
$env:GIT_SSH_COMMAND = "ssh -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null"

# 尝试启动ssh-agent
try {
    # 检查ssh-agent是否在运行
    $agentRunning = Get-Process ssh-agent -ErrorAction SilentlyContinue
    if (-not $agentRunning) {
        Write-Host "  启动ssh-agent..." -ForegroundColor Cyan
        Start-Process ssh-agent -WindowStyle Hidden
        Start-Sleep -Seconds 2
    }
} catch {
    Write-Host "  ssh-agent启动失败，但继续尝试..." -ForegroundColor Yellow
}

Write-Host "  正在拉取最新代码..." -ForegroundColor Cyan

# 使用expect-like的方法自动输入密码
# 使用PowerShell的SendKeys方法（虽然不太优雅，但能工作）
# 或者更简单：移除SSH密钥的密码（推荐方案）

# 方案1：使用plink (PuTTY)来处理，但需要额外安装
# 方案2：临时移除SSH密钥密码（推荐）

# 这里采用最简单的方案：直接执行git fetch，并希望ssh-agent已经缓存了密钥
# 如果还是需要密码，我们提供一个更简单的解决方案

try {
    git fetch origin
    Write-Host "  √ Git拉取成功" -ForegroundColor Green
} catch {
    Write-Host ""
    Write-Host "  提示：需要输入SSH密钥密码" -ForegroundColor Yellow
    Write-Host "  如果需要简化，请运行以下命令移除SSH密钥密码：" -ForegroundColor Cyan
    Write-Host "    ssh-keygen -p -f C:\Users\swq\.ssh\id_ed25519" -ForegroundColor White
    Write-Host ""
    Write-Host "  继续执行Git拉取..." -ForegroundColor Yellow
    
    # 再次尝试，这次让用户手动输入
    git fetch origin
}

Write-Host ""
