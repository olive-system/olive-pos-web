// ［退店・体験］の［入店］（オーナー「入店は POS のスタッフの一覧から押し、押した時にスタッフ設定の内容を小窓で入れたい」）
// 体験の子（応募の記録が無い子も）と、面接で採用にした体験なしの子が対象。押した人（黒服）を選んで記録する（退店と同じ）
// 小窓はスタッフ設定の言葉と並びで、新人の黒服にもわかる項目だけ（オーナー「項目が多すぎる」）：報酬は時給／日給（折半は管理サイト）。
//   時給→保証時給、日給→保証日給。どちらも保証の期限（日付か無期限）。源泉徴収・消費税・厚生費・罰金の免除・日払・契約書は出さない（初めの値のまま。変える時は管理サイト）
// 条件は入店した月以降として、管理サイトのスタッフ設定と同じ保存の中身（cast_settings_apply）で入る。黒服の条件はオーナーだけなので、黒服は入店だけ
let joinInfo=null;
const joinGrid=X=>`<div style="display:grid;grid-template-columns:110px minmax(0,1fr);gap:6px 10px;align-items:center;font-size:15px">${X.map(([k,v])=>`<span class="muted" style="font-size:13px">${k}</span><span>${v}</span>`).join('')}</div>`;
const joinSel=(id,os,v)=>`<select id="${id}" style="width:auto">${os.map(([ov,on])=>`<option value="${esc(String(ov))}" ${String(v??'')===String(ov)?'selected':''}>${esc(on)}</option>`).join('')}</select>`;
const joinInp=(id,w,ph)=>`<input id="${id}" inputmode="numeric" placeholder="${ph||''}" style="width:${w}px">`;
async function joinOpen(s){
  if(!s) return;
  if(s.kind==='hall'){ if(!await uiConfirm(`${s.display_name}　入店`,'入店')) return; return joinSend(s,{},null); }
  if(!joinInfo){ const r=await sb.rpc('pos_join_info'); if(r.error){ await uiAlert(/pos_join_info/.test(r.error.message)?'SQL 488 が未実行です':r.error.message); return; } joinInfo=r.data||{}; }
  const sl=await sb.from('slide_tables').select('id,name,unit').eq('store_id',store.id).eq('is_active',true).order('sort_order'), tbls=sl.error?[]:(sl.data||[]);
  const m=joinBox(s,tbls);
  document.body.appendChild(m); joinBind(s,m,tbls);
}
/* 小窓の動き（報酬の切り替え・無期限・スライド表・入店） */
function joinBind(s,m,tbls){
  const jv=id=>m.querySelector('#'+id), slTxt=ids=>ids.length?esc(ids.map(id=>tbls.find(x=>x.id===id)?.name||'').join('・')):'<span class="badge warnb">未選択</span>';
  jv('jnPt').onchange=()=>{ jv('jnAmL').textContent=jv('jnPt').value==='daily'?'保証日給':'保証時給'; jv('jnSl').dataset.v='[]'; jv('jnSl').innerHTML=slTxt([]); }; /* スライド表は時給と日給で別の表 */
  jv('jnGf').onchange=()=>{ jv('jnGu').disabled=jv('jnGf').checked; if(jv('jnGf').checked) jv('jnGu').value=''; };
  jv('jnSl').onclick=()=>{ const u=jv('jnPt').value, cur=JSON.parse(jv('jnSl').dataset.v), opts=tbls.filter(x=>x.unit===u);
    const md=mkModal(60,`<h2 style="margin:0">スライド表</h2><div style="display:flex;flex-direction:column;gap:8px;margin-top:8px">${opts.map(o=>`<label style="display:flex;align-items:center;gap:8px;font-size:15px"><input type="checkbox" style="width:20px;height:20px" value="${o.id}" ${cur.includes(o.id)?'checked':''}>${esc(o.name)}</label>`).join('')||`<div class="muted">${u==='daily'?'日給':'時給'}のスライド表がありません</div>`}</div>
      <div class="bar" style="margin-top:12px"><button class="ghost" data-k="no">キャンセル</button><button class="primary" data-k="ok">決定</button></div>`);
    md.querySelector('[data-k=no]').onclick=()=>md.remove();
    md.querySelector('[data-k=ok]').onclick=()=>{ const ids=[...md.querySelectorAll('input:checked')].map(x=>x.value); jv('jnSl').dataset.v=JSON.stringify(ids); jv('jnSl').innerHTML=slTxt(ids); md.remove(); }; };
  m.querySelector('[data-k=no]').onclick=()=>m.remove();
  m.querySelector('[data-k=ok]').onclick=async()=>{ const set=await joinCollect(jv); if(set) joinSend(s,set,m); };
}
/* 小窓の中身（スタッフ設定の言葉と並び） */
function joinBox(s,tbls){
  const halls=staff.filter(x=>x.kind==='hall'), bd=businessDate();
  const R=[['担当黒服',joinSel('jnMg',[['','未選択'],...halls.map(h=>[h.id,h.display_name])],s.manager_staff_id||'')],
    ['報酬',joinSel('jnPt',[['hourly','時給'],['daily','日給']],'hourly')],
    [`<span id="jnAmL">保証時給</span>`,joinInp('jnAm',110)+' 円'],
    ['保証の期限',`<span style="display:flex;align-items:center;gap:10px"><input type="date" id="jnGu" style="width:auto"><label style="display:flex;align-items:center;gap:6px"><input type="checkbox" id="jnGf" style="width:20px;height:20px">無期限</label></span>`],
    ['スライド表','<button class="ghost sm" id="jnSl" data-v="[]"><span class="badge warnb">未選択</span></button>'],
    ['同伴ノルマ',joinInp('jnQ',60)+' 回'],['小計バック',joinInp('jnBk',60)+' %'],
    ['メモ',`<span style="display:flex;gap:8px">${joinSel('jnNc',(joinInfo.cats||[]).map(c=>[c,c]),'')}<input id="jnNb" maxlength="50" placeholder="1行・50字まで" style="flex:1;min-width:0"></span>`]];
  const R2=[['希望出勤日数',joinSel('jnW',[['','未設定'],...[1,2,3,4,5,6,7].map(n=>[n,`週 ${n}日`])],'')],['出勤可能時間',joinSel('jnE',[['','未設定'],...(joinInfo.times||[]).map(t=>[t,t+'〜'])],'')],
    ['提出',joinSel('jnO',[['false','休み希望'],['true','出勤希望']],'false')],['入店日',`<input type="date" id="jnJ" value="${bd}" style="width:auto">`],['自動作成',joinSel('jnR',[['1','優先'],['0','標準'],['-1','控え']],'0')]];
  const sub=s.ap_id?`面接 ${pastDay(s.day)}　面接結果 ${PAST_RES[s.result]||''}`:`体験 ${pastDay(s.day)}${s.result?`　体験結果 ${PAST_RES[s.result]||''}`:''}`;
  const m=mkModal(50); m.id='joinBox';
  m.innerHTML=`<div class="box" style="width:min(1040px,96vw);text-align:left"><h2 style="margin:0 0 4px">${esc(s.display_name)}　入店</h2><div class="muted" style="font-size:13px;margin-bottom:10px">${esc(sub)}</div>
    <div style="display:flex;gap:28px;align-items:flex-start"><div style="flex:1.2;min-width:0"><div style="font-weight:600;margin:6px 0 8px">キャスト</div>${joinGrid(R)}</div>
    <div style="flex:1;min-width:0;border-left:1px solid var(--line);padding-left:24px"><div style="font-weight:600;margin:6px 0 8px">シフト</div>${joinGrid(R2)}</div></div>
    <div class="bar" style="margin-top:16px"><button class="ghost" data-k="no">キャンセル</button><button class="primary" data-k="ok">入店</button></div></div>`;
  return m; }
