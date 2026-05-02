# finlint.ps1
# Start the Finlint web interface at http://localhost:3000

if (-not $env:ANTHROPIC_API_KEY) {
    Write-Error "ANTHROPIC_API_KEY is not set. Run: `$env:ANTHROPIC_API_KEY = 'sk-ant-...'"
    exit 1
}

Write-Host "Starting Finlint at http://localhost:3000"
python web/server.py
