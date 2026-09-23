import type { SchoolResource } from "./model";

const fractions = `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><title>分数实验台</title><style>
*{box-sizing:border-box}body{margin:0;padding:24px;font:16px/1.6 system-ui,sans-serif;color:#24363d;background:#f7fafb;letter-spacing:0}main{max-width:620px;margin:auto}h1{font-size:24px;margin:0 0 8px}p{margin:8px 0 16px}.controls{display:flex;flex-wrap:wrap;gap:16px;align-items:center}label{display:flex;align-items:center;gap:10px}select,button{font:inherit;min-height:44px;padding:6px 14px;border:1px solid #adbec5;border-radius:6px;background:white;color:#24363d;cursor:pointer}button:focus-visible,select:focus-visible{outline:3px solid #17636b;outline-offset:3px}#tiles{display:grid;grid-template-columns:repeat(var(--n),minmax(0,1fr));gap:4px;margin:24px 0}#tiles button{height:96px;padding:0;background:#fff;border:2px solid #6b8993}#tiles button[aria-pressed=true]{background:#17636b;color:white;border-color:#104e55}output{display:block;font-size:22px;font-weight:700}.note{border-top:1px solid #ccd8de;margin-top:24px;padding-top:12px;font-size:14px;color:#4b6069}@media(max-width:420px){body{padding:16px}#tiles button{height:70px}h1{font-size:21px}}
</style></head><body><main><h1>分数实验台</h1><p>把同一个整体平均分成几份，再选出其中的几份。</p><div class="controls"><label>平均分成<select id="parts" aria-label="平均分成几份"><option>2</option><option>3</option><option selected>4</option><option>6</option><option>8</option></select>份</label><button id="reset">清空选择</button></div><div id="tiles" aria-label="等分区域"></div><output id="result" aria-live="polite"></output><p id="explain"></p><p class="note">观察问题：选出 1/2 和 2/4 时，涂色面积有什么关系？这里的图形表示相同大小的整体。试着用自己的话说明依据。</p></main><script>
const parts=document.getElementById('parts'),tiles=document.getElementById('tiles');let selected=new Set();
function report(){const n=Number(parts.value),k=selected.size;document.getElementById('result').textContent=k+' / '+n;document.getElementById('explain').textContent='平均分成 '+n+' 份，选出了 '+k+' 份。';}
function draw(){selected.clear();tiles.replaceChildren();tiles.style.setProperty('--n',parts.value);for(let i=0;i<Number(parts.value);i++){const b=document.createElement('button');b.type='button';b.textContent=String(i+1);b.setAttribute('aria-label','第 '+(i+1)+' 份');b.setAttribute('aria-pressed','false');b.onclick=()=>{selected.has(i)?selected.delete(i):selected.add(i);b.setAttribute('aria-pressed',String(selected.has(i)));report();};tiles.append(b);}report();}parts.onchange=draw;document.getElementById('reset').onclick=draw;draw();
</script></body></html>`;

export const ACTIVITY_EXAMPLES: SchoolResource[] = [{
  id: "example-html-fractions", origin: "example", title: "分数实验台 · 互动示例", kind: "activity", subject: "数学", grade: "四年级",
  description: "比较同一整体的等分与涂色面积，用观察解释等值分数。内置示例，需教师结合课堂目标校对。",
  author: "教研团队（示例）", scope: "school", rights: "own", updatedAt: Date.UTC(2026, 8, 8), revision: 1,
  fileName: "分数实验台-互动示例.html", mimeType: "text/html", fileSize: new TextEncoder().encode(fractions).length, body: fractions,
}];
