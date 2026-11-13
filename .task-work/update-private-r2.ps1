$ErrorActionPreference = 'Stop'
$envPath = Join-Path (Split-Path $PSScriptRoot) '.env'
$content = [IO.File]::ReadAllText($envPath)
if ($content -match '(?m)^CLOUDFLARE_R2_BUCKET_IS_PRIVATE=.*$') {
    $content = [regex]::Replace($content, '(?m)^CLOUDFLARE_R2_BUCKET_IS_PRIVATE=.*$', 'CLOUDFLARE_R2_BUCKET_IS_PRIVATE=true')
} else {
    $content += "`n# This bucket has public r2.dev access and public custom domains disabled.`nCLOUDFLARE_R2_BUCKET_IS_PRIVATE=true`n"
}
[IO.File]::WriteAllText($envPath, $content)
Write-Output 'Configured existing R2 bucket as private. No credential values were displayed.'
