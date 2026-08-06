/**
 * Supabase 数据库自动化一键部署脚本 (读取本地安全配置)
 */
const fs = require('fs');
const path = require('path');

function getEnvConfig() {
  const envPath = path.join(__dirname, '../.env.supabase');
  let token = process.env.SUPABASE_ACCESS_TOKEN;
  let ref = process.env.SUPABASE_PROJECT_REF || 'geooowvgscsyffnrgelx';

  if (fs.existsSync(envPath)) {
    const lines = fs.readFileSync(envPath, 'utf8').split('\n');
    lines.forEach(line => {
      const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
      if (match) {
        const key = match[1];
        const value = match[2].trim();
        if (key === 'SUPABASE_ACCESS_TOKEN') token = value;
        if (key === 'SUPABASE_PROJECT_REF') ref = value;
      }
    });
  }
  return { token, ref };
}

async function deployDatabase() {
  const { token, ref } = getEnvConfig();

  if (!token) {
    console.error('❌ 未找到 SUPABASE_ACCESS_TOKEN 密钥配置！');
    process.exit(1);
  }

  console.log('🚀 开始自动部署 Supabase 云端数据库架构...');

  const sqlPath = path.join(__dirname, '../supabase_setup.sql');
  if (!fs.existsSync(sqlPath)) {
    console.error('❌ 找不到 supabase_setup.sql 文件！');
    process.exit(1);
  }

  const sqlContent = fs.readFileSync(sqlPath, 'utf8');

  try {
    const response = await fetch(`https://api.supabase.com/v1/projects/${ref}/database/query`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ query: sqlContent })
    });

    if (response.ok) {
      console.log('✅ Supabase 云端数据库自动化部署成功！全盘数据库架构已同步至最新版。');
    } else {
      const errText = await response.text();
      console.error('❌ 部署数据库失败:', response.status, errText);
    }
  } catch (err) {
    console.error('❌ 网络请求异常:', err.message);
  }
}

deployDatabase();
