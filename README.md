# Comic Batch Processor Utility

A Node.js utility script designed to automate the extraction, resizing, and repackaging of comic/manga archives (e.g., .7z, .zip) in structured batches.

It processes files sequentially through distinct pipeline phases (Unzip $\rightarrow$ Mkdir $\rightarrow$ Resize $\rightarrow$ Pack $\rightarrow$ Verify) to ensure integrity and optimize local disk workflow.

## 🚀 Features
* **Phase-by-Phase Batch Processing:** Executes each stage (e.g., extracting all files first) completely before moving to the next, making it easy to catch password or extraction errors early.
* **Auto-Flattening (No Folder Paths):** Repackages images directly into the root of the .zip archive using zip -j.
* **Automated Image Optimization:** Mass-resizes images to a uniform height while preserving aspect ratios and converting formats to optimized .jpg.
* **Integrity Checking:** Automatically runs test extractions (unzip -t) on all newly created archives to guarantee no corrupted outputs.
* **Auto-Cleanup:** Purges temporary processing directories upon completion to save disk space.

## 🛠️ Prerequisites

Before running this tool, ensure you have the following system dependencies installed and available in your system's PATH.

### 1. System CLI Tools
* **unar:** Used for handling archive extractions (especially encrypted .7z files).
```bash
# macOS (Homebrew)
brew install unar
```

* **ImageMagick (mogrify):** Used for batch image manipulation and resizing.
```bash
# macOS (Homebrew)
brew install imagemagick
```

* **zip / unzip:** Standard Linux/macOS utilities used for creating and testing zip files. (Usually pre-installed on macOS/Linux).

### 2. Node.js Environment
* **Node.js:** Version 14.x or higher is recommended.
* **fs-extra:** A Node.js library used for safe and recursive directory removal.
To install the Node dependency, run:
```bash
npm install fs-extra
```

## 📋 Usage
### Syntax
```bash
node comic-tool.js <orig_prefix> <ext> <target_height> <new_prefix> '[password]'
```
**⚠️ Important Note for Zsh/Bash Users:** If your archive password contains special characters like `!`, always enclose the password in single quotes ('...') instead of double quotes to prevent shell expansion errors (e.g., zsh: event not found).
### Example
If you have files named WITCH WATCH-TW_01.7z, WITCH WATCH-TW_02.7z with the password cscjBEn#iU0w!j9f, run:
```bash
node comic-tool.js "WITCH WATCH-TW_" 7z 1400 "WITCH_WATCH" 'cscjBEn#iU0w!j9f'
```
```
# 格式：node comic-tool.js <orig_prefix> <ext> <height> <new_prefix> [password] [skip_phases]
# 例子：skip 第 1, 3, 5 步 (密碼留空就俾個 "" 佢)
node comic-tool.js My 7z 1400 New_My "" "1,3,5"

# 有密碼兼 skip 第 2 步
node comic-tool.js CLAMP 7z 1400 CLAMP_X 'my_password' "2"
```

### Output Results
For an input file `WITCH WATCH-TW_01.7z`, the tool outputs two packages into your current directory:
- WITCH_WATCH_01.zip — The original, high-quality images re-archived without a password and flattened without subdirectories.
- WITCH_WATCH_01[1400].zip — The optimized version containing resized 1400px height .jpg images.

## 🔄 Workflow Pipeline
The script execution is clearly logged in the terminal across 5 strict phases:
```
[Phase 1/6] 📂 Extracts all matching archive volumes into temp folders.
[Phase 2/6] 📁 Creates dedicated target output directories.
[Phase 3/6] 🖼️ Executes `mogrify` batch resize targeting the specified height.
[Phase 4/6] 🤐 Compresses original images into flat zip files.
[Phase 5/6] 🤐 Compresses resized images into flat zip files.
[Phase 6/6] 🧪 Validates zip integrity (`unzip -t`) and deletes temp folders.
```

## 📄 License
This project is open-source and available under the MIT License.
