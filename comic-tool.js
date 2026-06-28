const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const fsExtra = require('fs-extra'); // 引入用作方便刪除 folder

// 1. 讀取與驗證 Parameter
// 執行方式: node comic-tool.js {orig_prefix} {ext} {height} {new_prefix} {password}
// 例子: node comic-tool.js My 7z 1400 New_My "your_password"
const args = process.argv.slice(2);
if (args.length < 4) {
    console.error('❌ 參數不足！使用方法: node comic-tool.js <orig_prefix> <ext> <height> <new_prefix> [password]');
    process.exit(1);
}

const [origPrefix, ext, targetHeight, newPrefix] = args;
const password = args[4] || ''; // 第5個參數為可選密碼

const currentDir = process.cwd();

// 2. 搵出所有符合條件嘅 archive files
const files = fs.readdirSync(currentDir);
const targetFiles = files.filter(file => {
    // 搭配 RegEx 檢查，例如開頭係 My_ 兼夾 extension 啱
    const regex = new RegExp(`^${origPrefix}_\\d+\\.${ext}$`, 'i');
    return regex.test(file);
});

if (targetFiles.length === 0) {
    console.log(`ℹ️ 搵唔到符合格式嘅檔案 (開頭: ${origPrefix}_ , 結尾: .${ext})`);
    process.exit(0);
}

console.log(`🚀 搵到 ${targetFiles.length} 個檔案準備處理...`);

// 3. Loop 每個 file 處理
targetFiles.forEach(file => {
    // 從檔名提取編號 (例如從 "My_01.7z" 攞出 "01")
    const match = file.match(new RegExp(`^${origPrefix}_(\\d+)\\.${ext}$`, 'i'));
    if (!match) return;
    const num = match[1];

    console.log(`\n-----------------------------------------`);
    console.log(`📦 正在處理: ${file} (編號: ${num})`);
    console.log(`-----------------------------------------`);

    // 定義各個暫存資料夾名稱與最終產出名稱
    const unarOutputDir = `${origPrefix}_${num}`; // unar 預設會解壓去呢個同名 folder
    const resizeOutputDir = `${newPrefix}_${num}[${targetHeight}]`;
    const finalOrigZip = `${newPrefix}_${num}.zip`;
    const finalResizeZip = `${newPrefix}_${num}[${targetHeight}].zip`;

    try {
        // --- Step 1: Unzip ---
        console.log(`逐步 1: 正在解壓 ${file}...`);
        let unarCmd = `unar ${password ? `-p "${password}"` : ''} "${file}"`;
        execSync(unarCmd, { stdio: 'inherit' });

        // --- Step 2: Mkdir for resize ---
        console.log(`逐步 2: 建立暫存資料夾 ${resizeOutputDir}...`);
        if (!fs.existsSync(resizeOutputDir)) {
            fs.mkdirSync(resizeOutputDir);
        }

        // --- Step 3: Mogrify (Resize) ---
        console.log(`逐步 3: 正在 Resize 圖片至 height ${targetHeight}...`);
        // 注意：原 command 嘅 "My_01/*" 喺呢度轉做動態 path
        let mogrifyCmd = `mogrify -path "${resizeOutputDir}/" -format jpg -resize x${targetHeight} -quality 70 "${unarOutputDir}/*"`;
        execSync(mogrifyCmd, { stdio: 'inherit' });

        // --- Step 4: Zip 原圖 (無密碼, 無 path) ---
        console.log(`逐步 4: 打包原圖至 ${finalOrigZip}...`);
        let zipOrigCmd = `zip -j "${finalOrigZip}" "./${unarOutputDir}/"*`;
        execSync(zipOrigCmd, { stdio: 'inherit' });

        // --- Step 5: Test 原圖 Zip ---
        console.log(`逐步 5: 測試原圖 Zip 檔...`);
        let testOrigCmd = `unzip -t "${finalOrigZip}"`;
        execSync(testOrigCmd, { stdio: 'ignore' }); // 測試成功就唔 print 太長嘅 log
        console.log(`✅ ${finalOrigZip} 測試成功！`);

        // --- Step 6: Zip Resize 圖 ---
        console.log(`逐步 6: 打包 Resize 圖至 ${finalResizeZip}...`);
        let zipResizeCmd = `zip -j "${finalResizeZip}" "./${resizeOutputDir}/"*`;
        execSync(zipResizeCmd, { stdio: 'inherit' });

        // --- Step 7: Test Resize Zip ---
        console.log(`逐步 7: 測試 Resize Zip 檔...`);
        let testResizeCmd = `unzip -t "${finalResizeZip}"`;
        execSync(testResizeCmd, { stdio: 'ignore' });
        console.log(`✅ ${finalResizeZip} 測試成功！`);

    } catch (error) {
        console.error(`❌ 處理 ${file} 時發生錯誤:`, error.message);
    } finally {
        // --- Step 8: Cleanup ---
        console.log(`🧹 清理暫存資料夾...`);
        if (fs.existsSync(unarOutputDir)) {
            fsExtra.removeSync(unarOutputDir);
        }
        if (fs.existsSync(resizeOutputDir)) {
            fsExtra.removeSync(resizeOutputDir);
        }
    }
});

console.log('\n🎉 所有檔案處理完畢！');

