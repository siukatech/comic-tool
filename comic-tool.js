const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const fsExtra = require('fs-extra');

// 1. Parse and Validate Arguments
// Usage: node comic-tool.js {orig_prefix} {ext} {height} {new_prefix} [password]
// Example: node comic-tool.js My 7z 1400 New_My 'your_password'
// 1. 讀取與驗證 Parameter
// 執行方式: node comic-tool.js {orig_prefix} {ext} {height} {new_prefix} {password}
// 例子: node comic-tool.js My 7z 1400 New_My "your_password"
const args = process.argv.slice(2);
if (args.length < 4) {
    console.error('❌ Missing arguments! Usage: node comic-tool.js <orig_prefix> <ext> <height> <new_prefix> [password] [skip_phases]');
    // console.error('❌ 參數不足！使用方法: node comic-tool.js <orig_prefix> <ext> <height> <new_prefix> [password] [skip_phases]');
    process.exit(1);
}

const [origPrefix, ext, targetHeight, newPrefix] = args;
const password = args[4] || ''; 
const skipRaw = args[5] || '';  // 6th parameter: e.g., "1,3,5"

// Parse skip list into an array of numbers: [1, 3, 5]
const skipPhases = skipRaw ? skipRaw.split(',').map(num => parseInt(num.trim(), 10)) : [];

const currentDir = process.cwd();

// 2. Scan Directory and Prepare Task List Dynamically
// 2. 搵出所有符合條件嘅檔案並整理出編號清單
const files = fs.readdirSync(currentDir);
const tasks = [];
const escapedPrefix = origPrefix.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&');

if (skipPhases.includes(1)) {
    // If extraction is skipped, identify tasks by scanning existing target folders directly
    console.log(`ℹ️ Phase 1 (Unzip) is skipped. Scanning directory for extracted folders...`);
    files.forEach(file => {
        const folderRegex = new RegExp(`^${escapedPrefix}_(\\d+(?:\\.\\d+)?)$`);
        const match = file.match(folderRegex);
        
        // Verify it matches the pattern AND is a directory, not a stray file
        if (match && fs.statSync(path.join(currentDir, file)).isDirectory()) {
            const num = match[1];
            tasks.push({
                file: `[Directory] ${file}`,
                num: num,
                unarOutputDir: file,
                resizeOutputDir: `${newPrefix}_${num}[${targetHeight}]`,
                finalOrigZip: `${newPrefix}_${num}.zip`,
                finalResizeZip: `${newPrefix}_${num}[${targetHeight}].zip`
            });
        }
    });
} else {
    // Standard approach: find tasks based on archive extension (.7z, .zip, etc.)
    files.forEach(file => {
        const regex = new RegExp(`^${escapedPrefix}_(\\d+(?:\\.\\d+)?)\\.${ext}$`, 'i');
        const match = file.match(regex);
        if (match) {
            tasks.push({
                file: file,
                num: match[1],
                unarOutputDir: `${origPrefix}_${match[1]}`,
                resizeOutputDir: `${newPrefix}_${match[1]}[${targetHeight}]`,
                finalOrigZip: `${newPrefix}_${match[1]}.zip`,
                finalResizeZip: `${newPrefix}_${match[1]}[${targetHeight}].zip`
            });
        }
    });
}

if (tasks.length === 0) {
    console.log(`ℹ️ No matching targets found (Prefix: ${origPrefix}_ , Extension: .${ext})`);
    // console.log(`ℹ️ 搵唔到符合格式嘅檔案或資料夾 (開頭: ${origPrefix}_ , Extension: .${ext})`);
    process.exit(0);
}

console.log(`🚀 🚀 🚀 Starting batch processing pipeline for ${tasks.length} tasks 🚀 🚀 🚀`);
// console.log(`🚀 🚀 🚀 啟動批處理流程，共 ${tasks.length} 個任務 🚀 🚀 🚀`);
if (skipPhases.length > 0) {
    console.log(`⏭️ Skipping phases: ${skipPhases.join(', ')}`);
}

