# Light-mode codemod for Marketing / Workspace / Accounting pages +
# their per-section component folders. For every dark-only Tailwind
# utility (text-white, bg-white/N, border-white/N, hover:bg-white/…),
# prepend a matching light-mode pair so the class string reads as
# `light-token dark:original`. The (?<!\S*dark:\S*) lookbehind prevents
# double-wrapping anything that's already paired.

$ErrorActionPreference = "Stop"

$replacements = @(
  # text colours (bare = full opacity, then opacity steps in 5 % grades)
  @{ from = '(?<!\S*dark:\S*)\btext-white\b(?![/-])'; to = 'text-slate-900 dark:text-white' },
  @{ from = '(?<!\S*dark:\S*)\btext-white/25\b';      to = 'text-slate-300 dark:text-white/25' },
  @{ from = '(?<!\S*dark:\S*)\btext-white/30\b';      to = 'text-slate-400 dark:text-white/30' },
  @{ from = '(?<!\S*dark:\S*)\btext-white/35\b';      to = 'text-slate-400 dark:text-white/35' },
  @{ from = '(?<!\S*dark:\S*)\btext-white/40\b';      to = 'text-slate-400 dark:text-white/40' },
  @{ from = '(?<!\S*dark:\S*)\btext-white/45\b';      to = 'text-slate-500 dark:text-white/45' },
  @{ from = '(?<!\S*dark:\S*)\btext-white/50\b';      to = 'text-slate-500 dark:text-white/50' },
  @{ from = '(?<!\S*dark:\S*)\btext-white/55\b';      to = 'text-slate-600 dark:text-white/55' },
  @{ from = '(?<!\S*dark:\S*)\btext-white/60\b';      to = 'text-slate-600 dark:text-white/60' },
  @{ from = '(?<!\S*dark:\S*)\btext-white/65\b';      to = 'text-slate-600 dark:text-white/65' },
  @{ from = '(?<!\S*dark:\S*)\btext-white/70\b';      to = 'text-slate-700 dark:text-white/70' },
  @{ from = '(?<!\S*dark:\S*)\btext-white/75\b';      to = 'text-slate-700 dark:text-white/75' },
  @{ from = '(?<!\S*dark:\S*)\btext-white/80\b';      to = 'text-slate-800 dark:text-white/80' },
  @{ from = '(?<!\S*dark:\S*)\btext-white/85\b';      to = 'text-slate-800 dark:text-white/85' },
  @{ from = '(?<!\S*dark:\S*)\btext-white/90\b';      to = 'text-slate-900 dark:text-white/90' },

  # hover text
  @{ from = '(?<!\S*dark:\S*)\bhover:text-white\b(?![/-])'; to = 'hover:text-slate-900 dark:hover:text-white' },
  @{ from = '(?<!\S*dark:\S*)\bhover:text-white/70\b';      to = 'hover:text-slate-700 dark:hover:text-white/70' },
  @{ from = '(?<!\S*dark:\S*)\bhover:text-white/80\b';      to = 'hover:text-slate-800 dark:hover:text-white/80' },
  @{ from = '(?<!\S*dark:\S*)\bhover:text-white/85\b';      to = 'hover:text-slate-800 dark:hover:text-white/85' },

  # placeholder
  @{ from = '(?<!\S*dark:\S*)\bplaceholder:text-white/35\b'; to = 'placeholder:text-slate-400 dark:placeholder:text-white/35' },
  @{ from = '(?<!\S*dark:\S*)\bplaceholder:text-white/40\b'; to = 'placeholder:text-slate-400 dark:placeholder:text-white/40' },
  @{ from = '(?<!\S*dark:\S*)\bplaceholder:text-white/45\b'; to = 'placeholder:text-slate-500 dark:placeholder:text-white/45' },
  @{ from = '(?<!\S*dark:\S*)\bplaceholder:text-white/50\b'; to = 'placeholder:text-slate-500 dark:placeholder:text-white/50' },

  # backgrounds — integer opacities
  @{ from = '(?<!\S*dark:\S*)\bbg-white/5\b';  to = 'bg-slate-50 dark:bg-white/5' },
  @{ from = '(?<!\S*dark:\S*)\bbg-white/10\b'; to = 'bg-slate-200 dark:bg-white/10' },
  @{ from = '(?<!\S*dark:\S*)\bbg-white/15\b'; to = 'bg-slate-200 dark:bg-white/15' },
  @{ from = '(?<!\S*dark:\S*)\bbg-white/20\b'; to = 'bg-slate-300 dark:bg-white/20' },
  @{ from = '(?<!\S*dark:\S*)\bbg-white/30\b'; to = 'bg-slate-300 dark:bg-white/30' },

  # backgrounds — arbitrary (Tailwind /[0.0X])
  @{ from = '(?<!\S*dark:\S*)\bbg-white/\[0\.02\]'; to = 'bg-slate-50/50 dark:bg-white/[0.02]' },
  @{ from = '(?<!\S*dark:\S*)\bbg-white/\[0\.03\]'; to = 'bg-slate-50 dark:bg-white/[0.03]' },
  @{ from = '(?<!\S*dark:\S*)\bbg-white/\[0\.04\]'; to = 'bg-slate-50 dark:bg-white/[0.04]' },
  @{ from = '(?<!\S*dark:\S*)\bbg-white/\[0\.05\]'; to = 'bg-slate-100 dark:bg-white/[0.05]' },
  @{ from = '(?<!\S*dark:\S*)\bbg-white/\[0\.06\]'; to = 'bg-slate-100 dark:bg-white/[0.06]' },
  @{ from = '(?<!\S*dark:\S*)\bbg-white/\[0\.07\]'; to = 'bg-slate-100 dark:bg-white/[0.07]' },
  @{ from = '(?<!\S*dark:\S*)\bbg-white/\[0\.08\]'; to = 'bg-slate-200 dark:bg-white/[0.08]' },
  @{ from = '(?<!\S*dark:\S*)\bbg-white/\[0\.09\]'; to = 'bg-slate-200 dark:bg-white/[0.09]' },

  # borders
  @{ from = '(?<!\S*dark:\S*)\bborder-white/5\b';  to = 'border-slate-100 dark:border-white/5' },
  @{ from = '(?<!\S*dark:\S*)\bborder-white/10\b'; to = 'border-slate-200 dark:border-white/10' },
  @{ from = '(?<!\S*dark:\S*)\bborder-white/15\b'; to = 'border-slate-200 dark:border-white/15' },
  @{ from = '(?<!\S*dark:\S*)\bborder-white/20\b'; to = 'border-slate-300 dark:border-white/20' },
  @{ from = '(?<!\S*dark:\S*)\bborder-white/25\b'; to = 'border-slate-300 dark:border-white/25' },
  @{ from = '(?<!\S*dark:\S*)\bborder-white/30\b'; to = 'border-slate-300 dark:border-white/30' },

  # hover backgrounds
  @{ from = '(?<!\S*dark:\S*)\bhover:bg-white/5\b';  to = 'hover:bg-slate-100 dark:hover:bg-white/5' },
  @{ from = '(?<!\S*dark:\S*)\bhover:bg-white/10\b'; to = 'hover:bg-slate-200 dark:hover:bg-white/10' },
  @{ from = '(?<!\S*dark:\S*)\bhover:bg-white/15\b'; to = 'hover:bg-slate-200 dark:hover:bg-white/15' },
  @{ from = '(?<!\S*dark:\S*)\bhover:bg-white/20\b'; to = 'hover:bg-slate-300 dark:hover:bg-white/20' },
  @{ from = '(?<!\S*dark:\S*)\bhover:bg-white/\[0\.03\]'; to = 'hover:bg-slate-50 dark:hover:bg-white/[0.03]' },
  @{ from = '(?<!\S*dark:\S*)\bhover:bg-white/\[0\.04\]'; to = 'hover:bg-slate-50 dark:hover:bg-white/[0.04]' },
  @{ from = '(?<!\S*dark:\S*)\bhover:bg-white/\[0\.05\]'; to = 'hover:bg-slate-100 dark:hover:bg-white/[0.05]' },
  @{ from = '(?<!\S*dark:\S*)\bhover:bg-white/\[0\.06\]'; to = 'hover:bg-slate-100 dark:hover:bg-white/[0.06]' },
  @{ from = '(?<!\S*dark:\S*)\bhover:bg-white/\[0\.07\]'; to = 'hover:bg-slate-100 dark:hover:bg-white/[0.07]' },
  @{ from = '(?<!\S*dark:\S*)\bhover:bg-white/\[0\.08\]'; to = 'hover:bg-slate-200 dark:hover:bg-white/[0.08]' },
  @{ from = '(?<!\S*dark:\S*)\bhover:bg-white/\[0\.09\]'; to = 'hover:bg-slate-200 dark:hover:bg-white/[0.09]' },

  # hover borders
  @{ from = '(?<!\S*dark:\S*)\bhover:border-white/10\b'; to = 'hover:border-slate-300 dark:hover:border-white/10' },
  @{ from = '(?<!\S*dark:\S*)\bhover:border-white/15\b'; to = 'hover:border-slate-300 dark:hover:border-white/15' },
  @{ from = '(?<!\S*dark:\S*)\bhover:border-white/20\b'; to = 'hover:border-slate-400 dark:hover:border-white/20' },

  # Accent text colours used for icons / pills / chips. The pale 200/300
  # shades are designed to read on a dark surface; on a white card they
  # disappear. Pair each with a stronger 600/700 light variant.
  @{ from = '(?<!\S*dark:\S*)\btext-emerald-200\b'; to = 'text-emerald-700 dark:text-emerald-200' },
  @{ from = '(?<!\S*dark:\S*)\btext-emerald-300\b'; to = 'text-emerald-700 dark:text-emerald-300' },
  @{ from = '(?<!\S*dark:\S*)\btext-emerald-400\b'; to = 'text-emerald-600 dark:text-emerald-400' },
  @{ from = '(?<!\S*dark:\S*)\btext-amber-200\b';   to = 'text-amber-700 dark:text-amber-200' },
  @{ from = '(?<!\S*dark:\S*)\btext-amber-300\b';   to = 'text-amber-700 dark:text-amber-300' },
  @{ from = '(?<!\S*dark:\S*)\btext-amber-400\b';   to = 'text-amber-600 dark:text-amber-400' },
  @{ from = '(?<!\S*dark:\S*)\btext-sky-200\b';     to = 'text-sky-700 dark:text-sky-200' },
  @{ from = '(?<!\S*dark:\S*)\btext-sky-300\b';     to = 'text-sky-700 dark:text-sky-300' },
  @{ from = '(?<!\S*dark:\S*)\btext-sky-400\b';     to = 'text-sky-600 dark:text-sky-400' },
  @{ from = '(?<!\S*dark:\S*)\btext-fuchsia-200\b'; to = 'text-fuchsia-700 dark:text-fuchsia-200' },
  @{ from = '(?<!\S*dark:\S*)\btext-fuchsia-300\b'; to = 'text-fuchsia-700 dark:text-fuchsia-300' },
  @{ from = '(?<!\S*dark:\S*)\btext-rose-200\b';    to = 'text-rose-700 dark:text-rose-200' },
  @{ from = '(?<!\S*dark:\S*)\btext-rose-300\b';    to = 'text-rose-700 dark:text-rose-300' },
  @{ from = '(?<!\S*dark:\S*)\btext-indigo-200\b';  to = 'text-indigo-700 dark:text-indigo-200' },
  @{ from = '(?<!\S*dark:\S*)\btext-indigo-300\b';  to = 'text-indigo-700 dark:text-indigo-300' },
  @{ from = '(?<!\S*dark:\S*)\btext-violet-200\b';  to = 'text-violet-700 dark:text-violet-200' },
  @{ from = '(?<!\S*dark:\S*)\btext-violet-300\b';  to = 'text-violet-700 dark:text-violet-300' },
  @{ from = '(?<!\S*dark:\S*)\btext-orange-200\b';  to = 'text-orange-700 dark:text-orange-200' },
  @{ from = '(?<!\S*dark:\S*)\btext-orange-300\b';  to = 'text-orange-700 dark:text-orange-300' }
)

