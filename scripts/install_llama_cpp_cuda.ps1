$ErrorActionPreference = "Stop"

$python = Join-Path $PSScriptRoot "..\venv\Scripts\python.exe"
$python = [System.IO.Path]::GetFullPath($python)
$projectRoot = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot ".."))

if (-not (Test-Path $python)) {
    throw "Virtualenv Python not found at $python"
}

$sitePackages = & $python -c "import site; print(site.getsitepackages()[0])"
$sitePackages = $sitePackages.Trim()

function Find-Nvcc {
    $cmd = Get-Command nvcc.exe -ErrorAction SilentlyContinue
    if ($cmd) {
        return $cmd.Source
    }

    if ($env:CUDA_PATH) {
        $fromCudaPath = Join-Path $env:CUDA_PATH "bin\nvcc.exe"
        if (Test-Path $fromCudaPath) {
            return $fromCudaPath
        }
    }

    $commonRoots = @(
        "C:\Program Files\NVIDIA GPU Computing Toolkit\CUDA",
        "C:\Program Files\NVIDIA\CUDAToolkit"
    )

    foreach ($root in $commonRoots) {
        if (-not (Test-Path $root)) {
            continue
        }

        $match = Get-ChildItem $root -Directory -ErrorAction SilentlyContinue |
            Sort-Object Name -Descending |
            ForEach-Object { Join-Path $_.FullName "bin\nvcc.exe" } |
            Where-Object { Test-Path $_ } |
            Select-Object -First 1

        if ($match) {
            return $match
        }
    }

    return $null
}

function Find-CudaRootFromNvcc([string] $nvccPath) {
    return Split-Path (Split-Path $nvccPath -Parent) -Parent
}