// ==========================================
// Phase 1: UNZIP ALL ARCHIVES
// 階段 1: 全部 UNZIP
// ==========================================
console.log('\n=========================================');
console.log('📂 [Phase 1/6] Extracting all archives (UNZIP)...');
// console.log('📂 [Phase 1/6] 開始全部解壓 (UNZIP)...');
console.log('=========================================');
if (skipPhases.includes(1)) {
    console.log('⏭️ [SKIPPED] Phase 1 is skipped by user.');
} else {
    tasks.forEach(task => {
        console.log(`📦 Extracting: ${task.file} ...`);
        // console.log(`📦 正在解壓: ${task.file} ...`);
        try {
            // Escape any single quotes inside the password string itself if present
            const safePassword = password.replace(/'/g, "'\\''");
            let unarCmd = `unar ${password ? `-p '${safePassword}'` : ''} "${task.file}"`;
            console.log(unarCmd);
            execSync(unarCmd, { stdio: 'inherit' });
        } catch (e) {
            console.error(`❌ Failed to extract ${task.file}:`, e.message);
            // console.error(`❌ 解壓 ${task.file} 失敗:`, e.message);
        }

        // let success = false;
        // const passArg = password ? password : '';
        // // 嘗試 1: 先用 7z / 7zz (對 7z 密碼檔相容性最高)
        // try {
        //     // -y: 自動回答 Yes, -p: 帶入密碼 (密碼緊貼 -p)
        //     const cmd7z = `7z x -y ${passArg ? `"-p${passArg}"` : ''} "${task.file}"`;
        //     execSync(cmd7z, { stdio: 'inherit' });
        //     success = true;
        // } catch (e) {
        //     // 如果系統冇 install 7z，試下 7zz (macOS Homebrew 常用名)
        //     try {
        //         const cmd7zz = `7zz x -y ${passArg ? `"-p${passArg}"` : ''} "${task.file}"`;
        //         execSync(cmd7zz, { stdio: 'inherit' });
        //         success = true;
        //     } catch (err7zz) {
        //         // 7z / 7zz 都唔得，先 fallback 去 unar
        //     }
        // }
        // // 嘗試 2: 如果 7z 冇安裝或失敗，使用 unar
        // if (!success) {
        //     try {
        //         console.log(`⚠️ 7z command unavailable or failed, falling back to unar...`);
        //         let unarCmd = `unar ${passArg ? `-p "${passArg.replace(/"/g, '\\"')}"` : ''} "${task.file}"`;
        //         execSync(unarCmd, { stdio: 'inherit' });
        //     } catch (e) {
        //         console.error(`❌ Failed to extract ${task.file}:`, e.message);
        //         // console.error(`❌ 解壓 ${task.file} 失敗:`, e.message);
        //     }
        // }

    });
}

// ==========================================
// Phase 2: CREATE NEW DIRECTORIES FOR RESIZED IMAGES
// 階段 2: 全部 CREATE NEW FOLDER
// ==========================================
console.log('\n=========================================');
console.log('📁 [Phase 2/6] Creating directories for resized outputs...');
// console.log('📁 [Phase 2/6] 開始全部建立 Resize 暫存資料夾...');
console.log('=========================================');
if (skipPhases.includes(2)) {
    console.log('⏭️ [SKIPPED] Phase 2 is skipped by user.');
} else {
    tasks.forEach(task => {
        console.log(`📂 Creating folder: ${task.resizeOutputDir}`);
        // console.log(`📂 建立資料夾: ${task.resizeOutputDir}`);
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
// console.log('🖼️ [Phase 3/6] 開始全部轉換及縮放圖片 (MOGRIFY)...');
console.log('=========================================');
if (skipPhases.includes(3)) {
    console.log('⏭️ [SKIPPED] Phase 3 is skipped by user.');
} else {
    tasks.forEach(task => {
        console.log(`⚡ Resizing: ${task.unarOutputDir} -> ${task.resizeOutputDir} ...`);
        // console.log(`⚡ 正在 Resize: ${task.unarOutputDir} -> ${task.resizeOutputDir} ...`);
        try {
            let mogrifyCmd = `mogrify -path "${task.resizeOutputDir}/" -format jpg -resize x${targetHeight} -quality 70 "${task.unarOutputDir}/*"`;
            execSync(mogrifyCmd, { stdio: 'inherit' });
        } catch (e) {
            console.error(`❌ Mogrify processing failed for ${task.unarOutputDir}:`, e.message);
            // console.error(`❌ Mogrify ${task.unarOutputDir} 失敗:`, e.message);
        }
    });
}

// ==========================================
// Phase 4: ZIP ALL ORIGINAL FILES
// 階段 4: 全部 ZIP (原圖)
// ==========================================
console.log('\n=========================================');
console.log('🤐 [Phase 4/6] Packaging original outputs into Zip archives...');
// console.log('🤐 [Phase 4/6] 開始全部打包原圖 (ZIP)...');
console.log('=========================================');
if (skipPhases.includes(4)) {
    console.log('⏭️ [SKIPPED] Phase 4 is skipped by user.');
} else {
    tasks.forEach(task => {
        try {
            console.log(`🤐 Archiving original images: ${task.finalOrigZip} ...`);
            // console.log(`🤐 打包原圖: ${task.finalOrigZip} ...`);
            let zipOrigCmd = `zip -j "${task.finalOrigZip}" "./${task.unarOutputDir}/"*`;
            execSync(zipOrigCmd, { stdio: 'inherit' });
        } catch (e) {
            console.error(`❌ Archiving original failed for volume ${task.num}:`, e.message);
            // console.error(`❌ 打包編號 ${task.num} 失敗:`, e.message);
        }
    });
}

// ==========================================
// Phase 5: ZIP ALL NEW HEIGHT FILES
// 階段 5: 全部 ZIP (Resize 圖)
// ==========================================
console.log('\n=========================================');
console.log('🤐 [Phase 5/6] Packaging resized outputs into Zip archives...');
// console.log('🤐 [Phase 5/6] 開始全部打包 Resize 圖 (ZIP)...');
console.log('=========================================');
if (skipPhases.includes(5)) {
    console.log('⏭️ [SKIPPED] Phase 5 is skipped by user.');
} else {
    tasks.forEach(task => {
        try {
            console.log(`🤐 Archiving resized images: ${task.finalResizeZip} ...`);
            // console.log(`🤐 打包 Resize 圖: ${task.finalResizeZip} ...`);
            let zipResizeCmd = `zip -j "${task.finalResizeZip}" "./${task.resizeOutputDir}/"*`;
            execSync(zipResizeCmd, { stdio: 'inherit' });
        } catch (e) {
            console.error(`❌ Archiving resized failed for volume ${task.num}:`, e.message);
            // console.error(`❌ 打包編號 ${task.num} 失敗:`, e.message);
        }
    });
}

// ==========================================
// Phase 6: VALIDATE ARCHIVE INTEGRITY & CLEANUP
// 階段 6: 全部 UNZIP TEST & CLEANUP
// ==========================================
console.log('\n=========================================');
console.log('🧪 [Phase 6/6] Verifying archive integrity and purging temporary folders...');
// console.log('🧪 [Phase 6/6] 開始全部進行 Zip 測試與清理暫存...');
console.log('=========================================');
if (skipPhases.includes(6)) {
    console.log('⏭️ [SKIPPED] Phase 6 is skipped by user. Temp directories will NOT be cleaned up.');
} else {
    tasks.forEach(task => {
        console.log(`\n🔍 Validating outputs for volume ${task.num}...`);
        // console.log(`\n🔍 正在測試編號 ${task.num} 嘅產出...`);

        // Test Original Zip Integrity
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

        // Test Resized Zip Integrity
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

        // Purge temporary folders
        console.log(`🧹 Cleaning up temp directories: ${task.unarOutputDir} & ${task.resizeOutputDir}`);
        // console.log(`🧹 清理暫存檔: ${task.unarOutputDir} 及 ${task.resizeOutputDir}`);
        if (fs.existsSync(task.unarOutputDir)) {
            fsExtra.removeSync(task.unarOutputDir);
        }
        if (fs.existsSync(task.resizeOutputDir)) {
            fsExtra.removeSync(task.resizeOutputDir);
        }
    });
}

console.log('\n🎉 [FINISH] All execution phases completed successfully!');
// console.log('\n🎉 [FINISH] 所有階段全部處理完畢！');

