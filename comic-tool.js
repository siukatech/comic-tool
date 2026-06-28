const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const fsExtra = require('fs-extra');

// 1. 讀取與驗證 Parameter
const args = process.argv.slice(2);
if (args.length < 4) {
    console.error('❌ 參數不足！使用方法: node comic-tool.js <orig_prefix> <ext> <height> <new_prefix> [password]');
    process.exit(1);
}

const [origPrefix, ext, targetHeight, newPrefix] = args;
const password = args[4] || ''; 
const currentDir = process.cwd();

// 2. 搵出所有符合條件嘅檔案並整理出編號清單
const files = fs.readdirSync(currentDir);
const tasks = [];

files.forEach(file => {
    const regex = new RegExp(`^${origPrefix}_(\\d+)\\.${ext}$`, 'i');
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

if (tasks.length === 0) {
    console.log(`ℹ️ 搵唔到符合格式嘅檔案 (開頭: ${origPrefix}_ , 結尾: .${ext})`);
    process.exit(0);
}

console.log(`🚀 🚀 🚀 啟動批處理流程，共 ${tasks.length} 個檔案 🚀 🚀 🚀`);

// ==========================================
// 階段 1: 全部 UNZIP
// ==========================================
console.log('\n=========================================');
console.log('📂 [Phase 1/5] 開始全部解壓 (UNZIP)...');
console.log('=========================================');
tasks.forEach(task => {
    console.log(`📦 正在解壓: ${task.file} ...`);
    try {
        let unarCmd = `unar ${password ? `-p "${password}"` : ''} "${task.file}"`;
        execSync(unarCmd, { stdio: 'inherit' });
    } catch (e) {
        console.error(`❌ 解壓 ${task.file} 失敗:`, e.message);
    }
});

// ==========================================
// 階段 2: 全部 CREATE NEW FOLDER
// ==========================================
console.log('\n=========================================');
console.log('📁 [Phase 2/5] 開始全部建立 Resize 暫存資料夾...');
console.log('=========================================');
tasks.forEach(task => {
    console.log(`📂 建立資料夾: ${task.resizeOutputDir}`);
    if (!fs.existsSync(task.resizeOutputDir)) {
        fs.mkdirSync(task.resizeOutputDir);
    }
});

// ==========================================
// 階段 3: 全部 CONVERT TO JPG (MOGRIFY)
// ==========================================
console.log('\n=========================================');
console.log('🖼️ [Phase 3/5] 開始全部轉換及縮放圖片 (MOGRIFY)...');
console.log('=========================================');
tasks.forEach(task => {
    console.log(`⚡ 正在 Resize: ${task.unarOutputDir} -> ${task.resizeOutputDir} ...`);
    try {
        let mogrifyCmd = `mogrify -path "${task.resizeOutputDir}/" -format jpg -resize x${targetHeight} -quality 70 "${task.unarOutputDir}/*"`;
        execSync(mogrifyCmd, { stdio: 'inherit' });
    } catch (e) {
        console.error(`❌ Mogrify ${task.unarOutputDir} 失敗:`, e.message);
    }
});

// ==========================================
// 階段 4: 全部 ZIP (原圖 + Resize 圖)
// ==========================================
console.log('\n=========================================');
console.log('🤐 [Phase 4/5] 開始全部打包 (ZIP)...');
console.log('=========================================');
tasks.forEach(task => {
    try {
        // 4a. Zip 原圖
        console.log(`🤐 打包原圖: ${task.finalOrigZip} ...`);
        let zipOrigCmd = `zip -j "${task.finalOrigZip}" "./${task.unarOutputDir}/"*`;
        execSync(zipOrigCmd, { stdio: 'inherit' });

        // 4b. Zip Resize 圖
        console.log(`🤐 打包 Resize 圖: ${task.finalResizeZip} ...`);
        let zipResizeCmd = `zip -j "${task.finalResizeZip}" "./${task.resizeOutputDir}/"*`;
        execSync(zipResizeCmd, { stdio: 'inherit' });
    } catch (e) {
        console.error(`❌ 打包編號 ${task.num} 失敗:`, e.message);
    }
});

// ==========================================
// 階段 5: 全部 UNZIP TEST & CLEANUP
// ==========================================
console.log('\n=========================================');
console.log('🧪 [Phase 5/5] 開始全部進行 Zip 測試與清理暫存...');
console.log('=========================================');
tasks.forEach(task => {
    console.log(`\n🔍 正在測試編號 ${task.num} 嘅產出...`);
    
    // 測試原圖 Zip
    try {
        let testOrigCmd = `unzip -t "${task.finalOrigZip}"`;
        execSync(testOrigCmd, { stdio: 'ignore' });
        console.log(`✅ ${task.finalOrigZip} -> 測試通過`);
    } catch (e) {
        console.error(`❌ ${task.finalOrigZip} -> 測試失敗！`);
    }

    // 測試 Resize Zip
    try {
        let testResizeCmd = `unzip -t "${task.finalResizeZip}"`;
        execSync(testResizeCmd, { stdio: 'ignore' });
        console.log(`✅ ${task.finalResizeZip} -> 測試通過`);
    } catch (e) {
        console.error(`❌ ${task.finalResizeZip} -> 測試失敗！`);
    }

    // 清理呢個 task 嘅暫存資料夾
    console.log(`🧹 清理暫存檔: ${task.unarOutputDir} 及 ${task.resizeOutputDir}`);
    if (fs.existsSync(task.unarOutputDir)) {
        fsExtra.removeSync(task.unarOutputDir);
    }
    if (fs.existsSync(task.resizeOutputDir)) {
        fsExtra.removeSync(task.resizeOutputDir);
    }
});

console.log('\n🎉 [FINISH] 所有階段全部處理完畢！');

