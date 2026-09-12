param(
  [string]$Root = (Split-Path -Parent $MyInvocation.MyCommand.Path)
)

$ErrorActionPreference = 'Stop'
$listener = [System.Net.HttpListener]::new()
$port = 8765
while ($true) {
  try {
    $listener.Prefixes.Clear()
    $listener.Prefixes.Add("http://127.0.0.1:$port/")
    $listener.Start()
    break
  } catch {
    $port++
    if ($port -gt 8865) { throw '找不到可用的本地端口。' }
  }
}

Start-Process "http://127.0.0.1:$port/index.html?desktop=1"
$mime = @{
  '.html' = 'text/html; charset=utf-8'; '.js' = 'text/javascript; charset=utf-8';
  '.css' = 'text/css; charset=utf-8'; '.json' = 'application/json; charset=utf-8';
  '.png' = 'image/png'; '.jpg' = 'image/jpeg'; '.jpeg' = 'image/jpeg';
  '.svg' = 'image/svg+xml'; '.ico' = 'image/x-icon'
}

try {
  while ($listener.IsListening) {
    $context = $listener.GetContext()
    try {
      $relative = [Uri]::UnescapeDataString($context.Request.Url.AbsolutePath.TrimStart('/'))
      if ([string]::IsNullOrWhiteSpace($relative)) { $relative = 'index.html' }
      $candidate = [IO.Path]::GetFullPath((Join-Path $Root $relative))
      $rootFull = [IO.Path]::GetFullPath($Root).TrimEnd('\') + '\'
      if (-not $candidate.StartsWith($rootFull, [StringComparison]::OrdinalIgnoreCase) -or -not [IO.File]::Exists($candidate)) {
        $context.Response.StatusCode = 404
        $bytes = [Text.Encoding]::UTF8.GetBytes('Not Found')
      } else {
        $bytes = [IO.File]::ReadAllBytes($candidate)
        $ext = [IO.Path]::GetExtension($candidate).ToLowerInvariant()
        if ($mime.ContainsKey($ext)) { $context.Response.ContentType = $mime[$ext] }
        $context.Response.StatusCode = 200
      }
      $context.Response.ContentLength64 = $bytes.Length
      $context.Response.OutputStream.Write($bytes, 0, $bytes.Length)
    } catch {
      $context.Response.StatusCode = 500
    } finally {
      $context.Response.Close()
    }
  }
} finally {
  $listener.Stop()
  $listener.Close()
}