/* 入力を集める（まちがいは知らせて null）。保存の形は管理サイトのスタッフ設定と同じ */
async function joinCollect(jv){
  const num=(id,l,max)=>{ const t=jv(id).value.replace(/[,，円\s]/g,''); if(t==='') return null; const n=Number(t); if(!Number.isFinite(n)||n<0||(max!=null&&n>max)) throw `${l}が正しくありません`; return Math.round(n); };
  try{ const pt=jv('jnPt').value, daily=pt==='daily', am=num('jnAm',daily?'保証日給':'保証時給'), gu=jv('jnGf').checked?'9999-12-31':(jv('jnGu').value||null);
    if(daily&&!am) throw '保証日給を入力してください';
    if(am&&!gu) throw '保証の期限を入力するか、「無期限」を選んでください';
    const ids=JSON.parse(jv('jnSl').dataset.v);
    return { manager_staff_id:jv('jnMg').value||null,
      terms:{pay_type:pt,daily_wage:daily?am:null,guaranteed_wage:daily?null:am,guarantee_until:am?gu:null,douhan_quota:num('jnQ','同伴ノルマ'),back_pct:num('jnBk','小計バック',100),back_mode:'add',
        withhold:null,ctax_pct:null,welfare_mode:'std',welfare_amount:null,exempt_fines:[],slide_ids:ids.length?ids.sort():null,seppan_pct:null},
      shift:{week:jv('jnW').value?Number(jv('jnW').value):null,earliest:jv('jnE').value||null,ok_only:jv('jnO').value==='true',rank:Number(jv('jnR').value),joined:jv('jnJ').value||null},
      note:{cat:jv('jnNc').value,body:jv('jnNb').value.trim()} };
  }catch(e){ if(typeof e==='string'){ await uiAlert(e); return null; } throw e; }
}
async function joinSend(s,set,m){
  const by=await askBy('入店処理した人'); if(by===null) return;
  const r=await sb.rpc('pos_staff_join',{p_staff:s.id||null,p_ap:s.ap_id||null,p_by:by||null,p_set:set});
  if(r.error){ await uiAlert(/pos_staff_join/.test(r.error.message)?'SQL 488 が未実行です':r.error.message); return; }
  if(m) m.remove(); toast(`${r.data?.name||s.display_name}：入店しました`); await loadStaffAll(); renderCasts();
}
