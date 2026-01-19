const express = require("express");
const app = express();
const axios = require("axios");
const os = require('os');
const fs = require("fs");
const path = require("path");
const { exec } = require('child_process');

// --- 基础配置适配 Scalingo ---
const PORT = process.env.PORT || 3000;
const PROJECT_URL = process.env.PROJECT_URL || ''; 
const FILE_PATH = '/tmp'; // 强制使用 /tmp 目录
const UUID = process.env.UUID || '1041499a-f9d3-427b-8c56-956b8cd7866a';
const NEZHA_SERVER = process.env.NEZHA_SERVER || 'nz.117.de5.net:443';
const NEZHA_KEY = process.env.NEZHA_KEY || 'p3joFK1jc3Z31YXqMXfNPvjjxx1lQknL';
const ARGO_PORT = 8001;

// 随机化文件名防止冲突
const webPath = path.join(FILE_PATH, 'web_node');
const botPath = path.join(FILE_PATH, 'bot_node');
const agentPath = path.join(FILE_PATH, 'agent_node');

// 1. 立即启动 Web 服务，确保通过 Scalingo 的 60s 存活检查
app.get("/", (req, res) => res.send("System Running"));
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server is listening on port ${PORT}`);
  main(); // 启动后台逻辑
});

// 2. 主逻辑
async function main() {
  const arch = os.arch() === 'arm64' ? 'arm64' : 'amd64';
  
  // 下载并授权二进制文件
  const files = [
    { name: webPath, url: `https://${arch}.ssss.nyc.mn/web` },
    { name: botPath, url: `https://${arch}.ssss.nyc.mn/bot` },
    { name: agentPath, url: `https://${arch}.ssss.nyc.mn/agent` }
  ];

  for (const file of files) {
    try {
      await downloadFile(file.url, file.name);
      fs.chmodSync(file.name, 0o755);
      console.log(`Successfully prepared ${file.name}`);
    } catch (e) {
      console.error(`Error preparing ${file.name}: ${e.message}`);
    }
  }

  // 运行哪吒
  const tls = NEZHA_SERVER.includes('443') ? 'true' : 'false';
  const nzConfig = `client_secret: ${NEZHA_KEY}\nserver: ${NEZHA_SERVER}\ntls: ${tls}\nuuid: ${UUID}\nreport_delay: 4\nskip_connection_count: true\nskip_procs_count: true`;
  fs.writeFileSync(path.join(FILE_PATH, 'nz.yaml'), nzConfig);
  exec(`nohup ${agentPath} -c ${FILE_PATH}/nz.yaml >/dev/null 2>&1 &`);

  // 运行 Argo (临时隧道模式)
  exec(`nohup ${botPath} tunnel --edge-ip-version auto --no-autoupdate --protocol http2 --url http://localhost:${PORT} >/dev/null 2>&1 &`);

  // 3. 强力保活逻辑 (每 5 分钟自访问)
  if (PROJECT_URL) {
    setInterval(() => {
      axios.get(`${PROJECT_URL}?t=${Date.now()}`).catch(() => {});
      console.log("[Keep-Alive] Heartbeat triggered.");
    }, 5 * 60 * 1000);
  }
}

async function downloadFile(url, dest) {
  const response = await axios({ url, method: 'GET', responseType: 'stream' });
  const writer = fs.createWriteStream(dest);
  response.data.pipe(writer);
  return new Promise((resolve, reject) => {
    writer.on('finish', resolve);
    writer.on('error', reject);
  });
}
