/* scripts/api-push.js
 * 通过 GitHub Git Data API (api.github.com) 推送文件，绕过被封的 github.com:443。
 * 流程：取 main 当前 commit → 取其 tree → 为本地文件创建 blob → 基于旧 tree 建新 tree → 建提交 → 更新 main ref。
 * 仅当有文件变化时才提交。读取 .gh-token 认证。
 * 用法: node scripts/api-push.js
 */
const https = require('https');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const TOKEN = fs.readFileSync(path.join(ROOT, '.gh-token'), 'utf8').trim();
const OWNER = 'beth-yang', REPO = 'beth-yang.github.com', BRANCH = 'main';
const HDR = { 'Authorization': 'token ' + TOKEN, 'User-Agent': 'beth-push', 'Accept': 'application/vnd.github+json' };

function api(method, p, body) {
  return new Promise((res, rej) => {
    const data = body ? JSON.stringify(body) : null;
    const headers = Object.assign({}, HDR, { 'Content-Type': 'application/json' });
    if (data) headers['Content-Length'] = Buffer.byteLength(data);
    const req = https.request({ method, hostname: 'api.github.com', path: '/repos/' + OWNER + '/' + REPO + p, headers },
      r => { let b = ''; r.on('data', d => b += d); r.on('end', () => { let j = null; try { j = b ? JSON.parse(b) : null; } catch (e) {} res({ status: r.statusCode, json: j, raw: b }); }); });
    req.on('error', rej); if (data) req.write(data); req.end();
  });
}

// 收集要推送的文件（排除 .git / .gh-token / node_modules）
function walk(dir, base) {
  let out = [];
  for (const name of fs.readdirSync(dir)) {
    if (name === '.git' || name === '.gh-token' || name === 'node_modules') continue;
    const p = path.join(dir, name);
    const st = fs.statSync(p);
    if (st.isDirectory()) out = out.concat(walk(p, base));
    else out.push({ path: path.relative(base, p).split(path.sep).join('/'), abs: p });
  }
  return out;
}

async function getTreeRecursive(treeSha) {
  const t = await api('GET', '/git/trees/' + treeSha + '?recursive=1');
  const map = {};
  (t.json.tree || []).forEach(e => { if (e.type === 'blob') map[e.path] = e.sha; });
  return map;
}

async function main() {
  if (!TOKEN || TOKEN === 'PASTE_YOUR_GITHUB_TOKEN_HERE') { console.log('⚠️ .gh-token 未填写真实令牌'); return; }
  const ref = await api('GET', '/git/ref/heads/' + BRANCH);
  if (ref.status !== 200) { console.log('❌ 取 ref 失败:', ref.status, ref.raw); return; }
  const commitSha = ref.json.object.sha;
  const commit = await api('GET', '/git/commits/' + commitSha);
  const baseTree = commit.json.tree.sha;
  const remoteMap = await getTreeRecursive(baseTree);

  const files = walk(ROOT, ROOT);
  const treeItems = []; let changed = 0;
  for (const f of files) {
    const buf = fs.readFileSync(f.abs);
    const blob = await api('POST', '/git/blobs', { content: buf.toString('base64'), encoding: 'base64' });
    if (blob.json.sha !== remoteMap[f.path]) changed++;
    treeItems.push({ path: f.path, mode: '100644', type: 'blob', sha: blob.json.sha });
  }
  if (changed === 0) { console.log('✅ 无文件变化，无需推送'); return; }

  const tree = await api('POST', '/git/trees', { base_tree: baseTree, tree: treeItems });
  const newCommit = await api('POST', '/git/commits', {
    message: 'chore: daily update ' + new Date().toISOString().slice(0, 10),
    tree: tree.json.sha, parents: [commitSha],
    author: { name: 'beth-yang', email: 'beth-yang@users.noreply.github.com' }
  });
  const upd = await api('PATCH', '/git/refs/heads/' + BRANCH, { sha: newCommit.json.sha });
  if (upd.status === 200) console.log('✅ 推送成功，' + changed + ' 个文件变化，commit ' + newCommit.json.sha.slice(0, 7));
  else console.log('❌ 更新 ref 失败:', upd.status, upd.raw);
}
main().catch(e => console.log('❌ 异常:', e.message));
