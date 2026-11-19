const { execSync, execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const fsExtra = require('fs-extra');

// 1. Parse and Validate Arguments
// Usage: node comic-tool.js {orig_prefix} {ext} {height} {new_prefix} [password] [skip_phases]
// Example: node comic-tool.js My 7z 1400 New_My 'your_password' ''
// 1. 讀取與驗證 Parameter
// 執行方式: node comic-tool.js {orig_prefix} {ext} {height} {new_prefix} {password} {skip_phases}
// 例子: node comic-tool.js My 7z 1400 New_My "your_password" ""
const args = process.argv.slice(2);
if (args.length < 4) {
    console.error('❌ Missing arguments! Usage: node comic-tool.js <orig_prefix> <ext> <height> <new_prefix> [password] [skip_phases]');
    console.error('❌ 參數不足！使用方法: node comic-tool.js <orig_prefix> <ext> <height> <new_prefix> [password] [skip_phases]');
    process.exit(1);
}

const [origPrefix, ext, targetHeight, newPrefix] = args;
const password = args[4] || ''; 
const skipRaw = args[5] || '';  // 6th parameter: e.g., "1,3,5"

// Parse skip list into an array of numbers: [1, 3, 5]
const skipPhases = skipRaw ? skipRaw.split(',').map(num => parseInt(num.trim(), 10)) : [];

const currentDir = process.cwd();

// 2. Scan Directory and Prepare Task List Dynamically (Hybrid Mode)
// 2. 搵出所有符合條件嘅檔案並整理出編號清單
const files = fs.readdirSync(currentDir);
const tasksMap = new Map();
const escapedPrefix = origPrefix.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&');

files.forEach(file => {
    const fullPath = path.join(currentDir, file);
    const isDir = fs.statSync(fullPath).isDirectory();

    if (isDir) {
        // 💡 Updated Regex: Allows optional suffix like [manhuagui] or [kobodl] after the number
        const folderRegex = new RegExp(`^${escapedPrefix}_(\\d+(?:\\.\\d+)?)(?:\\[.*\\])?$`);
        const match = file.match(folderRegex);
        if (match) {
            const num = match[1];
            if (!tasksMap.has(num)) {
                tasksMap.set(num, {
                    file: `[Directory] ${file}`,
                    num: num,
                    unarOutputDir: file,
                    resizeOutputDir: `${newPrefix}_${num}[${targetHeight}]`,
                    finalOrigZip: `${newPrefix}_${num}.zip`,
                    finalResizeZip: `${newPrefix}_${num}[${targetHeight}].zip`,
                    hasArchive: false
                });
            }
        }
    } else {
        // Check if it's an archive file: Prefix_01.epub (or .7z, etc.)
        const fileRegex = new RegExp(`^${escapedPrefix}_(\\d+(?:\\.\\d+)?)\\.${ext}$`, 'i');
        const match = file.match(fileRegex);
        if (match) {
            const num = match[1];
            if (!tasksMap.has(num)) {
                tasksMap.set(num, {
                    file: file,
                    num: num,
                    unarOutputDir: `${origPrefix}_${num}`,
                    resizeOutputDir: `${newPrefix}_${num}[${targetHeight}]`,
                    finalOrigZip: `${newPrefix}_${num}.zip`,
                    finalResizeZip: `${newPrefix}_${num}[${targetHeight}].zip`,
                    hasArchive: true
                });
            } else {
                const existing = tasksMap.get(num);
                existing.file = file;
                existing.hasArchive = true;
            }
        }
    }
});

const tasks = Array.from(tasksMap.values());

if (tasks.length === 0) {
    console.log(`ℹ️ No matching targets found (Prefix: ${origPrefix}_ , Extension: .${ext})`);
    console.log(`ℹ️ 搵唔到符合格式嘅檔案或資料夾 (開頭: ${origPrefix}_ )`);
    process.exit(0);
}

console.log(`🚀 🚀 🚀 Starting batch processing pipeline for ${tasks.length} tasks 🚀 🚀 🚀`);
console.log(`🚀 🚀 🚀 啟動批處理流程，共 ${tasks.length} 個任務 🚀 🚀 🚀`);
if (skipPhases.length > 0) {
    console.log(`⏭️ Skipping phases: ${skipPhases.join(', ')}`);
}

// ==========================================
// Phase 1: UNZIP ALL ARCHIVES
// 階段 1: 全部 UNZIP
// ==========================================
console.log('\n=========================================');
console.log('📂 [Phase 1/6] Extracting all archives (UNZIP)...');
console.log('📂 [Phase 1/6] 開始全部解壓 (UNZIP)...');
console.log('=========================================');
if (skipPhases.includes(1)) {
    console.log('⏭️ [SKIPPED] Phase 1 is skipped by user.');
} else {
    tasks.forEach(task => {
        if (!task.hasArchive) {
            console.log(`⚠️ Archive file missing for volume ${task.num}, skipping extraction (folder already exists).`);
            return;
        }

        console.log(`📦 Extracting: ${task.file} ...`);
        console.log(`📦 正在解壓: ${task.file} ...`);

        let extracted = false;
        const passArg = password ? password : '';

        const sevenZipBinaries = ['7z', '7zz', '7za'];
        for (const bin of sevenZipBinaries) {
            try {
                const args7z = ['x', '-y'];
                if (passArg) {
                    args7z.push(`-p${passArg}`);
                }
                args7z.push(task.file);

                execFileSync(bin, args7z, { stdio: 'inherit' });
                extracted = true;
                break; 
            } catch (e) {}
        }

        if (!extracted) {
            try {
                console.log(`⚠️ 7z/7zz unavailable or failed, attempting unar...`);
                let unarCmd;
                if (passArg) {
                    const safePassword = passArg.replace(/'/g, "'\\''");
                    unarCmd = `unar -p '${safePassword}' "${task.file}"`;
                } else {
                    unarCmd = `unar "${task.file}"`;
                }

                execSync(unarCmd, { stdio: 'inherit' });
            } catch (e) {
                console.error(`❌ Failed to extract ${task.file}:`, e.message);
                console.error(`❌ 解壓 ${task.file} 失敗:`, e.message);
            }
        }
    });
}

// ==========================================
// Phase 2: CREATE NEW DIRECTORIES FOR RESIZED IMAGES
// 階段 2: 全部 CREATE NEW FOLDER
// ==========================================
console.log('\n=========================================');
console.log('📁 [Phase 2/6] Creating directories for resized outputs...');
console.log('📁 [Phase 2/6] 開始全部建立 Resize 暫存資料夾...');
console.log('=========================================');
if (skipPhases.includes(2)) {
    console.log('⏭️ [SKIPPED] Phase 2 is skipped by user.');
} else {
    tasks.forEach(task => {
        console.log(`📂 Creating folder: ${task.resizeOutputDir}`);
        console.log(`📂 建立資料夾: ${task.resizeOutputDir}`);
        if (!fs.existsSync(task.resizeOutputDir)) {
            fs.mkdirSync(task.resizeOutputDir);
        }
    });
}

// ==========================================
// Phase 3: CONVERT & RESIZE ALL IMAGES (MOGRIFY)
// 階段 3: 全部 CONVERT TO JPG (MOGRIFY)
// ==========================================
console.log('\n=========================================');
console.log('🖼️ [Phase 3/6] Processing image resizing and formatting (MOGRIFY)...');
console.log('🖼️ [Phase 3/6] 開始全部轉換及縮放圖片 (MOGRIFY)...');
console.log('=========================================');
if (skipPhases.includes(3)) {
    console.log('⏭️ [SKIPPED] Phase 3 is skipped by user.');
} else {
    tasks.forEach(task => {
        console.log(`⚡ Resizing: ${task.unarOutputDir} -> ${task.resizeOutputDir} ...`);
        console.log(`⚡ 正在 Resize: ${task.unarOutputDir} -> ${task.resizeOutputDir} ...`);
        try {
            let mogrifyCmd = `mogrify -path "${task.resizeOutputDir}/" -format jpg -resize x${targetHeight} -quality 70 "${task.unarOutputDir}/*"`;
            execSync(mogrifyCmd, { stdio: 'inherit' });
        } catch (e) {
            console.error(`❌ Mogrify processing failed for ${task.unarOutputDir}:`, e.message);
            console.error(`❌ Mogrify ${task.unarOutputDir} 失敗:`, e.message);
        }
    });
}

// ==========================================
// Phase 4: ZIP ALL ORIGINAL FILES
// 階段 4: 全部 ZIP (原圖)
// ==========================================
console.log('\n=========================================');
console.log('🤐 [Phase 4/6] Packaging original outputs into Zip archives...');
console.log('🤐 [Phase 4/6] 開始全部打包原圖 (ZIP)...');
console.log('=========================================');
if (skipPhases.includes(4)) {
    console.log('⏭️ [SKIPPED] Phase 4 is skipped by user.');
} else {
    tasks.forEach(task => {
        try {
            console.log(`🤐 Archiving original images: ${task.finalOrigZip} ...`);
            console.log(`🤐 打包原圖: ${task.finalOrigZip} ...`);
            let zipOrigCmd = `zip -j "${task.finalOrigZip}" "./${task.unarOutputDir}/"*`;
            execSync(zipOrigCmd, { stdio: 'inherit' });
        } catch (e) {
            console.error(`❌ Archiving original failed for volume ${task.num}:`, e.message);
            console.error(`❌ 打包編號 ${task.num} 失敗:`, e.message);
        }
    });
}

// ==========================================
// Phase 5: ZIP ALL NEW HEIGHT FILES
// 階段 5: 全部 ZIP (Resize 圖)
// ==========================================
console.log('\n=========================================');
console.log('🤐 [Phase 5/6] Packaging resized outputs into Zip archives...');
console.log('🤐 [Phase 5/6] 開始全部打包 Resize 圖 (ZIP)...');
console.log('=========================================');
if (skipPhases.includes(5)) {
    console.log('⏭️ [SKIPPED] Phase 5 is skipped by user.');
} else {
    tasks.forEach(task => {
        try {
            console.log(`🤐 Archiving resized images: ${task.finalResizeZip} ...`);
            console.log(`🤐 打包 Resize 圖: ${task.finalResizeZip} ...`);
            let zipResizeCmd = `zip -j "${task.finalResizeZip}" "./${task.resizeOutputDir}/"*`;
            execSync(zipResizeCmd, { stdio: 'inherit' });
        } catch (e) {
            console.error(`❌ Archiving resized failed for volume ${task.num}:`, e.message);
            console.error(`❌ 打包編號 ${task.num} 失敗:`, e.message);
        }
    });
}

// ==========================================
// Phase 6: VALIDATE ARCHIVE INTEGRITY & CLEANUP
// 階段 6: 全部 UNZIP TEST & CLEANUP
// ==========================================
console.log('\n=========================================');
console.log('🧪 [Phase 6/6] Verifying archive integrity and purging temporary folders...');
console.log('🧪 [Phase 6/6] 開始全部進行 Zip 測試與清理暫存...');
console.log('=========================================');
if (skipPhases.includes(6)) {
    console.log('⏭️ [SKIPPED] Phase 6 is skipped by user. Temp directories will NOT be cleaned up.');
} else {
    tasks.forEach(task => {
        console.log(`\n🔍 Validating outputs for volume ${task.num}...`);
        console.log(`\n🔍 正在測試編號 ${task.num} 嘅產出...`);

        try {
            if (fs.existsSync(task.finalOrigZip)) {
                let testOrigCmd = `unzip -t "${task.finalOrigZip}"`;
                execSync(testOrigCmd, { stdio: 'ignore' });
                console.log(`✅ ${task.finalOrigZip} -> Verification Passed / 測試通過`);
            } else {
                console.log(`ℹ️ ${task.finalOrigZip} does not exist. Skipped verification.`);
            }
        } catch (e) {
            console.error(`❌ ${task.finalOrigZip} -> Verification FAILED! / 測試失敗！`);
        }

        try {
            if (fs.existsSync(task.finalResizeZip)) {
                let testResizeCmd = `unzip -t "${task.finalResizeZip}"`;
                execSync(testResizeCmd, { stdio: 'ignore' });
                console.log(`✅ ${task.finalResizeZip} -> Verification Passed / 測試通過`);
            } else {
                console.log(`ℹ️ ${task.finalResizeZip} does not exist. Skipped verification.`);
            }
        } catch (e) {
            console.error(`❌ ${task.finalResizeZip} -> Verification FAILED! / 測試失敗！`);
        }

        // 💡 註解：如果你唔想清理現有嘅資料夾，可以將下面清理 folder 嘅 code 註解掉。
        // 現階段保留自動清理，如果你要保留原 folder 可以自行刪除下面 fsExtra 呢兩行：
        console.log(`🧹 Cleaning up temp directories: ${task.unarOutputDir} & ${task.resizeOutputDir}`);
        console.log(`🧹 清理暫存檔: ${task.unarOutputDir} 及 ${task.resizeOutputDir}`);
        if (fs.existsSync(task.unarOutputDir)) {
            fsExtra.removeSync(task.unarOutputDir);
        }
        if (fs.existsSync(task.resizeOutputDir)) {
            fsExtra.removeSync(task.resizeOutputDir);
        }
    });
}

console.log('\n🎉 [FINISH] All execution phases completed successfully!');
console.log('\n🎉 [FINISH] 所有階段全部處理完畢！');

