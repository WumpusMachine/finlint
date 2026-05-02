# get-finlint.ps1
# Install all Finlint dependencies (run once).

$ErrorActionPreference = "Stop"

Write-Host "==> Installing Python dependencies..."
pip install anthropic flask

Write-Host ""
Write-Host "==> Installing Node dependencies..."
npm install

Write-Host ""
Write-Host "Done. Next steps:"
Write-Host "  1. Set your Anthropic API key:"
Write-Host "       `$env:ANTHROPIC_API_KEY = 'sk-ant-...'"
Write-Host "  2. Start the web interface:"
Write-Host "       .\\finlint.ps1"
