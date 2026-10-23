// ---------- 画面の一覧（オーナー以外に見せるかは店舗ごとに設定） ----------
const SCREENS=[
  {grp:'集計'},
  // v1.15：「まとめ」は外した（月間は収支の上へ。本日の箱と売上推移のグラフもなし。オーナー 2026-10-17）
  {k:'pl',n:'収支'},
  {k:'bills',n:'伝票一覧'},
  {k:'cast_sales',n:'スタッフ'},
  {k:'register',n:'現金管理'},
  {k:'punches',n:'打刻一覧'},
  {k:'shift',n:'シフト・予約'}, {k:'resv',n:'予約',nav:false}, // v1.48：開くとシフトと予約を切り替え（オーナー 2026-10-23）
  {k:'cust',n:'顧客サイト'},
  {grp:'設定'},
  {k:'set_cast',n:'スタッフ設定'},
  {k:'set_pay',n:'報酬・罰金項目'},
  {k:'set_pos',n:'POS設定'},
  {k:'set_todo',n:'TODO'}, {k:'set_open',n:'開店作業'}, {k:'set_close',n:'閉店作業',alias:'set_open'}, // v1.50・SQL 209：閉店作業（権限は開店作業と同じ。オーナー 2026-10-23）
  // v1.45・SQL 194：開店作業は TODO と別（オーナー 2026-10-22） // v1.30・v1.34：TODO は設定の中の1つだけ（カレンダーと項目。オーナー 2026-10-18）
  {k:'set_shift',n:'シフト設定',nav:false}, // v1.21：左には出さない。シフトの画面の「設定」から開く（オーナー 2026-10-17。表示設定の権限は今まで通り）
  {k:'notice',n:'お知らせ'},
  {grp:'履歴'},
  {k:'hist_memo',n:'メモ一覧'},
  {k:'hist_cash',n:'入出金履歴'},
  {k:'hist_print',n:'印刷履歴'},
  {k:'hist_del',n:'削除履歴'},
];
// v0.21：パスワードはオーナーだけ（「アカウント」の見出しをやめて、オーナーの下へ）
// v1.39：7つを4つのタブにまとめた（中の画面は nav:false で残す。27_owner_groups.js。オーナー 2026-10-21）
const OWNER_SCREENS=[{grp:'オーナー'},{k:'o_view',n:'表示設定'},{k:'o_idpw',n:'ID・パスワード'},{k:'o_link',n:'連携・メール'},{k:'o_contract',n:'契約書'},
  {k:'o_perms',n:'表示設定',nav:false},{k:'o_share',n:'OLIVE 顧客情報',nav:false},{k:'o_ids',n:'管理サイトのID',nav:false},{k:'pw',n:'パスワード',nav:false},{k:'o_square',n:'Square 連携',nav:false},{k:'o_line',n:'LINE メニュー',nav:false},{k:'o_daily',n:'日報メール',nav:false}];
const PERM_LABEL={none:'非表示',view:'閲覧',edit:'編集'};

let me=null, storeId=null, page=null;
const stores=()=>me?.stores||[];
const curStore=()=>stores().find(s=>s.id===storeId);
const stSet=()=>me?.settings?.[storeId]||{perms:{},nippo_days:3};
// v0.05：収支は月次・日次を1つの画面にまとめた（前の設定 pl_day／pl_month も読む）
function perm(k){ if(me?.is_owner) return 'edit'; if(k==='resv') k='shift'; if(k==='set_close') k='set_open'; /* v1.50 */ /* v1.48：予約はシフトと同じ権限 */ const p=stSet().perms||{}; if(k==='pl') return p.pl||p.pl_day||p.pl_month||'none'; if(k==='register') return p.register||p.register_month||'none'; /* v0.07：レジ精算も月次・日次を1つの画面に */ return p[k]||'none'; }

