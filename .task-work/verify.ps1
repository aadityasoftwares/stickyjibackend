param([ValidateSet('backend-build','frontend-build','backend-tests','frontend-tests','format')][string]$Task)
$ErrorActionPreference = 'Stop'
$repo = Split-Path $PSScriptRoot
$node = 'C:\nvm4w\nodejs\node.exe'
$env:Path = 'C:\nvm4w\nodejs;' + $env:Path
$working = $repo
switch ($Task) {
  'backend-build' { $arguments = @('node_modules/typescript/bin/tsc') }
  'frontend-build' { $working = 'C:\Aaditya\AngularProjetcs\stickyji_webapp'; $arguments = @('node_modules/@angular/cli/bin/ng.js','build','--configuration','development') }
  'backend-tests' { $arguments = @('--import','tsx','--test','--test-concurrency=4','tests/*.test.mjs') }
  'frontend-tests' { $working = 'C:\Aaditya\AngularProjetcs\stickyji_webapp'; $arguments = @('node_modules/@angular/cli/bin/ng.js','test','--watch=false','--ts-config','tsconfig.attachments-regression.json','--include','src/app/private/mynotes/note-attachments/note-attachments.spec.ts','--include','src/app/private/mynotes/services/sticky-note-attachment.service.spec.ts','--include','src/app/private/mynotes/add-edit-note-side-panel/add-edit-note-side-panel.spec.ts') }
  'format' { $arguments = @('node_modules/prettier/bin/prettier.cjs','--write','src/config/cloudflareR2.config.ts','src/modules/media/**/*.ts','src/modules/stickynoteattachment/**/*.ts','src/scripts/migrate-media*.ts','tests/mediaSecurity.test.mjs','tests/media.test.mjs','docs/media-storage-and-attachments.md') }
}
$stdout = Join-Path $PSScriptRoot ($Task + '.stdout.log')
$stderr = Join-Path $PSScriptRoot ($Task + '.stderr.log')
$process = Start-Process -FilePath $node -ArgumentList $arguments -WorkingDirectory $working -WindowStyle Hidden -Wait -PassThru -RedirectStandardOutput $stdout -RedirectStandardError $stderr
Write-Output ($Task + ' exit code: ' + $process.ExitCode)
Get-Content -LiteralPath $stdout -Tail 12
if ($process.ExitCode -ne 0) { Get-Content -LiteralPath $stderr -Tail 40 }
exit $process.ExitCode
