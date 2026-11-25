/* 誘客の確認（広島・SQL 725）。選ばれた伝票の女の子がスクショを提出し、担当以外の黒服が［根拠あり］［曖昧］を押す
   女の子：LINE の［提出］（?go=yukyaku）から開く。スクショは3枚まで。黒服が押す前まで1回だけ再提出できる（3枚まとめて差し替え）。根拠あり・曖昧は本人に知らせない（画面に出さない）
   黒服：閉店作業「誘客の確認」。担当の子の分は件数だけ（スクショとボタンを出さない） */
const ykDay = d => { const m = String(d || '').match(/^(\d{4})-(\d{2})-(\d{2})/); if(!m) return ''; const w = '日月火水木金土'[new Date(Date.UTC(+m[1], +m[2] - 1, +m[3])).getUTCDay()]; return `${+m[2]}/${+m[3]}（${w}）`; };
const ykBig = urls => uiViewH(urls.map(u => `<img src="${esc(u)}" style="display:block;width:100%;height:auto;border-radius:8px;margin-bottom:8px">`).join(''));   /* 3枚まで縦に並べる */
const ykPick = {};   /* 選んだスクショ（お願いごと・3枚まで。提出の前に枠に出す） */
const ykThumbs = (us, h, attr) => `<div ${attr} style="display:grid;grid-template-columns:repeat(${us.length},1fr);gap:4px;height:${h}px">${us.map(u => `<img src="${esc(u)}" style="width:100%;height:${h}px;object-fit:contain;background:#fff;border:1px solid var(--line);border-radius:${h > 80 ? 10 : 6}px;display:block;min-width:0">`).join('')}</div>`;

/* お願い1件のカード（ご来店｜締め・お客様・スクショの枠｜ボタン） */
function ykCard(y){
  const slot = y => { const f = ykPick[y.id], us = f ? f.map(x => URL.createObjectURL(x)) : (y.urls || []);
    return us.length ? ykThumbs(us, 150, `data-ykv="${y.id}"`)
      : `<div style="height:150px;border:1.5px dashed var(--line);border-radius:10px;display:flex;align-items:center;justify-content:center;color:var(--muted);font-size:13px">スクショ</div>`; };
  const pick = (y, t) => `<label class="btn${t === '再提出' ? '' : ' g'}" style="display:flex;flex-direction:column;align-items:center;justify-content:center;margin:${t === '再提出' ? 'auto 0 0' : '0'};height:70px">${t}<small style="font-size:11px;font-weight:400;opacity:.8">${t === '再提出' ? '差し替え・3枚まで' : '3枚まで'}</small><input type="file" accept="image/*" multiple data-ykf="${y.id}" style="display:none"></label>`;
  const side = y => {
    if(!y.shot_no) return `${pick(y, 'スクショを選ぶ')}<button class="btn" data-yks="${y.id}" style="margin:10px 0 0;height:70px">提出</button>`;
    const st = `<div class="sm" style="color:var(--ok);font-weight:700">提出 ${esc(y.submitted_at || '')}</div><div class="muted sm" style="margin-top:2px">${y.shot_no >= 2 ? '再提出済' : '再提出は1回'}</div>`;
    if(y.shot_no >= 2 || !y.can_submit) return `${st}<button class="btn" disabled style="margin:auto 0 0;height:70px;opacity:.5">再提出</button>`;
    return ykPick[y.id] ? `${st}<button class="btn" data-yks="${y.id}" style="margin:auto 0 0;height:70px">再提出</button>` : `${st}${pick(y, '再提出')}`; };
  return `<div class="card"><div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;padding-bottom:10px;border-bottom:1px solid var(--line)">
      <div><div class="muted sm">ご来店</div><div style="font-weight:700;font-size:15px">${ykDay(y.visit_day)}</div></div>
      <div><div class="muted sm">締め</div><div style="font-weight:700;font-size:15px">${ykDay(y.close_day)} 閉店作業</div></div></div>
    <div style="margin-top:10px"><div class="muted sm">お客様</div><div style="font-weight:700;font-size:19px">${esc(y.customer || '')}様</div>
      <div class="muted sm" style="margin-top:2px">今回のご来店につながったやり取り<span style="white-space:nowrap">（着信履歴・LINE・メッセージ）</span></div></div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:12px">${slot(y)}<div style="display:flex;flex-direction:column">${side(y)}</div></div></div>`;
}

/* 提出・再提出（選んだスクショを縮めて置き場へ送ってから、提出を記録する） */
async function ykSubmit(L, b){ const y = L.find(z => z.id === b.dataset.yks), f = ykPick[y.id];
    if(!f){ await uiAlert('スクショの写真を選んでください'); return; }
    b.disabled = true;
    try{
      for(let k = 0; k < f.length; k++){ const blob = await shrinkJpeg(f[k]);
        const up = await sb.storage.from('sales-shots').upload(`${y.next_shots[k]}.jpg`, blob, { contentType:'image/jpeg', upsert:false }); if(up.error && !/exists|Duplicate/i.test(up.error.message)) throw up.error; }
      const q = await sb.rpc('cast_yukyaku_submit', { p_token: TOKEN, p_id: y.id, p_count: f.length }); if(q.error) throw q.error;
      delete ykPick[y.id];
      await uiAlert(y.shot_no ? '再提出しました' : '提出しました');
      ykList();
    }catch(e){ b.disabled = false; await uiAlert(e.message || String(e)); }
  }

