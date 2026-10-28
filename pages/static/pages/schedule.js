// schedule.js —— 前端互動：下拉選單、按鈕效果、畫課表、注意事項輪播
(() => {   // 用一個函式包起來，避免變數汙染全域

  // 小工具：$ 找一個元素，$$ 找全部元素（回傳陣列）
  const $  = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];

  const API = document.body.dataset.api;   // 讀取 HTML <body data-api="..."> 的網址
  const state = {};                        // 記錄目前選了什麼，例如 { year:'113', dept:'資訊工程學系' }

  /* ========== 1. 下拉選單 ========== */
  $$('.dd').forEach(dd => {
    const btn = $('.dd-btn', dd);            // 顯示目前選項的按鈕
    const label = $('span', btn);            // 按鈕裡顯示文字的位置
    const items = $$('li', dd);              // 所有選項

    // 選中某一項：記到 state、更新按鈕文字、標記 .sel
    const pick = li => {
      state[dd.dataset.key] = li.dataset.value;
      label.textContent = li.textContent;
      items.forEach(i => i.classList.toggle('sel', i === li));
    };
    pick(items[0]);                          // 一開始先選第一個當預設

    // 點按鈕：關掉其他已展開的，再切換自己（open 這個 class 會觸發 CSS 展開動畫）
    btn.addEventListener('click', e => {
      e.stopPropagation();                   // 避免這次點擊傳到下面的「點空白處關閉」
      $$('.dd.open').forEach(o => o !== dd && o.classList.remove('open'));
      dd.classList.toggle('open');
    });
    // 點選項：選中並收起
    items.forEach(li => li.addEventListener('click', () => { pick(li); dd.classList.remove('open'); }));
  });
  // 點頁面其他地方：收起所有下拉
  document.addEventListener('click', () => $$('.dd.open').forEach(d => d.classList.remove('open')));

  /* ========== 2. 按鈕點擊波紋 ========== */
  $$('.btn').forEach(b => b.addEventListener('pointerdown', e => {
    const r = b.getBoundingClientRect();              // 按鈕在畫面上的位置與大小
    const s = Math.max(r.width, r.height);            // 波紋直徑
    const el = document.createElement('span');        // 建立一個圓形
    el.className = 'ripple';
    // 讓圓心剛好在滑鼠點擊的位置
    el.style.cssText = `width:${s}px;height:${s}px;left:${e.clientX - r.left - s / 2}px;top:${e.clientY - r.top - s / 2}px`;
    b.appendChild(el);
    setTimeout(() => el.remove(), 650);               // 動畫結束後移除
  }));

  /* ========== 3. 底部提示訊息 ========== */
  let toastTimer;
  const toast = msg => {
    const t = $('#toast');
    t.textContent = msg;
    t.classList.add('show');                          // 加上 .show → CSS 讓它浮現
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => t.classList.remove('show'), 2200);   // 2.2 秒後收起
  };

  /* ========== 4. 畫課表 ========== */
  // 依課名算出一個色相（0~360），同一門課永遠同色
  const hue = s => [...s].reduce((a, c) => a + c.charCodeAt(0) * 7, 0) % 360;

  function renderTable(d) {
    // occ[節次][星期]：放「課程物件」代表這格是課的起點，'skip' 代表被上面的合併格佔住
    const occ = d.periods.map(() => d.days.map(() => null));
    d.courses.forEach(c => {
      for (let i = 0; i < c.span; i++) occ[c.start + i][c.day] = i === 0 ? c : 'skip';
    });

    // 表頭：第一格「節次/時間」+ 週一~週五
    let h = '<thead><tr><th>節次<small>時間</small></th>' + d.days.map(x => `<th>${x}</th>`).join('') + '</tr></thead><tbody>';

    d.periods.forEach((p, r) => {                      // r = 第幾列（節次）
      h += `<tr><td class="period">${p.label}<small>${p.start}–${p.end}</small></td>`;
      d.days.forEach((_, c) => {                       // c = 第幾欄（星期）
        const o = occ[r][c];
        if (o === 'skip') return;                      // 被合併的格子不用畫
        if (!o) { h += '<td></td>'; return; }          // 沒課：畫空格
        const k = hue(o.name);
        // rowspan = 往下合併幾列；animation-delay 讓卡片依序彈出
        h += `<td rowspan="${o.span}">
          <div class="course" style="background:hsl(${k} 70% 90%);border-left:4px solid hsl(${k} 55% 55%);animation-delay:${(r * 5 + c) * 25}ms">
            <b>${o.name}</b><span>${o.time}</span><span>${o.teacher}・${o.room}</span>
          </div></td>`;
      });
      h += '</tr>';
    });
    $('#schedule').innerHTML = h + '</tbody>';         // 一次寫進表格
  }

  /* ========== 5. 注意事項：動態排程輪播 ========== */
  const STEP = 3000;                                   // 每則停留 3 秒（毫秒）
  let timer, raf;

  function renderNotices(list) {
    clearInterval(timer); cancelAnimationFrame(raf);   // 重新載入時先停掉舊的計時
    const ul = $('#noticeList'), bar = $('#noticeBar');

    // 為每則公告排一個時間：從 08:00 開始，每則間隔 90 分鐘
    const base = new Date(); base.setHours(8, 0, 0, 0);
    ul.innerHTML = list.map((t, i) => {
      const hm = new Date(base.getTime() + i * 90 * 60000).toTimeString().slice(0, 5);
      return `<li style="--i:${i}"><time>${hm} 提醒</time>${t}</li>`;   // --i 給 CSS 做依序進場
    }).join('');

    const lis = $$('li', ul);
    let cur = 0;                                       // 目前高亮第幾則

    const show = () => {
      lis.forEach((li, i) => li.classList.toggle('active', i === cur));          // 只有 cur 這則是 active
      ul.scrollTo({ top: lis[cur].offsetTop - ul.offsetTop - 4, behavior: 'smooth' });  // 平滑捲到該則
      // 進度條：0% → 100%，花 STEP 毫秒
      const t0 = performance.now();
      const tick = now => {
        const p = Math.min((now - t0) / STEP, 1);
        bar.style.width = p * 100 + '%';
        if (p < 1) raf = requestAnimationFrame(tick);
      };
      cancelAnimationFrame(raf); raf = requestAnimationFrame(tick);
    };

    show();
    // 每 3 秒換下一則；到最後一則用 % 回到第一則
    timer = setInterval(() => { cur = (cur + 1) % lis.length; show(); }, STEP);
  }

  /* ========== 6. 向後端要資料（篩選） ========== */
  async function load(btn) {
    btn?.classList.add('loading');                     // 按鈕變成載入中（有轉圈）
    try {
      const res = await fetch(API + '?' + new URLSearchParams(state));   // 例：/api/schedule/?year=113&dept=...
      const d = await res.json();                      // 把回傳的 JSON 轉成物件
      await new Promise(r => setTimeout(r, btn ? 450 : 0));   // 故意等一下，讓轉圈效果看得到
      renderTable(d);
      renderNotices(d.notices);
      if (btn) toast(`已更新：${state.year} ${state.semester}・${state.dept}・${state.grade}`);
    } catch {
      toast('載入失敗，請稍後再試');
    }
    btn?.classList.remove('loading');
  }

  $('#queryBtn').addEventListener('click', e => load(e.currentTarget));
  $('#logoutBtn').addEventListener('click', () => toast('已登出（示範：可改成導向 Django 登出網址）'));

  load();   // 頁面一打開就先載入一次
})();