$paths = @(
  "src\app\marketing",
  "src\app\workspace",
  "src\app\accounting",
  "src\app\admin",
  "src\app\hr",
  "src\components"
)

# Files that intentionally stay dark-only OR are design-token files
# that the codemod must not touch. Matched on the path suffix.
$excludes = @(
  "src\components\Workspace\ui.js"
)

$totalFiles = 0
$modifiedFiles = 0

foreach ($p in $paths) {
  if (-not (Test-Path $p)) { continue }

  $files = Get-ChildItem -Recurse -Path $p -Include *.jsx,*.tsx,*.js,*.ts -ErrorAction SilentlyContinue
  foreach ($f in $files) {
    $rel = $f.FullName.Substring($PWD.Path.Length + 1)
    $skip = $false
    foreach ($ex in $excludes) {
      if ($rel -eq $ex) { $skip = $true; break }
    }
    if ($skip) { continue }

    $totalFiles++
    $content = [System.IO.File]::ReadAllText($f.FullName)
    $original = $content

    foreach ($r in $replacements) {
      $content = [System.Text.RegularExpressions.Regex]::Replace($content, $r.from, $r.to)
    }

    if ($content -ne $original) {
      [System.IO.File]::WriteAllText($f.FullName, $content)
      $modifiedFiles++
      Write-Output "modified: $($f.FullName.Replace($PWD.Path + '\', ''))"
    }
  }
}

Write-Output ""
Write-Output "scanned: $totalFiles files"
Write-Output "modified: $modifiedFiles files"
