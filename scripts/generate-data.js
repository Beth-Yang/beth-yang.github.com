/* scripts/generate-data.js
 * 每日数据生成：从 index.html 提取数据常量，按当日(dayOfYear)轮播选出今日内容，
 * 写入 data/<YYYY-MM-DD>.json 和 data/latest.json。
 * 用法: node scripts/generate-data.js
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const HTML = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');

/* 从 index.html 中提取某个 const 的字面量值（数组/对象），用括号配平 + 跳过字符串 */
function extractConst(name, src) {
  const decl = new RegExp('const\\s+' + name + '\\s*=', 'g');
  const m = decl.exec(src);
  if (!m) throw new Error('找不到常量 ' + name);
  let i = m.index + m[0].length;
  while (i < src.length && /\s/.test(src[i])) i++;
  const open = src[i];
  if (open !== '[' && open !== '{') throw new Error(name + ' 不是数组/对象字面量');
  let depth = 0, inStr = false, strCh = '';
  const start = i;
  for (; i < src.length; i++) {
    const c = src[i];
    if (inStr) {
      if (c === '\\') { i++; continue; }
      if (c === strCh) inStr = false;
      continue;
    }
    if (c === '"' || c === "'" || c === '`') { inStr = true; strCh = c; continue; }
    if (c === '[' || c === '{') depth++;
    else if (c === ']' || c === '}') { depth--; if (depth === 0) { i++; break; } }
  }
  return eval('(' + src.slice(start, i) + ')');
}

const QUOTES = extractConst('QUOTES', HTML);
const SHOWS = extractConst('SHOWS', HTML);
const NEWS_TRANSCRIPT = extractConst('NEWS_TRANSCRIPT', HTML);
const INVEST_PLAN = extractConst('INVEST_PLAN', HTML);
const XHS_DATA = extractConst('XHS_DATA', HTML);
const RECIPES = extractConst('RECIPES', HTML);

const ALL_LESSONS = [...INVEST_PLAN[1].weeks, ...INVEST_PLAN[2].weeks, ...INVEST_PLAN[3].weeks];

function dayOfYear() {
  const d = new Date();
  const start = new Date(d.getFullYear(), 0, 0);
  return Math.floor((d - start) / 86400000);
}
function pad(n) { return n < 10 ? '0' + n : '' + n; }
function todayStr() {
  const d = new Date();
  return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
}
function weekday() {
  return ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六'][new Date().getDay()];
}

const doy = dayOfYear();
const bundle = {
  generatedAt: new Date().toISOString(),
  date: todayStr(),
  weekday: weekday(),
  dayOfYear: doy,
  quote: QUOTES[doy % QUOTES.length],
  english: {
    show: SHOWS[doy % SHOWS.length],
    newsTranscript: NEWS_TRANSCRIPT
  },
  investLesson: ALL_LESSONS[doy % ALL_LESSONS.length],
  xhs: XHS_DATA[doy % XHS_DATA.length],
  recipe: RECIPES[doy % RECIPES.length]
};

const dataDir = path.join(ROOT, 'data');
fs.mkdirSync(dataDir, { recursive: true });
const dailyPath = path.join(dataDir, todayStr() + '.json');
const latestPath = path.join(dataDir, 'latest.json');
fs.writeFileSync(dailyPath, JSON.stringify(bundle, null, 2), 'utf8');
fs.writeFileSync(latestPath, JSON.stringify(bundle, null, 2), 'utf8');

// 索引文件：列出已生成的日期
const files = fs.readdirSync(dataDir).filter(f => /^\d{4}-\d{2}-\d{2}\.json$/.test(f)).sort();
fs.writeFileSync(path.join(dataDir, 'index.json'), JSON.stringify({ dates: files, latest: 'latest.json' }, null, 2), 'utf8');

console.log('✅ 已生成今日数据:');
console.log('   ' + dailyPath);
console.log('   ' + latestPath);
console.log('   日期: ' + bundle.date + ' ' + bundle.weekday + '  语录: ' + bundle.quote.slice(0, 24) + '…');
