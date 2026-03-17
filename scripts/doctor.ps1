# Clui CC — Windows Doctor (PowerShell)
# Read-only diagnostic tool. Run: pwsh scripts/doctor.ps1

$ErrorActionPreference = "SilentlyContinue"
$pass = 0
$fail = 0

function Check($label, $condition, $fixCmd) {
    if ($condition) {
        Write-Host "  [OK] $label" -ForegroundColor Green
        $script:pass++
    } else {
        Write-Host "  [FAIL] $label" -ForegroundColor Red
        if ($fixCmd) {
            Write-Host "    Fix: $fixCmd" -ForegroundColor Yellow
        }
        $script:fail++
    }
}

Write-Host "`nClui CC Doctor (Windows)`n" -ForegroundColor Cyan

# --- Node.js ---
$nodeVersion = & node --version 2>$null
$nodeOk = $nodeVersion -match "^v(1[89]|[2-9]\d)\."
Check "Node.js ($nodeVersion)" $nodeOk "Install Node 18+ from https://nodejs.org or: winget install OpenJS.NodeJS.LTS"

# --- npm ---
$npmVersion = & npm --version 2>$null
$npmOk = $null -ne $npmVersion
Check "npm ($npmVersion)" $npmOk "Comes with Node.js"

# --- Python 3 ---
$pyVersion = & python --version 2>$null
if (-not $pyVersion) { $pyVersion = & python3 --version 2>$null }
$pyOk = $pyVersion -match "Python 3\."
Check "Python 3 ($pyVersion)" $pyOk "Install: winget install Python.Python.3.12"

# --- setuptools ---
$setuptools = & python -c "import setuptools; print(setuptools.__version__)" 2>$null
$stOk = $null -ne $setuptools
Check "Python setuptools ($setuptools)" $stOk "Fix: pip install setuptools"

# --- Visual Studio Build Tools ---
$vsWhere = "${env:ProgramFiles(x86)}\Microsoft Visual Studio\Installer\vswhere.exe"
$vsInstalled = Test-Path $vsWhere
if ($vsInstalled) {
    $vsPath = & $vsWhere -latest -property installationPath 2>$null
    $vsOk = $null -ne $vsPath
} else {
    $vsOk = $false
}
Check "Visual Studio Build Tools" $vsOk "Install: winget install Microsoft.VisualStudio.2022.BuildTools --override '--add Microsoft.VisualStudio.Workload.VCTools'"

# --- Claude Code CLI ---
$claudeVersion = & claude --version 2>$null
$claudeOk = $claudeVersion -match "\d+\.\d+"
Check "Claude Code CLI ($claudeVersion)" $claudeOk "Install: npm install -g @anthropic-ai/claude-code"

# --- Claude authenticated ---
if ($claudeOk) {
    $claudeAuth = & claude --print-api-key 2>$null
    $authOk = $null -ne $claudeAuth -and $claudeAuth.Length -gt 0
    Check "Claude CLI authenticated" $authOk "Run: claude to authenticate"
} else {
    Check "Claude CLI authenticated" $false "Install Claude CLI first"
}

# --- node-pty ---
$ptyOk = & node -e "try{require('node-pty');console.log('ok')}catch{}" 2>$null
$ptyAvailable = $ptyOk -eq "ok"
Check "node-pty native module" $ptyAvailable "Run: npm rebuild node-pty (requires VS Build Tools)"

# --- Summary ---
Write-Host "`n  Results: $pass passed, $fail failed`n" -ForegroundColor $(if ($fail -eq 0) { "Green" } else { "Yellow" })

if ($fail -gt 0) {
    Write-Host "  Fix the issues above and re-run: pwsh scripts/doctor.ps1`n" -ForegroundColor Yellow
}
