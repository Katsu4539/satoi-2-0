/* ==========================================================================
   SATOI 共通スクリプト satoi_common.js
   - ログイン状態管理
   - ユニバーサルナビ強化(マイページ・コンシェルジュ追加・ラベル常時表示)
   - 戻る動線分岐(ログイン中=B1 / 未ログイン=A1)
   - フローティングコンシェルジュバブル
   - モーダル排他制御
   ========================================================================== */
(function(){
  'use strict';

  /* ====== ログイン状態管理 ====== */
  var SATOI_PERSONA_KEYS = ['satoi_logged_in','satoi_persona','satoi_persona_id','satoi_cancer','satoi_last_cancer','satoi_last_cancer_name','satoi_stage','satoi_last_stage'];
  window.satoiAuth = {
    isLoggedIn: function(){ return sessionStorage.getItem('satoi_logged_in') === '1'; },
    login: function(){ sessionStorage.setItem('satoi_logged_in','1'); },
    logout: function(){ try { SATOI_PERSONA_KEYS.forEach(function(k){ sessionStorage.removeItem(k); }); localStorage.removeItem('satoi_intake'); } catch(e){} },
    persona: function(){ return sessionStorage.getItem('satoi_persona') || ''; }
  };

  /* ====== デモ用ペルソナ(ログインで読み込む)====== */
  window.SATOI_PERSONAS = {
    p1: { id:'p1', cancer:'breast', cancerName:'乳がん', stage:'II', phase:'treating', name:'Mさん',
          label:'Mさん ・ 乳がん(トリプルネガティブ)・治療中', sub:'40代後半・子育て中の女性' },
    p2: { id:'p2', cancer:'lung', cancerName:'肺がん', stage:'IV', phase:'treating', name:'Kさん',
          label:'Kさん ・ 肺がん ステージIV ・ 治療中', sub:'60代・定年間近の男性' }
  };
  /* 選んだペルソナの状況を保存(マイページ・AI・物語が、その人の世界になる) */
  window.satoiSetPersona = function(id){
    var p = window.SATOI_PERSONAS[id]; if (!p) return false;
    try {
      sessionStorage.setItem('satoi_logged_in','1');
      sessionStorage.setItem('satoi_persona', p.name);
      sessionStorage.setItem('satoi_persona_id', p.id);
      sessionStorage.setItem('satoi_cancer', p.cancer);
      sessionStorage.setItem('satoi_last_cancer', p.cancer);
      sessionStorage.setItem('satoi_last_cancer_name', p.cancerName);
      sessionStorage.setItem('satoi_stage', p.stage);
      sessionStorage.setItem('satoi_last_stage', p.stage);
      localStorage.setItem('satoi_intake', JSON.stringify({ cancer:p.cancer, stage:p.stage, phase:p.phase }));
    } catch(e){}
    return true;
  };

  /* ====== 行動ログ記録(今日の振り返り機能用) ======
     全画面で「閲覧した画面」「クリックした要素」を記録し、
     localStorage 'satoi_today_log' に蓄積。日付が変わったらリセット。
     SATOI_Mock_v1_C1_review.html で時系列タイムラインとして表示する。 */
  window.satoiLog = (function(){
    const KEY = 'satoi_today_log';
    const DATE_KEY = 'satoi_today_date';

    function todayStr(){
      const d = new Date();
      return d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0') + '-' + String(d.getDate()).padStart(2,'0');
    }

    function rotateIfNewDay(){
      try {
        const stored = localStorage.getItem(DATE_KEY);
        const today = todayStr();
        if (stored !== today) {
          // 前日のログを archive に移して、今日を空に
          const prev = localStorage.getItem(KEY);
          if (prev && stored) {
            localStorage.setItem('satoi_log_archive_' + stored, prev);
          }
          localStorage.setItem(KEY, JSON.stringify([]));
          localStorage.setItem(DATE_KEY, today);
        }
      } catch(e){}
    }

    function read(){
      try {
        rotateIfNewDay();
        const raw = localStorage.getItem(KEY);
        return raw ? JSON.parse(raw) : [];
      } catch(e) { return []; }
    }

    function append(entry){
      try {
        rotateIfNewDay();
        const log = read();
        entry.ts = Date.now();
        log.push(entry);
        // 上限 500 件で古いものから捨てる
        if (log.length > 500) log.splice(0, log.length - 500);
        localStorage.setItem(KEY, JSON.stringify(log));
      } catch(e){}
    }

    function clear(){
      try { localStorage.setItem(KEY, JSON.stringify([])); } catch(e){}
    }

    return { read: read, append: append, clear: clear, todayStr: todayStr };
  })();

  /* 画面ロード時:閲覧記録 */
  document.addEventListener('DOMContentLoaded', function(){
    try {
      const path = location.pathname.split('/').pop() || 'index';
      const title = (document.title || '').replace(/^SATOI[\s-・]+/, '');
      window.satoiLog.append({
        type: 'view',
        page: path,
        title: title,
        url: location.href
      });
    } catch(e){}
  });

  /* クリック記録(意味のある要素のみ) */
  document.addEventListener('click', function(e){
    try {
      const el = e.target.closest('a, button, .treatment-card, .route-card, .journey-flow-item, .satoi-jchip, .choice-btn');
      if (!el) return;
      const text = (el.textContent || '').trim().slice(0, 60);
      if (!text) return;
      window.satoiLog.append({
        type: 'click',
        page: location.pathname.split('/').pop() || 'index',
        target: el.tagName.toLowerCase() + (el.className ? '.' + String(el.className).split(' ')[0] : ''),
        text: text,
        href: el.getAttribute('href') || el.dataset.href || null
      });
    } catch(e){}
  }, true);

  /* ====== 戻り先 ====== */
  window.satoiHome = function(){
    return window.satoiAuth.isLoggedIn() ? 'SATOI_Mock_v1_B1_hub.html' : 'SATOI_Mock_v1_A1_entrance.html';
  };

  /* ====== モーダル排他制御 ======
     新しいモーダルを開く前に、document 内の .satoi-modal-open / .open クラスをすべて剥がす */
  window.satoiCloseAllModals = function(except){
    document.querySelectorAll('.satoi-modal-open, .open, [data-modal-open="true"]').forEach(el => {
      if (except && el === except) return;
      // exclude header/nav permanent UI elements
      if (el.id === 'satoi-univ-nav' || el.id === 'satoi-toast-host' || el.classList.contains('satoi-toast')) return;
      el.classList.remove('satoi-modal-open');
      el.classList.remove('open');
      el.removeAttribute('data-modal-open');
      if (el.classList.contains('satoi-popover-active')) {
        el.style.display = 'none';
        el.classList.remove('satoi-popover-active');
      }
    });
  };

  /* ====== 入口↔ホーム 切替トグルを各ページのロゴ横へ自動挿入(2026-05-21) ====== */
  // ロゴの文字色からヘッダーの明暗を判定し、トグルに配色テーマclassを付与
  function applyToggleTheme(tog, logo){
    if (!tog || tog.classList.contains('sht-dark-bg') || tog.classList.contains('sht-light-bg')) return;
    var themeClass = 'sht-dark-bg';
    try {
      var lc = getComputedStyle(logo).color.match(/\d+(\.\d+)?/g);
      if (lc && lc.length >= 3) {
        var lum = 0.299*parseFloat(lc[0]) + 0.587*parseFloat(lc[1]) + 0.114*parseFloat(lc[2]);
        themeClass = lum > 140 ? 'sht-dark-bg' : 'sht-light-bg';
      }
    } catch (e) {}
    tog.classList.add(themeClass);
  }
  function injectHomeToggle(){
    var existing = document.querySelector('.satoi-home-toggle');
    var logoEl = document.querySelector('.logo');
    if (existing) { // A1/B1等、マークアップに既にある場合はテーマだけ付与
      if (logoEl) applyToggleTheme(existing, logoEl);
      return;
    }
    var logo = logoEl;
    if (!logo || !logo.parentNode) return;
    var path = (location.pathname || '').toLowerCase();
    var isEntry = path.indexOf('a1_entrance') !== -1;
    var isHome  = path.indexOf('b1_hub') !== -1;
    var entryHTML = isEntry
      ? '<span class="sht-opt active">🌙 入口</span>'
      : '<a class="sht-opt" href="SATOI_Mock_v1_A1_entrance.html">🌙 入口</a>';
    var homeHTML = isHome
      ? '<span class="sht-opt active">☀ マインドマップ</span>'
      : '<a class="sht-opt" href="SATOI_Mock_v1_B1_hub.html">☀ マインドマップ</a>';
    var tog = document.createElement('div');
    tog.className = 'satoi-home-toggle';
    tog.setAttribute('role', 'group');
    tog.setAttribute('aria-label', '入口とホームの切替');
    tog.style.marginLeft = '14px';
    tog.innerHTML = entryHTML + homeHTML;
    applyToggleTheme(tog, logo); // ヘッダーの明暗に追従して配色テーマを付与
    var parent = logo.parentNode;
    if (parent.classList && parent.classList.contains('logo-wrap')) {
      // 既にロゴがlogo-wrap内 → その直後に置く
      parent.insertBefore(tog, logo.nextSibling);
    } else {
      // ロゴをラッパーで包み、トグルと一体化(space-betweenでも左に固定)
      var wrap = document.createElement('div');
      wrap.style.cssText = 'display:inline-flex; align-items:center;';
      parent.insertBefore(wrap, logo);
      wrap.appendChild(logo);
      wrap.appendChild(tog);
    }
  }

  /* ====== AIバー(カテゴリバー直下にレコメンド＋AI対話入口を出す・2026-05-21) ====== */
  function injectAiBar(){
    var toc = document.querySelector('.toc');
    if (!toc || document.querySelector('.satoi-ai-bar')) return;
    var page = (location.pathname.split('/').pop() || '').toLowerCase();
    var pageKey = page.replace('.html', '');
    var a2main = 'SATOI_Mock_v1_A2_dialog.html?from=' + encodeURIComponent(pageKey) + '&resume=1';
    var map = {
      living:    [['仕事と治療の両立は?', 'work'], ['家族のサポートのこと', 'family']],
      money:     [['高額療養費って?', 'money'], ['傷病手当金は使える?', 'money']],
      exam:      [['遺伝子検査って何?', 'genetic'], ['なぜ検査が必要?', 'genetic']],
      genome:    [['ドライバー遺伝子とは?', 'genetic'], ['私のがんの場合は?', 'genetic']],
      treatment: [['他の治療選択肢は?', 'treat'], ['副作用のことが心配', 'side']],
      diagnosis: [['これからどうなるの?', 'flow'], ['まず何をすべき?', 'flow']],
      consider:  [['治療法の選び方', 'treat'], ['セカンドオピニオンは?', 'treat']],
      follow:    [['再発が心配です', 'flow'], ['経過観察って何をするの?', 'flow']],
      palliative:[['緩和ケアって何?', 'feel'], ['つらさを和らげたい', 'feel']]
    };
    var key = '';
    Object.keys(map).forEach(function(k){ if (!key && page.indexOf(k) !== -1) key = k; });
    var recs = key ? map[key] : [['このページを、やさしく説明して', 'open'], ['私の場合はどうなる?', 'open']];
    var recsHTML = recs.map(function(r){
      return '<a class="satoi-ai-rec" href="SATOI_Mock_v1_A2_dialog.html?from=' + encodeURIComponent(pageKey) + '&topic=' + r[1] + '&resume=1">' + r[0] + '</a>';
    }).join('');
    var bar = document.createElement('div');
    bar.className = 'satoi-ai-bar';
    bar.innerHTML =
      '<a class="satoi-ai-bar-main" href="' + a2main + '">'
      + '<span class="satoi-ai-bar-icon">💬</span>'
      + '<span class="satoi-ai-bar-txt"><b>SATOI AI に相談する</b><span>このページのことを、AIと深掘りできます</span></span>'
      + '</a>'
      + '<div class="satoi-ai-bar-recs">' + recsHTML + '</div>';
    if (toc.parentNode) toc.parentNode.insertBefore(bar, toc.nextSibling);
  }

  /* ====== ユニバーサルナビ強化(既存ナビを置換) ====== */
  function injectEnhancedNav(){
    // 2026-05-21: 各ページのヘッダーに戻る等があり重複・干渉するため、浮遊ユニバーサルナビは無効化。
    // (言語切替はヘッダーへ統合予定。再有効化する場合はこの return を外す)
    const old = document.getElementById('satoi-univ-nav');
    if (old) old.remove();
    return;

    const nav = document.createElement('div');
    nav.id = 'satoi-univ-nav';
    nav.style.cssText = 'position:fixed; top:12px; right:16px; z-index:9000; display:flex; flex-direction:row; gap:8px; align-items:center;';

    const loggedIn = window.satoiAuth.isLoggedIn();
    const backLabel = '戻る';
    const homeLabel = loggedIn ? 'SATOI入口' : 'ホーム';
    const myLabel = 'マイページ';
    const hubLabel = 'ハブ';
    const conLabel = 'コンシェルジュ';
    const langLabel = '言語';

    const btnHTML = function(id, icon, label){
      return '<button class="satoi-univ-btn-enh" id="'+id+'" title="'+label+'" aria-label="'+label+'">'
        + '<span class="suv-icon">'+icon+'</span>'
        + '<span class="suv-label">'+label+'</span>'
        + '</button>';
    };

    let html = btnHTML('satoi-back-enh','←',backLabel)
      + btnHTML('satoi-lang-enh','🌐',langLabel);

    nav.innerHTML = html;
    document.body.appendChild(nav);

    /* ボタン挙動 */
    document.getElementById('satoi-back-enh').addEventListener('click', () => {
      if (document.referrer && document.referrer.includes('SATOI_Mock_v1_')) {
        history.back();
      } else {
        location.href = window.satoiHome();
      }
    });
    document.getElementById('satoi-lang-enh').addEventListener('click', (e) => {
      e.stopPropagation();
      const existing = document.getElementById('suv-lang-pop');
      if (existing) { existing.remove(); return; }
      const pop = document.createElement('div');
      pop.id = 'suv-lang-pop';
      pop.style.cssText = 'position:fixed; top:52px; right:16px; background:rgba(11,23,54,0.96); border:1px solid rgba(212,169,94,0.4); border-radius:12px; padding:10px; z-index:9100; min-width:140px; box-shadow:0 12px 32px rgba(0,0,0,0.5);';
      pop.innerHTML = '<button class="suv-lang-opt active" data-lang="ja">日本語</button>'
        + '<button class="suv-lang-opt" data-lang="en">English</button>'
        + '<button class="suv-lang-opt" data-lang="zh">中文</button>'
        + '<button class="suv-lang-opt" data-lang="ko">한국어</button>';
      document.body.appendChild(pop);
      pop.querySelectorAll('.suv-lang-opt').forEach(b => {
        b.addEventListener('click', function(){
          satoiNotify('言語を「'+this.textContent+'」に切り替えました(モック版・実装は本番化時)');
          pop.remove();
        });
      });
      setTimeout(() => {
        document.addEventListener('click', function close(ev){ if (!pop.contains(ev.target)) { pop.remove(); document.removeEventListener('click', close); } });
      }, 100);
    });

  }

  /* ====== さがす ・ 全画面共通フローティングメニュー ====== */
  const SATOI_FIND_GROUPS = [
    { title:'まず知る(基礎)', items:[
      { label:'📚 学びの部屋(まるごと知る)', url:'SATOI_Mock_v1_LEARN_room.html' },
      { label:'がんとは?(基礎知識)',     url:'SATOI_Mock_v1_KB_about.html' },
      { label:'がんの治療(基本)',         url:'SATOI_Mock_v1_KB_treatment.html' },
      { label:'暮らしと仕事(基礎)',       url:'SATOI_Mock_v1_KB_life.html' },
      { label:'世代別の情報(基礎)',       url:'SATOI_Mock_v1_KB_generation.html' }
    ]},
    { title:'今の状況・全体像', items:[
      { label:'ダッシュボード(同じ境遇の人数・全体像)', url:'SATOI_Mock_v1_DASHBOARD.html' },
      { label:'患者ジャーニーマップ',                   url:'SATOI_Mock_v1_B1_hub.html' }
    ]},
    { title:'段階で見る(診断〜緩和)', items:[
      { label:'診断・告知のとき',     url:'SATOI_Mock_v1_CHP_diagnosis.html' },
      { label:'検査のこと',           url:'SATOI_Mock_v1_CHP_exam.html' },
      { label:'治療を考える',         url:'SATOI_Mock_v1_CHP_consider.html' },
      { label:'治療のこと',           url:'SATOI_Mock_v1_CHP_treatment.html' },
      { label:'治療中の暮らし',       url:'SATOI_Mock_v1_CHP_living.html' },
      { label:'治療後・フォロー',     url:'SATOI_Mock_v1_CHP_follow.html' },
      { label:'お金のこと(段階別)', url:'SATOI_Mock_v1_CHP_money.html' },
      { label:'緩和ケア',             url:'SATOI_Mock_v1_CHP_palliative.html' }
    ]},
    { title:'治療を知る', items:[
      { label:'治療の全体像(マインドマップ)', url:'SATOI_Mock_v1_B1_mindmap.html' },
      { label:'治療法の詳しい説明',           url:'SATOI_Mock_v1_B3_treatment_detail.html' },
      { label:'治療法の当事者レビュー(★体験)', url:'SATOI_Mock_v1_TX_reviews.html' },
      { label:'がん情報ハブ',                 url:'SATOI_Mock_v1_B1_hub.html' },
      { label:'研究・治験の情報',             url:'SATOI_Mock_v1_ACAD_research.html' }
    ]},
    { title:'からだ・副作用', items:[
      { label:'副作用と対処(基礎)', url:'SATOI_Mock_v1_KB_sideeffects.html' },
      { label:'副作用の記録・対処',   url:'SATOI_Mock_v1_F4_side_effects.html' }
    ]},
    { title:'お金・制度', items:[
      { label:'お金と制度(基礎)', url:'SATOI_Mock_v1_KB_money.html' },
      { label:'お金・制度ハブ',     url:'SATOI_Mock_v1_E1_money.html' }
    ]},
    { title:'家族・まわりの人', items:[
      { label:'家族との共有・伝え方', url:'SATOI_Mock_v1_FAM_view.html' }
    ]},
    { title:'仲間・物語', items:[
      { label:'同じ境遇の方の物語',   url:'SATOI_Mock_v1_D1_stories.html' },
      { label:'物語を残す・投稿する', url:'SATOI_Mock_v1_D2_story_map.html' },
      { label:'音楽コミュニティ',     url:'SATOI_Mock_v1_MUS_community.html' }
    ]},
    { title:'相談する', items:[
      { label:'AIにゆっくり相談',            url:'SATOI_Mock_v1_A2_dialog.html' },
      { label:'コンシェルジュ(AI+電話)',   url:'SATOI_Mock_v1_CON_concierge.html' },
      { label:'先生に聞きたいことボックス(SDM)', url:'SATOI_Mock_v1_SDM_box.html' }
    ]},
    { title:'あなたの記録', items:[
      { label:'マイページ',       url:'SATOI_Mock_v1_C1_mypage.html' },
      { label:'私の療養手帳(対話で育つ)', url:'SATOI_Mock_v1_TECHO_handbook.html' },
      { label:'物語ムービー(人生会議・大切な人へ)', url:'SATOI_Mock_v1_MOVIE_lifestory.html' },
      { label:'今日の振り返り',   url:'SATOI_Mock_v1_C1_review.html' }
    ]},
    { title:'大切な設定・備え', items:[
      { label:'動的同意(同意・プライバシー設定)', url:'SATOI_Mock_v1_CONSENT.html' },
      { label:'緊急時の医療情報・QR',             url:'SATOI_Mock_v1_EMG_qr.html' }
    ]},
    { title:'SATOIについて', items:[
      { label:'Satoiにできること', url:'SATOI_Mock_v1_PHI_can_do.html' },
      { label:'SATOIについて',     url:'SATOI_Mock_v1_I_about.html' },
      { label:'SATOIの約束',       url:'SATOI_Mock_v1_PRO_promises.html' },
      { label:'姿勢:道標',        url:'SATOI_Mock_v1_POSTURE_michishirube.html' },
      { label:'姿勢:つながる',    url:'SATOI_Mock_v1_POSTURE_tsunagaru.html' },
      { label:'姿勢:寄り添う',    url:'SATOI_Mock_v1_POSTURE_yorisou.html' }
    ]},
    { title:'がん種別で見る', items:[
      { label:'乳がん',     url:'SATOI_Mock_v1_CAN_breast.html' },
      { label:'大腸がん',   url:'SATOI_Mock_v1_CAN_colon.html' },
      { label:'肺がん',     url:'SATOI_Mock_v1_CAN_lung.html' },
      { label:'胃がん',     url:'SATOI_Mock_v1_CAN_stomach.html' },
      { label:'前立腺がん', url:'SATOI_Mock_v1_CAN_prostate.html' },
      { label:'膵がん',     url:'SATOI_Mock_v1_CAN_pancreas.html' }
    ]},
    { title:'会員・法人向け', items:[
      { label:'保険会員のページ',   url:'SATOI_Mock_v1_G3_insurance_mypage.html' },
      { label:'法人・企業向け',     url:'SATOI_Mock_v1_G2_corporate_dashboard.html' }
    ]}
  ];

  function escFind(e){ if (e.key === 'Escape') closeFindMenu(); }
  function closeFindMenu(){
    const ov = document.getElementById('satoi-find-pop');
    if (ov){ ov.classList.remove('show'); setTimeout(()=>{ try{ ov.remove(); }catch(e){} }, 250); }
    document.removeEventListener('keydown', escFind);
  }
  function openFindMenu(){
    if (document.getElementById('satoi-find-pop')) { closeFindMenu(); return; }
    const ov = document.createElement('div');
    ov.id = 'satoi-find-pop';
    ov.className = 'satoi-find-overlay';
    let inner = '<div class="satoi-find-panel" role="dialog" aria-label="さがす">'
      + '<button class="satoi-find-close" aria-label="閉じる">×</button>'
      + '<div class="satoi-find-title">さがす ・ 知りたいことから選ぶ</div>'
      + '<div class="satoi-find-groups">';
    SATOI_FIND_GROUPS.forEach(function(g){
      inner += '<div class="satoi-find-group"><div class="satoi-find-gtitle">' + g.title + '</div>';
      g.items.forEach(function(it){
        inner += '<a class="satoi-find-link" href="' + it.url + '">' + it.label + '<span>→</span></a>';
      });
      inner += '</div>';
    });
    inner += '</div></div>';
    ov.innerHTML = inner;
    document.body.appendChild(ov);
    setTimeout(()=>ov.classList.add('show'), 10);
    ov.addEventListener('click', function(ev){
      if (ev.target === ov || ev.target.classList.contains('satoi-find-close')) closeFindMenu();
    });
    document.addEventListener('keydown', escFind);
  }

  /* ====== スタイル注入 ====== */
  function injectStyles(){
    if (document.getElementById('satoi-common-styles')) return;
    const s = document.createElement('style');
    s.id = 'satoi-common-styles';
    s.textContent = `
      /* ===== 浮遊UIを全ページ・PC含め非表示(Katsuさん指示・2026-05-22)=====
         右側オーブ(companion-lamp)/コンシェルジュ吹き出し/サジェスション(nudge)はすべて廃止 */
      .companion-lamp { display: none !important; }
      .satoi-con-bubble { display: none !important; }
      .nudge { display: none !important; }
      /* ===== ヘッダーのリンクが縦に文字割れするのを防ぐ(←ログアウト等) ===== */
      .header .h-link, .header .back-btn, .header .header-link, .header .header-crumb { white-space: nowrap; }
      /* ===== 読みやすさ:ベースフォントを少し大きく(PCで小さい・Katsuさん指示・2026-05-21)===== */
      body { font-size: 17px; line-height: 1.85; }
      /* ===== 情報ページ(検査/暮らし/基礎知識等)の本文を高齢者にも読みやすく大きく(AZ/ファイザー水準・2026-05-21)===== */
      .toc-item { font-size: 14px !important; }
      .section-sub { font-size: 17px !important; line-height: 1.95 !important; }
      .hero-sub { font-size: 17px !important; line-height: 2 !important; }
      .content-card { padding: 26px 30px !important; }
      .content-card h3 { font-size: 19px !important; }
      .content-card h4 { font-size: 17px !important; }
      .content-card p { font-size: 16.5px !important; line-height: 2 !important; }
      .content-card ul, .content-card ol { font-size: 16px !important; line-height: 2 !important; }
      .content-card li { font-size: 16px !important; }
      .content-card blockquote { font-size: 15px !important; }
      .ai-cta-title { font-size: 17.5px !important; }
      .ai-cta p { font-size: 15.5px !important; line-height: 2 !important; }
      .mini-card-title { font-size: 16.5px !important; }
      .mini-card-desc { font-size: 14px !important; line-height: 1.9 !important; }
      .related-card-title { font-size: 15px !important; }
      .related-card-desc { font-size: 13px !important; }
      /* スマホ:大きくしすぎ・余白過多で窮屈にならないよう調整(iPhone/iPad) */
      @media (max-width: 768px) {
        body { font-size: 16px; }
        /* スマホ:浮遊要素は一切出さない(Katsuさん指示・2026-05-21) */
        .satoi-con-bubble { display: none !important; }
        .companion-lamp { display: none !important; }
        .nudge { display: none !important; }
        #satoi-univ-nav { display: none !important; }
        .satoi-home-toggle { margin-left: 8px !important; }
        .satoi-home-toggle .sht-opt { padding: 4px 9px !important; font-size: 11px !important; }
        /* スマホ:コンテンツ系ページのヘッダーを折返さず1行で整える(h-link/crumbは全7ページ共通) */
        .header-crumb { display: none !important; }
        .h-link { font-size: 12px !important; padding: 6px 12px !important; white-space: nowrap !important; }
        /* 「マインドマップに戻る」は ☀ホーム と行き先が同じ(B1)なのでスマホでは省く */
        .h-link[href*="B1_hub"] { display: none !important; }
        .content-card { padding: 18px 16px !important; }
        .content-card h3 { font-size: 17.5px !important; }
        .content-card h4 { font-size: 16px !important; }
        .content-card p { font-size: 15.5px !important; line-height: 1.95 !important; }
        .content-card ul, .content-card ol, .content-card li { font-size: 15px !important; }
        .section-sub { font-size: 15.5px !important; }
        .hero-sub { font-size: 15.5px !important; }
        .ai-cta p { font-size: 14.5px !important; }
      }
      /* ===== 上部の朝靄を弱め、ステップバー(AI入口)とテロップを見えるように(Katsuさん指示・2026-05-21)===== */
      .header { backdrop-filter: blur(3px) !important; -webkit-backdrop-filter: blur(3px) !important; }
      .satoi-jbar { background: rgba(255,253,247,0.985) !important; backdrop-filter: blur(2px) !important; }
      .satoi-jchip:not(.done):not(.current) { color: rgba(26,42,64,0.9) !important; background: #ffffff !important; border-color: rgba(11,23,54,0.30) !important; }
      .satoi-jchip:not(.done):not(.current) .satoi-jchip-n { background: rgba(11,23,54,0.16) !important; color: rgba(26,42,64,0.9) !important; }
      /* ===== 入口↔ホーム 切替トグル(共通)===== */
      /* トグルはヘッダーの明暗に追従して文字色を切替(JSがロゴ色を読んで sht-dark-bg/sht-light-bg を付与・2026-05-21) */
      .satoi-home-toggle { display:inline-flex; align-items:center; gap:2px; padding:3px; border-radius:22px; vertical-align:middle; background:rgba(255,255,255,0.12); border:1px solid rgba(255,255,255,0.30); }
      .satoi-home-toggle .sht-opt { display:inline-flex; align-items:center; gap:5px; padding:6px 14px; border-radius:18px; font-size:12.5px; font-weight:600; cursor:pointer; text-decoration:none; white-space:nowrap; transition:all .2s; font-family:inherit; opacity:1; }
      /* 暗いヘッダー上:明るい文字 */
      .satoi-home-toggle.sht-dark-bg { background:rgba(255,255,255,0.12); border-color:rgba(255,255,255,0.34); }
      .satoi-home-toggle.sht-dark-bg .sht-opt { color:rgba(248,246,240,0.85) !important; }
      .satoi-home-toggle.sht-dark-bg .sht-opt:hover { color:#fff !important; background:rgba(255,255,255,0.10); }
      /* 明るいヘッダー上:濃い文字 */
      .satoi-home-toggle.sht-light-bg { background:rgba(11,23,54,0.05); border-color:rgba(11,23,54,0.22); }
      .satoi-home-toggle.sht-light-bg .sht-opt { color:rgba(26,42,64,0.78) !important; }
      .satoi-home-toggle.sht-light-bg .sht-opt:hover { color:#0B1736 !important; background:rgba(11,23,54,0.08); }
      /* 選択中はどちらのテーマでも金色pill+濃文字 */
      .satoi-home-toggle .sht-opt.active { background:#D4A95E; color:#0B1736 !important; box-shadow:0 2px 8px rgba(212,169,94,0.4); }
      @media (max-width: 700px) { .satoi-home-toggle .sht-opt { padding:5px 10px; font-size:11.5px; } }
      /* ===== AIバー(カテゴリバー直下・レコメンド＋AI対話への入口)===== */
      .satoi-ai-bar { max-width:1000px; margin:18px auto 4px; padding:13px 18px; display:flex; flex-wrap:wrap; align-items:center; gap:10px 16px; background:linear-gradient(135deg, rgba(13,115,119,0.12), rgba(20,166,171,0.06)); border:1px solid rgba(13,115,119,0.38); border-radius:16px; box-shadow:0 6px 20px rgba(11,23,54,0.08); }
      .satoi-ai-bar-main { display:flex; align-items:center; gap:12px; text-decoration:none; color:inherit; flex:1; min-width:230px; }
      .satoi-ai-bar-icon { width:38px; height:38px; border-radius:50%; background:#0D7377; color:#fff; display:inline-flex; align-items:center; justify-content:center; font-size:18px; flex-shrink:0; transition:background .2s; box-shadow:0 0 0 0 rgba(13,115,119,0.4); animation:satoi-aibar-pulse 2.8s infinite; }
      @keyframes satoi-aibar-pulse { 0%,100%{ box-shadow:0 0 0 0 rgba(13,115,119,0.35);} 50%{ box-shadow:0 0 0 7px rgba(13,115,119,0);} }
      .satoi-ai-bar-main:hover .satoi-ai-bar-icon { background:#14A6AB; }
      .satoi-ai-bar-txt b { font-size:14.5px; color:#0D7377; font-weight:700; display:block; line-height:1.4; }
      .satoi-ai-bar-txt span { font-size:11.5px; color:rgba(26,42,64,0.7); }
      .satoi-ai-bar-recs { display:flex; flex-wrap:wrap; gap:8px; }
      .satoi-ai-rec { padding:8px 14px; border-radius:18px; background:#fff; border:1px solid rgba(13,115,119,0.4); color:#0D7377; font-size:12px; font-weight:500; text-decoration:none; white-space:nowrap; transition:all .2s; }
      .satoi-ai-rec:hover { background:#0D7377; color:#fff; }
      @media (max-width:700px){ .satoi-ai-bar{ margin:14px 12px 4px; padding:12px 14px; } .satoi-ai-bar-recs{ width:100%; } }
      /* ===== AI応答 マークダウン整形表示 ===== */
      .satoi-md-p { margin: 0 0 0.7em; line-height: 1.85; }
      .satoi-md-p:last-child { margin-bottom: 0; }
      .satoi-md-h { font-weight: 500; line-height: 1.6; margin: 1em 0 0.35em; color: #F0C97A; letter-spacing: 0.02em; }
      .satoi-md-h:first-child { margin-top: 0; }
      .satoi-md-h1 { font-size: 1.08em; }
      .satoi-md-h2 { font-size: 1.04em; }
      .satoi-md-h3, .satoi-md-h4 { font-size: 1em; }
      .satoi-md-ul, .satoi-md-ol { margin: 0.4em 0 0.7em; padding-left: 1.4em; line-height: 1.8; }
      .satoi-md-ul li, .satoi-md-ol li { margin: 0.2em 0; }
      .satoi-md-ul { list-style: disc; }
      .satoi-md-ol { list-style: decimal; }
      .satoi-md-table { border-collapse: collapse; width: 100%; margin: 0.6em 0; font-size: 0.95em; }
      .satoi-md-table th, .satoi-md-table td { border: 1px solid rgba(127,127,127,0.35); padding: 7px 10px; text-align: left; vertical-align: top; }
      .satoi-md-table th { background: rgba(127,127,127,0.12); font-weight: 700; }
      .satoi-md-hr { border: none; border-top: 1px solid rgba(127,127,127,0.3); margin: 0.9em 0; }
      /* ===== さがす フローティングメニュー ===== */
      .satoi-find-overlay { position: fixed; inset: 0; z-index: 9200; background: rgba(11,23,54,0.55); backdrop-filter: blur(6px); display: flex; align-items: flex-start; justify-content: center; padding: 30px 20px; opacity: 0; pointer-events: none; transition: opacity 0.25s; overflow-y: auto; }
      .satoi-find-overlay.show { opacity: 1; pointer-events: auto; }
      .satoi-find-panel { position: relative; width: min(1040px, 100%); background: rgba(17,28,58,0.98); border: 1px solid rgba(212,169,94,0.4); border-radius: 18px; padding: 22px 26px 24px; box-shadow: 0 30px 80px rgba(0,0,0,0.5); transform: translateY(-12px); transition: transform 0.28s cubic-bezier(0.16,1,0.3,1); }
      .satoi-find-overlay.show .satoi-find-panel { transform: translateY(0); }
      .satoi-find-close { position: absolute; top: 12px; right: 14px; width: 32px; height: 32px; border-radius: 50%; background: rgba(248,246,240,0.12); border: 1px solid rgba(248,246,240,0.25); color: #F8F6F0; font-size: 18px; line-height: 1; cursor: pointer; }
      .satoi-find-close:hover { background: #D4A95E; color: #0B1736; border-color: #D4A95E; }
      .satoi-find-title { font-size: 16px; letter-spacing: 0.06em; color: #F0C97A; margin-bottom: 14px; font-weight: 500; }
      .satoi-find-groups { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 12px 24px; }
      .satoi-find-gtitle { font-size: 13px; letter-spacing: 0.1em; color: #7FA8C9; border-bottom: 1px solid rgba(127,168,201,0.3); padding-bottom: 5px; margin-bottom: 5px; font-weight: 500; }
      .satoi-find-link { display: flex; align-items: center; justify-content: space-between; gap: 8px; padding: 6px 10px; border-radius: 9px; color: #F8F6F0; text-decoration: none; font-size: 15px; font-weight: 400; transition: all 0.18s; }
      .satoi-find-link span { color: #D4A95E; font-weight: 500; font-size: 16px; }
      .satoi-find-link:hover { background: rgba(212,169,94,0.16); color: #F0C97A; }
      @media (max-width: 768px) { .satoi-find-overlay { padding: 16px 12px; } .satoi-find-panel { padding: 18px 16px 20px; } .satoi-find-groups { grid-template-columns: 1fr 1fr; gap: 12px 14px; } }
      /* ===== ピックアップ・グリッド ===== */
      .satoi-pickup-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(248px, 1fr)); gap: 14px; }
      .satoi-pickup-card { display: flex; align-items: center; gap: 13px; padding: 16px 18px; background: #FFFFFF; border: 1px solid rgba(10,22,40,0.10); border-radius: 14px; text-decoration: none; color: #1A2A40; transition: all 0.2s; box-shadow: 0 4px 14px rgba(11,23,54,0.04); }
      .satoi-pickup-card:hover { border-color: #7FA8C9; transform: translateY(-2px); box-shadow: 0 8px 20px rgba(11,23,54,0.09); }
      .satoi-pickup-ic { font-size: 24px; flex-shrink: 0; line-height: 1; }
      .satoi-pickup-body { flex: 1; display: flex; flex-direction: column; gap: 3px; min-width: 0; }
      .satoi-pickup-title { font-size: 14.5px; font-weight: 600; color: #1A2A40; }
      .satoi-pickup-desc { font-size: 11.5px; color: rgba(26,42,64,0.6); line-height: 1.6; }
      .satoi-pickup-arrow { color: #D4A95E; font-weight: 700; flex-shrink: 0; }
      /* 言語切替は右の🌐に一本化:各ページ上部の言語セレクトは隠す */
      .lang-select { display: none !important; }
      .satoi-md-p code, .satoi-md-table code, .satoi-md-ul code, .satoi-md-ol code { background: rgba(127,127,127,0.18); border-radius: 5px; padding: 1px 5px; font-size: 0.92em; }
      .satoi-md-p strong, .satoi-md-table strong, .satoi-md-ul strong, .satoi-md-ol strong { font-weight: 400; color: #F0C97A; }
      .satoi-md-h strong { font-weight: 600; color: inherit; }
      .satoi-univ-btn-enh {
        display: inline-flex; align-items: center; gap: 6px;
        padding: 8px 14px;
        background: rgba(11,23,54,0.82);
        border: 1px solid rgba(212,169,94,0.45);
        border-radius: 20px;
        color: #F0C97A;
        cursor: pointer;
        font-family: inherit;
        backdrop-filter: blur(10px);
        -webkit-backdrop-filter: blur(10px);
        transition: all 0.2s ease;
        box-shadow: 0 4px 14px rgba(0,0,0,0.20);
      }
      .satoi-univ-btn-enh:hover {
        background: rgba(212,169,94,0.95);
        color: #0B1736;
      }
      .satoi-univ-btn-enh .suv-icon {
        font-size: 15px; line-height: 1;
      }
      .satoi-univ-btn-enh .suv-label {
        font-size: 12px; letter-spacing: 0.02em; font-weight: 500; white-space: nowrap;
      }
      #satoi-univ-nav { pointer-events: auto; }
      .suv-lang-opt {
        display: block; width: 100%; text-align: left;
        background: transparent; border: none;
        padding: 10px 14px; border-radius: 8px;
        color: #F8F6F0; cursor: pointer;
        font-family: inherit; font-size: 13px;
        transition: background 0.2s;
      }
      .suv-lang-opt:hover, .suv-lang-opt.active { background: rgba(212,169,94,0.18); }

      /* フローティング・コンシェルジュバブル */
      .satoi-con-bubble {
        position: fixed; right: 100px; bottom: 24px;
        max-width: 280px;
        background: linear-gradient(135deg, rgba(11,23,54,0.96), rgba(26,37,72,0.96));
        border: 1px solid rgba(212,169,94,0.5);
        border-radius: 18px;
        padding: 14px 18px;
        color: #F8F6F0;
        font-size: 12.5px; line-height: 1.7;
        z-index: 8500;
        box-shadow: 0 10px 30px rgba(0,0,0,0.4);
        backdrop-filter: blur(10px);
        cursor: pointer;
        transition: all 0.3s;
        animation: satoi-con-bubble-in 0.6s ease;
      }
      .satoi-con-bubble:hover {
        transform: translateY(-3px);
        border-color: #D4A95E;
        box-shadow: 0 14px 36px rgba(212,169,94,0.3);
      }
      .satoi-con-bubble .scb-eyebrow {
        font-size: 10px; letter-spacing: 0.22em; color: #F0C97A; margin-bottom: 4px;
      }
      .satoi-con-bubble .scb-cta {
        font-size: 11px; color: #6FE0E5; margin-top: 6px; letter-spacing: 0.08em;
      }
      .satoi-con-bubble .scb-close {
        position: absolute; top: 4px; right: 8px;
        background: transparent; border: none; color: rgba(248,246,240,0.5);
        cursor: pointer; font-size: 14px; padding: 4px;
      }
      @keyframes satoi-con-bubble-in {
        0% { opacity: 0; transform: translateY(20px); }
        100% { opacity: 1; transform: translateY(0); }
      }

      /* 旧ユニバーサルナビ非表示 */
      #satoi-univ-nav button.satoi-univ-btn:not(.satoi-univ-btn-enh) { display: none !important; }

      @media (max-width: 700px) {
        #satoi-univ-nav { top: 8px !important; right: 10px !important; }
        .satoi-univ-btn-enh { padding: 7px 11px; }
        .satoi-univ-btn-enh .suv-icon { font-size: 14px; }
        .satoi-univ-btn-enh .suv-label { font-size: 11px; }
        .satoi-con-bubble { right: 12px; bottom: 16px; max-width: 220px; font-size: 11.5px; }
      }
    `;
    document.head.appendChild(s);
  }

  /* ====== コンシェルジュ・フローティングバブル ====== */
  function injectConciergeBubble(){
    // 2026-05-22: Katsuさん指示により、左右の浮遊コンシェルジュ吹き出しは全廃(PC含む)。注入しない。
    return;
    // A1 は独自バブル(同じ夜)があるのでスキップ。CON ページもスキップ。
    const path = location.pathname.toLowerCase();
    if (path.includes('a1_entrance') || path.includes('con_concierge')) return;
    if (document.getElementById('satoi-con-bubble')) return;

    // dismiss state 確認(session 限定)
    if (sessionStorage.getItem('satoi_con_bubble_dismissed') === '1') return;

    const bubble = document.createElement('div');
    bubble.id = 'satoi-con-bubble';
    bubble.className = 'satoi-con-bubble';
    bubble.innerHTML = '<button class="scb-close" aria-label="閉じる">×</button>'
      + '<div class="scb-eyebrow">SATOI CONCIERGE</div>'
      + '<div class="scb-body">お困りごと、お一人で抱え込まないでください。<br>いつでも、SATOI コンシェルジュへ。</div>'
      + '<div class="scb-cta">▸ 相談する</div>';
    document.body.appendChild(bubble);
    bubble.addEventListener('click', (e) => {
      if (e.target.classList.contains('scb-close')) {
        sessionStorage.setItem('satoi_con_bubble_dismissed','1');
        bubble.remove();
        return;
      }
      location.href = 'SATOI_Mock_v1_CON_concierge.html';
    });
  }

  /* ====== A1 着地時のログイン上部バー(削除済・無効化) ======
     2026-05-20: Katsujiさん指示により緑のログイン中バーは全削除。
     関数は残すが何もしない。 */
  function maybeRedirectFromA1(){
    return;
  }

  /* ====== ログインボタンクリックで satoi_logged_in を立てる(A1 等のログインボタン) ====== */
  function bindLoginButtons(){
    // 「ご本人」「マイページ」「ログイン」をクリックしたら satoi_logged_in=1
    document.addEventListener('click', function(e){
      const el = e.target.closest('a, button');
      if (!el) return;
      const txt = (el.textContent || '').trim();
      const href = (el.getAttribute && el.getAttribute('href')) || '';
      if (
        href.includes('C1_mypage.html') ||
        href.includes('B1_hub.html') ||
        href.includes('G3_insurance_mypage.html') ||
        txt === 'ご本人' || txt === 'ログイン' ||
        el.id === 'loginBtnA1'
      ) {
        // ログインボタン直接クリックはセットしない(ドロップダウン展開のみ)
        if (el.id === 'loginBtnA1') return;
        window.satoiAuth.login();
      }
    }, true);
  }

  /* ====== AI応答用 簡易マークダウン → HTML 変換 ======
     太字・見出し・箇条書き・番号リスト・簡単な表・改行に対応。
     まずHTMLエスケープしてから整形するので安全。 */
  window.satoiMarkdown = function(src){
    if (src == null) return '';
    src = String(src).replace(/\r\n/g, '\n');
    // 生のコードフェンス(```)や、中身のない見出し記号(#だけ)の行は、
    // 解析前にまるごと取り除く(段落アキュムレータに飲み込まれて画面に漏れるのを防ぐ)。
    src = src.split('\n').filter(function(l){
      var t = l.trim();
      if (/^`{3,}/.test(t)) return false;   // ``` で始まる行
      if (/^#{1,6}\s*$/.test(t)) return false; // # だけ・## だけ等(中身なし)
      return true;
    }).join('\n');

    function esc(s){ return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }

    function inline(s){
      s = esc(s);
      s = s.replace(/`([^`]+)`/g, '<code>$1</code>');
      s = s.replace(/\*\*([^*\n]+)\*\*/g, '<strong>$1</strong>');
      s = s.replace(/__([^_\n]+)__/g, '<strong>$1</strong>');
      s = s.replace(/(^|[^*])\*([^*\n]+)\*(?!\*)/g, '$1<em>$2</em>');
      s = s.replace(/\[([^\]]+)\]\((https?:[^)\s]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>');
      // 途中で切れた等で残った 対になっていない **/__/* を除去(生のマークダウン記号を出さない)
      s = s.replace(/\*\*/g, '').replace(/__/g, '').replace(/(^|[^*])\*(?!\*)/g, '$1');
      return s;
    }

    function splitRow(row){
      var r = row.trim();
      if (r.charAt(0) === '|') r = r.slice(1);
      if (r.charAt(r.length-1) === '|') r = r.slice(0,-1);
      return r.split('|').map(function(c){ return c.trim(); });
    }

    var lines = src.split('\n');
    var html = '';
    var i = 0;
    var listType = null;
    function closeList(){ if (listType){ html += '</' + listType + '>'; listType = null; } }

    while (i < lines.length){
      var line = lines[i];
      var trimmed = line.trim();

      if (trimmed === ''){ closeList(); i++; continue; }

      // コードフェンス(```)や、中身のない見出し記号(##だけ)の行は表示しない(生のまま出さない)
      if (/^`{3,}/.test(trimmed)) { i++; continue; }
      if (/^#{1,6}$/.test(trimmed)) { i++; continue; }

      // 区切り線(--- *** ___ だけの行)
      if (/^([-*_])\1{2,}$/.test(trimmed)){ closeList(); html += '<hr class="satoi-md-hr">'; i++; continue; }

      // 表(パイプ表)
      if (/\|/.test(line) && i+1 < lines.length && /\|/.test(lines[i+1]) && /^\s*\|?\s*:?-{2,}/.test(lines[i+1])){
        closeList();
        var header = splitRow(line);
        i += 2;
        var rows = [];
        while (i < lines.length && /\|/.test(lines[i]) && lines[i].trim() !== ''){ rows.push(splitRow(lines[i])); i++; }
        html += '<table class="satoi-md-table"><thead><tr>' + header.map(function(c){ return '<th>' + inline(c) + '</th>'; }).join('') + '</tr></thead><tbody>';
        rows.forEach(function(r){ html += '<tr>' + r.map(function(c){ return '<td>' + inline(c) + '</td>'; }).join('') + '</tr>'; });
        html += '</tbody></table>';
        continue;
      }

      // 見出し
      var h = trimmed.match(/^(#{1,4})\s+(.*)$/);
      if (h){ closeList(); html += '<div class="satoi-md-h satoi-md-h' + h[1].length + '">' + inline(h[2]) + '</div>'; i++; continue; }

      // 箇条書き
      var ul = trimmed.match(/^[-*・]\s+(.*)$/);
      if (ul){ if (listType !== 'ul'){ closeList(); html += '<ul class="satoi-md-ul">'; listType = 'ul'; } html += '<li>' + inline(ul[1]) + '</li>'; i++; continue; }

      // 番号付きリスト
      var ol = trimmed.match(/^\d+[.)]\s+(.*)$/);
      if (ol){ if (listType !== 'ol'){ closeList(); html += '<ol class="satoi-md-ol">'; listType = 'ol'; } html += '<li>' + inline(ol[1]) + '</li>'; i++; continue; }

      // 通常段落
      closeList();
      var para = [line];
      i++;
      while (i < lines.length){
        var t = lines[i].trim();
        if (t === '' || /^(#{1,4})\s/.test(t) || /^[-*・]\s/.test(t) || /^\d+[.)]\s/.test(t) || /\|/.test(lines[i])) break;
        para.push(lines[i]); i++;
      }
      html += '<p class="satoi-md-p">' + para.map(inline).join('<br>') + '</p>';
    }
    closeList();
    return html;
  };

  /* ====== 「AIと話す/深掘り」ボタンに、その項目の文脈を持たせる ======
     各 .ai-cta-btn が、自分が属する section の見出し・カテゴリ・本文を読み取り、
     A2対話に seed として渡す。A2側はこれを使って汎用挨拶ではなく文脈からリードする。 */
  function enhanceAiCtaButtons(){
    document.querySelectorAll('a.ai-cta-btn').forEach(function(a){
      var href = a.getAttribute('href') || '';
      if (href.indexOf('A2_dialog') === -1) return;
      if (href.indexOf('seed=') !== -1) return; // 既に付与済み
      var sec = a.closest('section') || a.closest('.section') || a.parentElement;
      if (!sec) return;
      var titleEl   = sec.querySelector('.section-title, h2, h3');
      var eyebrowEl = sec.querySelector('.section-eyebrow');
      var bodyEl    = sec.querySelector('.content-card');
      var title = titleEl ? titleEl.textContent.trim() : '';
      if (!title) return;
      var eyebrow = eyebrowEl ? eyebrowEl.textContent.trim() : '';
      var body = bodyEl ? bodyEl.textContent.trim().replace(/\s+/g, ' ').slice(0, 180) : '';
      var seed = (eyebrow ? '【' + eyebrow + '】' : '') + title + (body ? ' / ' + body : '');
      var sep = href.indexOf('?') === -1 ? '?' : '&';
      a.setAttribute('href', href + sep + 'lead=1&seed=' + encodeURIComponent(seed));
    });
  }

  /* ====== ピックアップ・グリッド(自分で選んで回れる入口)======
     #satoi-pickup というプレースホルダがあるページに、カード一覧を流し込む。
     ハブ・マイページに設置。 */
  const SATOI_PICKUP = [
    { icon:'📚', title:'学びの部屋',           desc:'がんを、まるごと知る（読む・観る・調べる・伝える）', url:'SATOI_Mock_v1_LEARN_room.html' },
    { icon:'🗺', title:'治療の全体像',         desc:'あなたの治療マインドマップ', url:'SATOI_Mock_v1_B1_mindmap.html' },
    { icon:'📝', title:'先生に聞きたいこと',   desc:'聞きたいことボックス(SDM)',  url:'SATOI_Mock_v1_SDM_box.html' },
    { icon:'📖', title:'同じ境遇の物語',       desc:'体験談・先輩の声',           url:'SATOI_Mock_v1_D1_stories.html' },
    { icon:'💛', title:'家族との共有',         desc:'伝え方・家族とつながる',     url:'SATOI_Mock_v1_FAM_view.html' },
    { icon:'💬', title:'相談する',             desc:'コンシェルジュ(AI+電話)',  url:'SATOI_Mock_v1_CON_concierge.html' },
    { icon:'🆘', title:'緊急時の備え',         desc:'医療情報・QRコード',         url:'SATOI_Mock_v1_EMG_qr.html' }
  ];
  function renderPickup(){
    document.querySelectorAll('#satoi-pickup').forEach(function(host){
      if (host.dataset.satoiFilled) return;
      host.dataset.satoiFilled = '1';
      var html = '<div class="satoi-pickup-grid">';
      SATOI_PICKUP.forEach(function(it){
        html += '<a class="satoi-pickup-card" href="' + it.url + '">'
          + '<span class="satoi-pickup-ic">' + it.icon + '</span>'
          + '<span class="satoi-pickup-body"><span class="satoi-pickup-title">' + it.title + '</span>'
          + '<span class="satoi-pickup-desc">' + it.desc + '</span></span>'
          + '<span class="satoi-pickup-arrow">→</span></a>';
      });
      html += '</div>';
      host.innerHTML = html;
    });
  }

  /* ====== 多言語(i18n) ・ EN/ZH/KO ======
     方針:テキストノードの「完全一致」だけを置換する(部分一致しない=誤訳・崩れを防ぐ)。
     原文(日本語)はノードに退避して保持し、日本語に戻すと完全復元する。
     辞書に無い文はそのまま日本語で残る(壊れない)。辞書を足せばカバー範囲が自動で広がる。 */
  var SATOI_I18N = {
    // ---- ナビ・共通 ----
    '戻る':['Back','返回','뒤로'],
    '言語':['Language','语言','언어'],
    'さがす':['Search','搜索','검색'],
    'ログイン':['Log in','登录','로그인'],
    'ログイン ▾':['Log in ▾','登录 ▾','로그인 ▾'],
    'マイページ':['My Page','我的页面','마이페이지'],
    'みんなの広場':['Community','大家的广场','모두의 광장'],
    '学びの部屋':['Learning Room','学习室','배움의 방'],
    '物語ライブラリ':['Story Library','故事库','이야기 도서관'],
    '音楽コミュニティ':['Music Community','音乐社区','음악 커뮤니티'],
    'コンシェルジュ':['Concierge','礼宾服务','컨시어지'],
    '💬 コンシェルジュ':['💬 Concierge','💬 礼宾服务','💬 컨시어지'],
    'SATOIについて':['About SATOI','关于 SATOI','SATOI 소개'],
    'Satoiができること':['What SATOI can do','SATOI 能做什么','SATOI가 할 수 있는 것'],
    'ご本人':['Patient (you)','本人','본인'],
    'ご家族の方':['Family member','家属','가족'],
    'マインドマップ':['Mind Map','思维导图','마인드맵'],
    '入口':['Entrance','入口','입구'],
    // ---- 学びの部屋 タブ ----
    '読む':['Read','阅读','읽기'],
    '観る':['Watch','观看','보기'],
    '調べる':['Research','查阅','조사'],
    '伝える':['Share','传达','전하기'],
    '学んだことは、誰かの力になる':['What you learn becomes someone’s strength','你学到的，会成为他人的力量','당신이 배운 것이 누군가의 힘이 됩니다'],
    // ---- みんなの広場 ----
    '広場に投稿する':['Post to the Community','发布到广场','광장에 올리기'],
    'すべて':['All','全部','전체'],
    '相談':['Consult','咨询','상담'],
    '学び':['Learning','学习','배움'],
    'はげまし':['Encouragement','鼓励','격려'],
    'あなたの投稿':['Your posts','你的帖子','내 게시물'],
    '相談したい':['Ask for advice','想咨询','상담하고 싶어요'],
    '学んだことを共有':['Share what you learned','分享所学','배운 것을 공유'],
    'はげまし・ありがとう':['Encouragement / Thanks','鼓励·感谢','격려·감사'],
    // ---- C1 マイページ ----
    '気持ちの、軌跡':['The trajectory of feelings','心情的轨迹','마음의 궤적'],
    'あなたの、5つの側面':['Your five dimensions','你的五个维度','당신의 다섯 가지 측면'],
    'あなたは今、ここにいます':['You are here, now','你现在在这里','당신은 지금 여기에 있습니다'],
    '物語の壺':['The jar of stories','故事之壶','이야기 항아리'],
    '身体':['Body','身体','신체'],
    '活力':['Vitality','活力','활력'],
    '共感':['Empathy','共情','공감'],
    '精神':['Mind','精神','정신'],
    '社会':['Social','社会','사회'],
    'EMPSe 総合':['EMPSe Overall','EMPSe 综合','EMPSe 종합'],
    // ---- 調べる(学術) ----
    'PubMed で検索 →':['Search PubMed →','在 PubMed 搜索 →','PubMed에서 검색 →'],
    '要旨（翻訳）':['Abstract (translation)','摘要（翻译）','초록(번역)'],
    'やさしい日本語':['Plain language','通俗解说','쉬운 말'],
    '図表の解説':['Figure explained','图表说明','그림 설명']
  };
  var SATOI_LANG_NAMES = { ja:'日本語', en:'English', zh:'中文', ko:'한국어' };
  var SATOI_LANG_SHORT = { ja:'あ', en:'EN', zh:'中', ko:'한' };

  function i18nWalk(cb){
    if (!document.body) return;
    var w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, {
      acceptNode: function(n){
        var p = n.parentNode;
        if (!p) return NodeFilter.FILTER_REJECT;
        var tag = p.nodeName;
        if (tag === 'SCRIPT' || tag === 'STYLE' || tag === 'NOSCRIPT' || tag === 'TEXTAREA') return NodeFilter.FILTER_REJECT;
        if (p.closest && p.closest('#satoi-lang-chip, #satoi-toast-host')) return NodeFilter.FILTER_REJECT;
        return NodeFilter.FILTER_ACCEPT;
      }
    });
    var n, arr = [];
    while ((n = w.nextNode())) arr.push(n);
    arr.forEach(cb);
  }
  var LANG_IDX = { en:0, zh:1, ko:2 };
  window.satoiApplyLang = function(lang){
    if (!lang) lang = 'ja';
    try { sessionStorage.setItem('satoi_lang', lang); } catch(e){}
    document.documentElement.lang = lang;
    i18nWalk(function(n){
      // 翻訳対象として未登録なら、原文(トリム)が辞書キーの時だけ登録
      if (n.__satoiJa === undefined) {
        var key0 = (n.nodeValue || '').trim();
        if (SATOI_I18N[key0]) n.__satoiJa = n.nodeValue; else return;
      }
      var key = n.__satoiJa.trim();
      var entry = SATOI_I18N[key];
      if (!entry) return;
      if (lang === 'ja') { n.nodeValue = n.__satoiJa; return; }
      var idx = LANG_IDX[lang];
      var tr = (idx != null) ? entry[idx] : null;
      n.nodeValue = tr ? n.__satoiJa.replace(key, tr) : n.__satoiJa;
    });
    var lbl = document.getElementById('satoi-lang-chip-lbl');
    if (lbl) lbl.textContent = SATOI_LANG_SHORT[lang] || 'あ';
    var pop = document.getElementById('satoi-lang-chip-pop');
    if (pop) pop.querySelectorAll('button').forEach(function(b){ b.classList.toggle('active', b.getAttribute('data-lang') === lang); });
  };

  function injectLangChip(){
    if (document.getElementById('satoi-lang-chip')) return;
    var cur = 'ja';
    try { cur = sessionStorage.getItem('satoi_lang') || 'ja'; } catch(e){}
    var wrap = document.createElement('div');
    wrap.id = 'satoi-lang-chip';
    wrap.style.cssText = 'position:fixed; left:16px; bottom:18px; z-index:8800; font-family:inherit;';
    wrap.innerHTML =
        '<button id="satoi-lang-chip-btn" aria-label="言語 / Language" style="display:inline-flex; align-items:center; gap:6px; padding:9px 14px; border-radius:22px; border:1px solid rgba(212,169,94,0.55); background:rgba(11,23,54,0.92); color:#F8F6F0; font-size:13px; font-weight:600; cursor:pointer; box-shadow:0 8px 22px rgba(11,23,54,0.30); backdrop-filter:blur(8px);">'
      + '<span style="font-size:14px;">🌐</span><span id="satoi-lang-chip-lbl">' + (SATOI_LANG_SHORT[cur]||'あ') + '</span><span style="opacity:0.6; font-size:10px;">▾</span></button>'
      + '<div id="satoi-lang-chip-pop" style="display:none; position:absolute; left:0; bottom:calc(100% + 8px); background:rgba(11,23,54,0.97); border:1px solid rgba(212,169,94,0.4); border-radius:12px; padding:6px; min-width:140px; box-shadow:0 12px 32px rgba(0,0,0,0.5);">'
      + ['ja','en','zh','ko'].map(function(l){
          return '<button data-lang="'+l+'" style="display:block; width:100%; text-align:left; padding:9px 14px; border:none; background:transparent; color:#F8F6F0; font-size:13px; cursor:pointer; border-radius:8px; font-family:inherit;">'+SATOI_LANG_NAMES[l]+'</button>';
        }).join('')
      + '</div>';
    document.body.appendChild(wrap);
    var btn = document.getElementById('satoi-lang-chip-btn');
    var pop = document.getElementById('satoi-lang-chip-pop');
    btn.addEventListener('click', function(e){ e.stopPropagation(); pop.style.display = (pop.style.display === 'block' ? 'none' : 'block'); });
    document.addEventListener('click', function(){ pop.style.display = 'none'; });
    pop.querySelectorAll('button').forEach(function(b){
      b.addEventListener('mouseover', function(){ b.style.background = 'rgba(212,169,94,0.18)'; });
      b.addEventListener('mouseout', function(){ if (!b.classList.contains('active')) b.style.background = 'transparent'; });
      b.addEventListener('click', function(){
        var l = b.getAttribute('data-lang');
        window.satoiApplyLang(l);
        pop.style.display = 'none';
        if (typeof satoiNotify === 'function') satoiNotify('✓ ' + ({ja:'日本語に切り替えました',en:'Switched to English',zh:'已切换到中文',ko:'한국어로 전환했습니다'}[l]) + ' ・ ' + ({ja:'未対応の文は日本語のまま表示します',en:'Untranslated text stays in Japanese',zh:'未翻译的文字仍以日语显示',ko:'미번역 문장은 일본어로 표시됩니다'}[l]), {kind:'success', duration:3200});
      });
    });
    // active反映
    pop.querySelectorAll('button').forEach(function(b){ b.classList.toggle('active', b.getAttribute('data-lang') === cur); });
    var ab = pop.querySelector('button.active'); if (ab) ab.style.background = 'rgba(212,169,94,0.25)';
  }

  /* 法人(保険会社)向けの業務画面では、患者向けUI(入口/マインドマップ・コンシェルジュ・言語・おすすめ等)を出さない */
  function satoiIsCorporatePage(){
    var p = (location.pathname || '').toLowerCase();
    return p.indexOf('g1_corporate') !== -1 || p.indexOf('g2_corporate') !== -1;
  }

  /* ====== 固定ヘッダーの被り防止(全ページ共通・2026-05-22) ======
     固定ヘッダー(＋固定ジャーニーバー)の実高さを測り、直後の最初のコンテンツに
     「ヘッダー高さ＋余白」以上の上余白を保証する。max方式なので既に足りているページは触らない(二重余白にしない)。
     入口/マインドマップ トグル等でヘッダーが折り返して高くなっても、上のコンテンツが隠れない。 */
  function fixHeaderOverlap(){
    try {
      var header = document.querySelector('.header');
      if (!header) return;
      if (getComputedStyle(header).position !== 'fixed') return;
      var hh = header.getBoundingClientRect().height;
      if (!hh) return;
      // ヘッダー直下に固定のサブバー(ジャーニーバー)があれば、その高さも加算
      var jh = 0;
      var jbar = document.querySelector('.satoi-jbar, #satoi-jbar, .b1-journey-bar, #b1JourneyBar');
      if (jbar && getComputedStyle(jbar).position === 'fixed') jh = jbar.getBoundingClientRect().height;
      var need = Math.ceil(hh + jh + 14);
      // ヘッダー直後の「最初の流し込みコンテンツ」を探す(固定/絶対配置・ジャーニーバー・script等はスキップ)
      var el = header.nextElementSibling;
      while (el) {
        var skip = (el.tagName === 'SCRIPT' || el.tagName === 'STYLE' || el.tagName === 'LINK'
          || el.classList.contains('satoi-jbar') || el.id === 'satoi-jbar'
          || el.classList.contains('b1-journey-bar') || el.id === 'b1JourneyBar'
          || ['fixed','absolute'].indexOf(getComputedStyle(el).position) >= 0
          || getComputedStyle(el).display === 'none');
        if (!skip) break;
        el = el.nextElementSibling;
      }
      if (!el) return;
      var cs = getComputedStyle(el);
      var curPt = parseFloat(cs.paddingTop) || 0;
      var curMt = parseFloat(cs.marginTop) || 0;
      if (curPt + curMt < need) {
        el.style.paddingTop = Math.ceil(need - curMt) + 'px';
      }
    } catch(e){}
  }
  var __satoiHdrTimer = null;
  function scheduleHeaderFix(){ clearTimeout(__satoiHdrTimer); __satoiHdrTimer = setTimeout(fixHeaderOverlap, 120); }

  /* ====== 初期化 ====== */
  function init(){
    injectStyles();
    if (satoiIsCorporatePage()) {
      // B2B業務画面:患者向けの注入はすべてスキップ(誤混入を防ぐ)。被り防止だけは行う。
      bindLoginButtons();
      scheduleHeaderFix();
      window.addEventListener('load', scheduleHeaderFix);
      window.addEventListener('resize', scheduleHeaderFix);
      return;
    }
    injectHomeToggle();
    injectAiBar();
    injectEnhancedNav();
    injectLangChip();
    try { var sl = sessionStorage.getItem('satoi_lang'); if (sl && sl !== 'ja') window.satoiApplyLang(sl); } catch(e){}
    injectConciergeBubble();
    maybeRedirectFromA1();
    bindLoginButtons();
    enhanceAiCtaButtons();
    renderPickup();
    // 固定ヘッダーの被り防止(描画確定後＆フォント読込後にも再計算)
    fixHeaderOverlap();
    scheduleHeaderFix();
    window.addEventListener('load', scheduleHeaderFix);
    window.addEventListener('resize', scheduleHeaderFix);
    if (document.fonts && document.fonts.ready && document.fonts.ready.then) document.fonts.ready.then(scheduleHeaderFix);
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
