# Run manually from this checkout. Does not run migrations or start Spring Boot.
$ErrorActionPreference = 'Stop'
$backendRoot = (Resolve-Path (Join-Path $PSScriptRoot '../..')).Path
Push-Location $backendRoot
try {
    & mvn.cmd -q -DskipTests compile org.apache.maven.plugins:maven-dependency-plugin:3.6.1:build-classpath '-Dmdep.outputFile=target/v61-repair-classpath.txt'
    if ($LASTEXITCODE -ne 0) { throw 'Maven compile/classpath failed.' }
    $dependencyClasspath = (Get-Content -Raw 'target/v61-repair-classpath.txt').Trim()
    $repairClasspath = (Join-Path $backendRoot 'target/classes') + [IO.Path]::PathSeparator + $dependencyClasspath
    & java --class-path $repairClasspath (Join-Path $PSScriptRoot 'RepairMissingV61.java') $backendRoot
    if ($LASTEXITCODE -ne 0) { throw 'Repair stopped. Read the error above; do not disable validation.' }
} finally {
    Pop-Location
}
