param(
    [string]$Destination = "$PSScriptRoot\AG_Maestro_pc"
)

$ErrorActionPreference = 'Stop'

$sourceRoot = Join-Path $PSScriptRoot 'lecacy'
if (-not (Test-Path -LiteralPath $sourceRoot)) {
    throw "No se encontro la carpeta fuente: $sourceRoot"
}

$filesToCopy = @(
    @{ Source = 'maestro.py'; Destination = 'maestro.py' },
    @{ Source = 'nombres_db.json'; Destination = 'nombres_db.json' },
    @{ Source = 'oled_sh1106_clock.py'; Destination = 'oled_sh1106_clock.py' },
    @{ Source = 'oled_sh1106_dht11.py'; Destination = 'oled_sh1106_dht11.py' },
    @{ Source = 'diagnostico_hardware.py'; Destination = 'diagnostico_hardware.py' }
)

$directoriesToCopy = @(
    @{ Source = 'static'; Destination = 'static' },
    @{ Source = 'templates'; Destination = 'templates' }
)

if (-not (Test-Path -LiteralPath $Destination)) {
    New-Item -ItemType Directory -Path $Destination | Out-Null
}

foreach ($file in $filesToCopy) {
    $sourcePath = Join-Path $sourceRoot $file.Source
    if (-not (Test-Path -LiteralPath $sourcePath)) {
        continue
    }

    $destinationPath = Join-Path $Destination $file.Destination
    $destinationParent = Split-Path -Parent $destinationPath
    if (-not (Test-Path -LiteralPath $destinationParent)) {
        New-Item -ItemType Directory -Path $destinationParent -Force | Out-Null
    }

    Copy-Item -LiteralPath $sourcePath -Destination $destinationPath -Force
}

foreach ($directory in $directoriesToCopy) {
    $sourcePath = Join-Path $sourceRoot $directory.Source
    if (-not (Test-Path -LiteralPath $sourcePath)) {
        continue
    }

    $destinationPath = Join-Path $Destination $directory.Destination
    if (-not (Test-Path -LiteralPath $destinationPath)) {
        New-Item -ItemType Directory -Path $destinationPath -Force | Out-Null
    }

    Copy-Item -LiteralPath (Join-Path $sourcePath '*') -Destination $destinationPath -Recurse -Force
}

"Espejo actualizado en: $Destination"
"Archivos sincronizados desde: $sourceRoot"