function Convert-ToCMakePath([string] $path) {
    if ([string]::IsNullOrWhiteSpace($path)) {
        return $path
    }

    return $path.Replace('\', '/')
}

$cudaNvccRoot = Join-Path $sitePackages "nvidia\cuda_nvcc"
$cudaRuntimeRoot = Join-Path $sitePackages "nvidia\cuda_runtime"
$nvcc = Find-Nvcc

if ([string]::IsNullOrWhiteSpace($nvcc) -or -not (Test-Path $nvcc)) {
    throw "nvcc.exe not found. Install the full NVIDIA CUDA Toolkit first, then rerun this script."
}

$cudaRoot = Find-CudaRootFromNvcc $nvcc
$cudaInclude = Join-Path $cudaRuntimeRoot "include"
$cudaLib = Join-Path $cudaRuntimeRoot "lib\x64"
$cudaBin = Join-Path $cudaRuntimeRoot "bin"
$cudaBinX64 = Join-Path $cudaRoot "bin\x64"

if (-not (Test-Path $cudaInclude)) {
    $cudaInclude = Join-Path $cudaRoot "include"
}

if (-not (Test-Path $cudaLib)) {
    $cudaLib = Join-Path $cudaRoot "lib\x64"
}

if (-not (Test-Path $cudaBin)) {
    $cudaBin = Join-Path $cudaRoot "bin"
}

if (-not (Test-Path $cudaBinX64)) {
    $cudaBinX64 = $null
}

$cudaRootCMake = Convert-ToCMakePath $cudaRoot
$nvccCMake = Convert-ToCMakePath $nvcc
$cudaIncludeCMake = Convert-ToCMakePath $cudaInclude
$cudaLibCMake = Convert-ToCMakePath $cudaLib

$env:CMAKE_GENERATOR_TOOLSET = "cuda=$cudaRootCMake"
$env:CMAKE_ARGS = @(
    "-DGGML_CUDA=on",
    "-DCMAKE_CUDA_COMPILER=$nvccCMake",
    "-DCUDAToolkit_ROOT=$cudaRootCMake",
    "-DCUDA_TOOLKIT_ROOT_DIR=$cudaRootCMake",
    "-DCMAKE_VS_PLATFORM_TOOLSET_CUDA_CUSTOM_DIR=$cudaRootCMake",
    "-DCMAKE_CUDA_FLAGS=--use-local-env",
    "-DCMAKE_INCLUDE_PATH=$cudaIncludeCMake",
    "-DCMAKE_LIBRARY_PATH=$cudaLibCMake"
) -join " "
$env:FORCE_CMAKE = "1"
$env:CUDACXX = $nvcc
$env:CUDA_PATH = $cudaRoot
$env:CUDAToolkit_ROOT = $cudaRoot
$env:CUDA_BIN_PATH = $cudaBin
$pathEntries = @(
    $cudaBin
    $cudaBinX64
    (Join-Path $cudaNvccRoot "bin")
    (Join-Path $cudaRuntimeRoot "bin")
) | Where-Object { -not [string]::IsNullOrWhiteSpace($_) }
$env:PATH = (($pathEntries + @($env:PATH)) -join ";")
$env:INCLUDE = "$cudaInclude;$env:INCLUDE"
$env:LIB = "$cudaLib;$env:LIB"

$shortTmpRoot = Join-Path $projectRoot ".tmp\l"
$downloadRoot = Join-Path $shortTmpRoot "d"
$extractRoot = Join-Path $shortTmpRoot "x"
$sourceRoot = Join-Path $shortTmpRoot "s"
$buildTempRoot = Join-Path $shortTmpRoot "t"
$wheelRoot = Join-Path $shortTmpRoot "w"
$buildTrackerRoot = Join-Path $shortTmpRoot "bt"

New-Item -ItemType Directory -Force -Path $downloadRoot | Out-Null
New-Item -ItemType Directory -Force -Path $extractRoot | Out-Null
New-Item -ItemType Directory -Force -Path $sourceRoot | Out-Null
New-Item -ItemType Directory -Force -Path $buildTempRoot | Out-Null
New-Item -ItemType Directory -Force -Path $wheelRoot | Out-Null
New-Item -ItemType Directory -Force -Path $buildTrackerRoot | Out-Null

Get-ChildItem $downloadRoot -Force -ErrorAction SilentlyContinue | Remove-Item -Recurse -Force -ErrorAction SilentlyContinue
Get-ChildItem $extractRoot -Force -ErrorAction SilentlyContinue | Remove-Item -Recurse -Force -ErrorAction SilentlyContinue
Get-ChildItem $sourceRoot -Force -ErrorAction SilentlyContinue | Remove-Item -Recurse -Force -ErrorAction SilentlyContinue
Get-ChildItem $buildTempRoot -Force -ErrorAction SilentlyContinue | Remove-Item -Recurse -Force -ErrorAction SilentlyContinue
Get-ChildItem $wheelRoot -Force -ErrorAction SilentlyContinue | Remove-Item -Recurse -Force -ErrorAction SilentlyContinue
Get-ChildItem $buildTrackerRoot -Force -ErrorAction SilentlyContinue | Remove-Item -Recurse -Force -ErrorAction SilentlyContinue

$env:TMP = $buildTempRoot
$env:TEMP = $buildTempRoot
$env:PIP_BUILD_TRACKER = $buildTrackerRoot

Write-Host "Using Python: $python"
Write-Host "Using nvcc: $nvcc"
Write-Host "Using CUDA root: $cudaRoot"
Write-Host "Using temp root: $buildTempRoot"

& $python -m pip download --no-binary=:all: --no-deps llama-cpp-python -d $downloadRoot

$sdist = Get-ChildItem $downloadRoot -Filter "llama_cpp_python-*.tar.gz" | Select-Object -First 1
if (-not $sdist) {
    throw "Could not find downloaded llama-cpp-python source archive in $downloadRoot"
}

tar -xzf $sdist.FullName -C $extractRoot

$extractedDir = Get-ChildItem $extractRoot -Directory | Select-Object -First 1
if (-not $extractedDir) {
    throw "Could not extract llama-cpp-python source into $extractRoot"
}

$srcDir = Join-Path $sourceRoot "src"
Move-Item -LiteralPath $extractedDir.FullName -Destination $srcDir

Write-Host "Using source dir: $srcDir"

Write-Host "Installing local build backend requirements..."
& $python -m pip install --upgrade scikit-build-core cmake ninja

& $python -m pip wheel --no-deps --no-build-isolation --no-cache-dir $srcDir -w $wheelRoot

$wheel = Get-ChildItem $wheelRoot -Filter "llama_cpp_python-*.whl" | Select-Object -First 1
if (-not $wheel) {
    throw "Wheel build did not produce a llama-cpp-python wheel in $wheelRoot"
}

Write-Host "Using wheel: $($wheel.FullName)"

& $python -m pip install --upgrade --force-reinstall --no-cache-dir $wheel.FullName

Write-Host "llama-cpp-python CUDA build attempt finished."
