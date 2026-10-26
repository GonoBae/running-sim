# Run at the repository root. Four selected files, not a database crawl.
New-Item -ItemType Directory -Force -Path 'data/raw/cmu' | Out-Null
foreach ($asset in @('35/35.asf','35/35_17.amc','127/127.asf','127/127_06.amc')) {
    Invoke-WebRequest -Uri ('https://mocap.cs.cmu.edu/subjects/' + $asset) -UseBasicParsing -OutFile ('data/raw/cmu/' + $asset.Split('/')[-1])
}
# Usage terms: https://mocap.cs.cmu.edu/ and https://mocap.cs.cmu.edu/faqs.php
