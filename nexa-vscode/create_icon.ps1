Add-Type -AssemblyName System.Drawing

$bmp = New-Object System.Drawing.Bitmap 128, 128
$g = [System.Drawing.Graphics]::FromImage($bmp)
$g.Clear([System.Drawing.Color]::FromArgb(31, 41, 55))

$brush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(96, 165, 250))
$font = New-Object System.Drawing.Font('Segoe UI', 48, [System.Drawing.FontStyle]::Bold)
$g.DrawString('N', $font, $brush, 28, 22)

$bmp.Save('media/nexa.png', [System.Drawing.Imaging.ImageFormat]::Png)

$g.Dispose()
$font.Dispose()
$brush.Dispose()
$bmp.Dispose()
