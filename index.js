const express = require("express");
const app = express();
const axios = require("axios");
const os = require('os');
const fs = require("fs");
const path = require("path");
const { exec } = require('child_process');

// 强制配置
const PORT = process.env.PORT || 3000;
const FILE_PATH = '/tmp'; // 必须是 /tmp
const PROJECT_URL = process.env.PROJECT_URL || '';
const UUID = process.env.UUID || '1041499a-f9d3-427b-8c56-956b8cd7866a';
const NEZHA_SERVER = process.env.NEZHA_SERVER || 'nz.117.de5.net:443';
const NEZHA_KEY = process.env.NEZHA_KEY || 'p3joFK1jc3Z31YXqMXfNPvjjxx1lQknL';

// 定义二进制文件路径
const webPath = path.join(FILE_PATH, 'web');
const botPath = path.join(FILE_PATH, 'bot');
const agentPath = path.join(FILE_PATH, 'agent');

// --- 关键点 1: 必须第一时间监听端口 ---
app.get("/", (req, res) => res.send("Service Status: Online"));

app.listen(PORT, '0.0.0.0', () => {
  console.log(`[Scalingo] 端口 ${PORT} 监听成功，开始启动后台组件...`);
  startBackends(); // 监听成功后再跑下载和运行逻辑
});

async function startBackends() {
  const arch = os.arch().includes('arm') ? 'arm64' : 'amd64';
  
  // 关键点 2: 确保所有下载都在 /tmp 目录下完成
  try {
    console.log(`[Scalingo] 检测到系统架构: ${arch}`);
    
    // 下载哪吒/Argo (并行下载提高效率)
    await Promise.all([
      downloadFile(`https://${arch}.ssss.nyc.mn/web`, webPath),
      downloadFile(`https://${arch}.ssss.nyc.mn/bot`, botPath),
      downloadFile(`https://${arch}.ssss.nyc.mn/agent`, agentPath)
    ]);

    // 授权
    [webPath, botPath, agentPath].forEach(p => fs.chmodSync(p, 0o755));

    // 运行哪吒
    const tls = NEZHA_SERVER.includes('443') ? 'true' : 'false';
    const nzConfig = `client_secret: ${NEZHA_KEY}\nserver: ${NEZHA_SERVER}\ntls: ${tls}\nuuid: ${UUID}\nreport_delay: 4\nskip_connection_count: true\nskip_procs_count: true`;
    fs.writeFileSync(path.join(FILE_PATH, 'nz.yaml'), nzConfig);
    
    exec(`nohup ${agentPath} -c ${FILE_PATH}/nz.yaml >/dev/null 2>&1 &`);
    console.log("[Scalingo] Nezha Agent 启动命令已发出");

    // 运行 Argo (临时隧道)
    exec(`nohup ${botPath} tunnel --edge-ip-version auto --no-autoupdate --protocol http2 --url http://localhost:${PORT} >/dev/null 2>&1 &`);
    console.log("[Scalingo] Argo Tunnel 启动命令已发出");

    // 自访问保活
    if (PROJECT_URL) {
      setInterval(() => {
        axios.get(`${PROJECT_URL}?t=${Date.now()}`).catch(() => {});
      }, 5 * 60 * 1000);
    }
    
  } catch (err) {
    console.error("[Scalingo] 启动过程出错:", err.message);
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
