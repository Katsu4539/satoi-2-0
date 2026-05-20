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
  window.satoiAuth = {
    isLoggedIn: function(){ return sessionStorage.getItem('satoi_logged_in') === '1'; },
    login: function(){ sessionStorage.setItem('satoi_logged_in','1'); },
    logout: function(){ sessionStorage.removeItem('satoi_logged_in'); }
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

  /* ====== ユニバーサルナビ強化(既存ナビを置換) ====== */
  function injectEnhancedNav(){
    // 既存の satoi-univ-nav を削除して上書き
    const old = document.getElementById('satoi-univ-nav');
    if (old) old.remove();

    const nav = document.createElement('div');
    nav.id = 'satoi-univ-nav';
    nav.style.cssText = 'position:fixed; right:18px; top:50%; transform:translateY(-50%); z-index:9000; display:flex; flex-direction:column; gap:10px;';

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
      + btnHTML('satoi-home-enh','⌂',homeLabel);
    if (loggedIn) {
      html += btnHTML('satoi-my-enh','★',myLabel);
    }
    html += btnHTML('satoi-hub-enh','◎',hubLabel)
      + btnHTML('satoi-con-enh','☎',conLabel)
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
    document.getElementById('satoi-home-enh').addEventListener('click', () => location.href='SATOI_Mock_v1_A1_entrance.html');
    const myBtn = document.getElementById('satoi-my-enh');
    if (myBtn) myBtn.addEventListener('click', () => location.href='SATOI_Mock_v1_C1_mypage.html');
    document.getElementById('satoi-hub-enh').addEventListener('click', () => location.href='SATOI_Mock_v1_B1_hub.html');
    document.getElementById('satoi-con-enh').addEventListener('click', () => location.href='SATOI_Mock_v1_CON_concierge.html');
    document.getElementById('satoi-lang-enh').addEventListener('click', (e) => {
      e.stopPropagation();
      const existing = document.getElementById('suv-lang-pop');
      if (existing) { existing.remove(); return; }
      const pop = document.createElement('div');
      pop.id = 'suv-lang-pop';
      pop.style.cssText = 'position:fixed; right:120px; top:50%; transform:translateY(-50%); background:rgba(11,23,54,0.96); border:1px solid rgba(212,169,94,0.4); border-radius:12px; padding:10px; z-index:9100; min-width:140px; box-shadow:0 12px 32px rgba(0,0,0,0.5);';
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

  /* ====== スタイル注入 ====== */
  function injectStyles(){
    if (document.getElementById('satoi-common-styles')) return;
    const s = document.createElement('style');
    s.id = 'satoi-common-styles';
    s.textContent = `
      .satoi-univ-btn-enh {
        display: flex; flex-direction: column; align-items: center; justify-content: center;
        width: 84px; min-height: 84px; padding: 10px 6px;
        background: rgba(11,23,54,0.88);
        border: 1px solid rgba(212,169,94,0.5);
        border-radius: 20px;
        color: #F0C97A;
        cursor: pointer;
        font-family: inherit;
        backdrop-filter: blur(10px);
        -webkit-backdrop-filter: blur(10px);
        transition: all 0.25s ease;
        box-shadow: 0 4px 14px rgba(0,0,0,0.25);
      }
      .satoi-univ-btn-enh:hover {
        background: rgba(212,169,94,0.95);
        color: #0B1736;
        transform: translateX(-4px) scale(1.04);
        box-shadow: 0 8px 22px rgba(212,169,94,0.4);
      }
      .satoi-univ-btn-enh .suv-icon {
        font-size: 24px; line-height: 1; margin-bottom: 6px;
      }
      .satoi-univ-btn-enh .suv-label {
        font-size: 11px; letter-spacing: 0.02em; font-weight: 500; white-space: nowrap;
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
        .satoi-univ-btn-enh { width: 64px; min-height: 64px; padding: 8px 4px; }
        .satoi-univ-btn-enh .suv-icon { font-size: 19px; }
        .satoi-univ-btn-enh .suv-label { font-size: 10px; }
        .satoi-con-bubble { right: 84px; bottom: 16px; max-width: 220px; font-size: 11.5px; }
      }
    `;
    document.head.appendChild(s);
  }

  /* ====== コンシェルジュ・フローティングバブル ====== */
  function injectConciergeBubble(){
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

  /* ====== 初期化 ====== */
  function init(){
    injectStyles();
    injectEnhancedNav();
    injectConciergeBubble();
    maybeRedirectFromA1();
    bindLoginButtons();
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