async function ykList(){
  setBack(home); show('<div class="muted" style="padding:20px">読み込み中…</div>');
  const r = await sb.rpc('cast_yukyaku_list', { p_token: TOKEN }); if(r.error){ show(`<div class="card">${esc(r.error.message)}</div>`); return; }
  const L = r.data || [];
  show(`<div class="ttl">誘客の確認</div>${L.map(ykCard).join('') || '<div class="card muted">今日の誘客の確認はありません</div>'}`);
  const M = $('main');
  M.querySelectorAll('[data-ykf]').forEach(i => i.onchange = async () => { const fs = [...i.files]; i.value = ''; if(!fs.length) return;
    if(fs.length > 3){ await uiAlert('スクショは3枚までです'); return; }
    ykPick[i.dataset.ykf] = fs; ykList(); });
  M.querySelectorAll('[data-ykv]').forEach(g => g.onclick = () => ykBig([...g.querySelectorAll('img')].map(im => im.src)));
  M.querySelectorAll('[data-yks]').forEach(b => b.onclick = () => ykSubmit(L, b));
}

/* 黒服の閉店作業「誘客の確認」（17_open.js の HC_BODY・HC_WIRE から呼ぶ） */
function hcBodyYukyaku(H){ const {D, sv, td} = H; const L = (D && D.rows) || [], own = (D && D.own) || 0;
  const badge = t => `<span style="flex:none;font-size:11px;padding:1px 6px;border-radius:999px;white-space:nowrap;background:var(--gold-soft);color:var(--ink)">${t}</span>`;
  const left = L.filter(r => r.state === 'submitted').length;
  const row = (r, j) => `<div style="display:flex;align-items:center;gap:8px;padding:10px 0;${j ? 'border-top:1px solid var(--line)' : ''}">
    <div style="flex:none;width:80px">${(r.urls || []).length ? ykThumbs(r.urls, 62, `data-ykv="${j}"`) : ''}</div>
    <div style="flex:1;min-width:0;line-height:1.5"><div style="display:flex;align-items:center;gap:4px"><b>${esc(r.name)}</b>${r.shot_no ? '' : badge('未提出')}</div>
      <div class="muted sm"><span style="white-space:nowrap">${esc(r.customer || '')}様 ${r.guests || 0}名</span>${r.shot_no ? `　<span style="white-space:nowrap">${r.shot_no >= 2 ? '再提出' : '提出'} ${esc(r.submitted_at || '')}</span>` : ''}</div></div>
    ${r.state === 'ok' || r.state === 'vague' ? `<span class="muted sm" style="flex:none;white-space:nowrap">${esc(r.by || '')} ${esc(r.at || '')} ${r.state === 'ok' ? '根拠あり' : '曖昧'}</span>`
      : r.state === 'submitted' ? `<div style="display:flex;gap:8px;flex:none">${ckBtn('yka', j, '根拠あり', true)}${ckBtn('ykb', j, '曖昧', true)}</div>` : ''}</div>`;
  const body = `<div class="card"><div class="muted sm" style="margin-bottom:6px">${td(D && D.day)}　${L.length}件・未確認 ${left}件</div>${L.map(row).join('') || (own ? '' : '<div class="muted">誘客の確認はありません</div>')}
    ${own ? `<div class="muted sm" style="padding-top:10px;${L.length ? 'border-top:1px solid var(--line)' : ''}">対象外 ${own}件（担当）</div>` : ''}</div>
    ${left ? sv().replace('id="clSv"', 'id="clSv" disabled style="opacity:.5"') : sv()}`;   /* 未確認が残る間は押せない（データベースでも止める）。未提出は保存で曖昧 */
  return { body, getData: () => ({}) }; }
function hcWireYukyaku(H, again){ const {x, D} = H; const L = (D && D.rows) || [], M = $('main');
  M.querySelectorAll('[data-ykv]').forEach(g => g.onclick = () => ykBig(L[+g.dataset.ykv].urls || []));
  [['yka', 'ok'], ['ykb', 'vague']].forEach(([a, st]) => M.querySelectorAll(`[data-${a}]`).forEach(b => b.onclick = async () => { const r = L[+b.dataset[a]]; b.disabled = true;
    const z = await sb.rpc('hall_close_yukyaku_mark', { p_token: TOKEN, p_task: x.id, p_id: r.id, p_state: st }); if(z.error) await uiAlert(z.error.message); again(); }));
}
