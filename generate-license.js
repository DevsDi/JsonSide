/**
 * JSON Side 激活码生成脚本（简单方案）
 *
 * 运行方式：node generate-license.js
 *
 * 输出：
 * - licenses.txt：激活码列表（用于发送给用户）
 * - licenses-valid.js：有效激活码列表（用于插件验证）
 */

const fs = require('fs');

// 激活码数量
const LICENSE_COUNT = 100;

// 已生成的激活码（防重复）
const generated = new Set();

/**
 * 生成单个激活码
 * 格式：JSIDE-XXXX-XXXX-XXXX（16位字符）
 */
function generateLicense() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let key = '';

  // 生成 12 位随机字符
  for (let i = 0; i < 12; i++) {
    key += chars.charAt(Math.floor(Math.random() * chars.length));
  }

  // 格式化：JSIDE-XXXX-XXXX-XXXX
  return `JSIDE-${key.slice(0, 4)}-${key.slice(4, 8)}-${key.slice(8, 12)}`;
}

/**
 * 生成多个激活码
 */
function generateLicenses(count) {
  const licenses = [];

  while (licenses.length < count) {
    const key = generateLicense();
    if (!generated.has(key)) {
      generated.add(key);
      licenses.push(key);
    }
  }

  return licenses;
}

// 生成激活码
console.log('正在生成激活码...\n');
const licenses = generateLicenses(LICENSE_COUNT);

// 保存为文本文件（用于发送给用户）
const txtContent = licenses.map((key, i) => `${i + 1}. ${key}`).join('\n');
fs.writeFileSync('licenses.txt', txtContent);

// 保存为 JS 文件（用于插件验证）
const jsContent = `/**
 * 有效激活码列表
 * 由 generate-license.js 生成
 */
const VALID_LICENSES = ${JSON.stringify(licenses, null, 2)};

// 导出供验证使用
if (typeof module !== 'undefined') {
  module.exports = { VALID_LICENSES };
}
`;
fs.writeFileSync('licenses-valid.js', jsContent);

// 输出结果
console.log('✅ 已生成 ' + LICENSE_COUNT + ' 个激活码\n');
console.log('文件输出：');
console.log('  - licenses.txt      (激活码列表，用于发送给用户)');
console.log('  - licenses-valid.js (有效列表，用于插件验证)\n');
console.log('激活码列表：');
console.log('─'.repeat(25));
console.log(txtContent);
console.log('─'.repeat(25));
