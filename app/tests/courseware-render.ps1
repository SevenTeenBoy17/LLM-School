param([Parameter(Mandatory=$true)][string]$Deck, [Parameter(Mandatory=$true)][string]$Output)
$ErrorActionPreference = 'Stop'
$path = (Resolve-Path -LiteralPath $Deck).Path
$destination = [IO.Path]::GetFullPath($Output)
$null = New-Item -ItemType Directory -Path $destination -Force
$alreadyRunning = @(Get-Process POWERPNT -ErrorAction SilentlyContinue).Count -gt 0
$powerpoint = $null
$presentation = $null
try {
  $powerpoint = New-Object -ComObject PowerPoint.Application
  $presentation = $powerpoint.Presentations.Open($path, -1, 0, 0)
  $count = $presentation.Slides.Count
  for ($i = 1; $i -le $count; $i++) {
    $presentation.Slides.Item($i).Export((Join-Path $destination ('slide-{0:D2}.png' -f $i)), 'PNG', 1920, 1080)
  }
  [pscustomobject]@{ deck = $path; count = $count; output = $destination; renderer = 'Microsoft PowerPoint' } | ConvertTo-Json
} finally {
  if ($presentation) { $presentation.Close(); [void][Runtime.InteropServices.Marshal]::ReleaseComObject($presentation) }
  if ($powerpoint) {
    if (-not $alreadyRunning -and $powerpoint.Presentations.Count -eq 0) { $powerpoint.Quit() }
    [void][Runtime.InteropServices.Marshal]::ReleaseComObject($powerpoint)
  }
}
