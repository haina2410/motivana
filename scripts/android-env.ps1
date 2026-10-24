# Load with: . .\scripts\android-env.ps1
# Environment changes apply only to this PowerShell session.
if (-not $env:GRADLE_USER_HOME) {
    $userGradleHome = [Environment]::GetEnvironmentVariable('GRADLE_USER_HOME', 'User')
    if ($userGradleHome) {
        $env:GRADLE_USER_HOME = $userGradleHome
    }
}

$sdkPath = if ($env:ANDROID_HOME) {
    $env:ANDROID_HOME
} elseif ($env:ANDROID_SDK_ROOT) {
    $env:ANDROID_SDK_ROOT
} else {
    Join-Path $env:LOCALAPPDATA 'Android\Sdk'
}

if (-not (Test-Path -LiteralPath $sdkPath)) {
    throw "Android SDK not found at $sdkPath. Install it with Android Studio's SDK Manager, or set ANDROID_HOME."
}

if (-not $env:JAVA_HOME) {
    $localJdk = Get-ChildItem (Join-Path $env:USERPROFILE '.jdks') -Directory -Filter '*17*' -ErrorAction SilentlyContinue |
        Where-Object { Test-Path -LiteralPath (Join-Path $_.FullName 'bin\java.exe') } |
        Sort-Object Name -Descending |
        Select-Object -First 1
    if ($localJdk) {
        $env:JAVA_HOME = $localJdk.FullName
    }
}

if (-not $env:JAVA_HOME -or -not (Test-Path -LiteralPath (Join-Path $env:JAVA_HOME 'bin\java.exe'))) {
    throw 'Set JAVA_HOME to a JDK 17 installation before loading this script.'
}

$env:ANDROID_HOME = $sdkPath
$env:ANDROID_SDK_ROOT = $sdkPath
$androidPaths = @(
    (Join-Path $env:JAVA_HOME 'bin')
    (Join-Path $sdkPath 'platform-tools')
    (Join-Path $sdkPath 'emulator')
)
$env:Path = ($androidPaths + ($env:Path -split ';') | Select-Object -Unique) -join ';'
Write-Host "Android SDK: $sdkPath"
Write-Host "Java: $env:JAVA_HOME"
