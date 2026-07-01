$docxOriginalPath = "C:\Users\jashwanthd.LP-IT-007\Downloads\responses.docx"
$docxPath = "C:\ANTIGRAVITY\EMAIL AUTOMATION\scratch\temp_responses.docx"
$outputPath = "C:\ANTIGRAVITY\EMAIL AUTOMATION\scratch\extracted_text.txt"

# Copy the file to avoid locks
if (Test-Path $docxPath) {
    Remove-Item $docxPath -Force
}
Copy-Item $docxOriginalPath -Destination $docxPath -Force

Add-Type -AssemblyName System.IO.Compression.FileSystem
$zip = [System.IO.Compression.ZipFile]::OpenRead($docxPath)
$entry = $zip.Entries | Where-Object { $_.FullName -eq "word/document.xml" }
$stream = $entry.Open()
$reader = New-Object System.IO.StreamReader($stream)
$xmlText = $reader.ReadToEnd()
$reader.Close()
$zip.Dispose()

# Remove the temp copy
Remove-Item $docxPath -Force

[xml]$xml = $xmlText
$namespaces = New-Object System.Xml.XmlNamespaceManager($xml.NameTable)
$namespaces.AddNamespace("w", "http://schemas.openxmlformats.org/wordprocessingml/2006/main")

# Extract paragraphs
$paragraphs = $xml.SelectNodes("//w:p", $namespaces)
$lines = New-Object System.Collections.Generic.List[string]

foreach ($p in $paragraphs) {
    # Get all text elements within this paragraph
    $textNodes = $p.SelectNodes(".//w:t", $namespaces)
    $pText = ""
    foreach ($node in $textNodes) {
        $pText += $node.InnerText
    }
    if ($pText.Trim().Length -gt 0) {
        $lines.Add($pText)
    } else {
        $lines.Add("") # Keep spacing
    }
}

$outputText = $lines -join "`r`n"
$outputText | Out-File -FilePath $outputPath -Encoding utf8
Write-Host "Extraction completed successfully. Output saved to: $outputPath"
