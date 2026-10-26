# Pinned independent reference; run from repository root. Public files only.
$ErrorActionPreference='Stop'
$dest=Join-Path (Get-Location) 'data/raw/cmu-independent'
New-Item -ItemType Directory -Force -Path $dest | Out-Null
$base='https://raw.githubusercontent.com/una-dinosauria/cmu-mocap/09a07f54f3bbb58797325f009282d0b2048a2871'
$items=@(
 @{Remote='data/035/35_17.bvh';Local='35_17.bvh';Hash='50C6469EFEA1EDBBA0F7ACD46B1FA72E0B74B78E1698AA1B441990BD2A78D730'},
 @{Remote='READMEFIRST.txt';Local='READMEFIRST.txt';Hash='8E6FE2E640B3728EF2E43E722CB5AE9CDF0010028C0517C4226ED165F9037930'}
)
foreach($item in $items){
 $target=Join-Path $dest $item.Local
 if(-not (Test-Path -LiteralPath $target)){Invoke-WebRequest -Uri "$base/$($item.Remote)" -OutFile $target}
 if((Get-FileHash -LiteralPath $target -Algorithm SHA256).Hash -ne $item.Hash){throw "Reference hash mismatch: $($item.Local)"}
}
Write-Output 'Pinned 35_17 reference hashes verified.'
