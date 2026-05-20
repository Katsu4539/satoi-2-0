/* ==========================================================================
   SATOI CHP/CAN AIインサイト受信ブロック
   URL パラメータ(from / cancer / stage / urgency / regimen)を読み取って、
   ページ最上部に「AIからのパーソナライズ問いかけ」を出す。
   ========================================================================== */
(function(){
  'use strict';

  function getParams(){
    const p = new URLSearchParams(location.search);
    return {
      from: p.get('from') || '',
      cancer: p.get('cancer') || sessionStorage.getItem('satoi_cancer') || '',
      stage: p.get('stage') || sessionStorage.getItem('satoi_stage') || '',
      urgency: p.get('urgency') || '',
      regimen: p.get('regimen') || '',
      topic: p.get('topic') || '',
      beat: p.get('beat') || ''
    };
  }

  const cancerLabel = {
    breast: '乳がん', colon: '大腸がん', lung: '肺がん',
    stomach: '胃がん', prostate: '前立腺がん', pancreas: '膵がん'
  };
  const stageLabel = {
    I: 'ステージI', II: 'ステージII', III: 'ステージIII', IV: 'ステージIV'
  };

  function detectChapter(){
    const m = location.pathname.match(/CHP_(\w+)\.html/i);
    if (m) return { kind:'chp', key: m[1].toLowerCase() };
    const c = location.pathname.match(/CAN_(\w+)\.html/i);
    if (c) return { kind:'can', key: c[1].toLowerCase() };
    return null;
  }

  /* 章ごとのオープニング文言テンプレ */
  const chapterMsgs = {
    diagnosis: {
      title: '診断のこと、整理していきましょう',
      base: 'お聞きしてもよいですか? <strong>診断を受けたばかり</strong>なのか、<strong>診断内容の確認</strong>に来られたのか、それによって SATOI からのご案内を変えられます。',
      choices: [
        { label: '診断を受けたばかり', hint: '気持ちのこと・家族への伝え方から' },
        { label: '診断内容を確認したい', hint: '組織型・ステージ・進行度を整理' },
        { label: 'まだ気持ちが追いつかない', hint: 'ゆっくりモードで進めます' }
      ]
    },
    exam: {
      title: '検査のこと、確認しましょう',
      base: '<strong>これから受ける検査</strong> の準備でしたら、検査の意味と当日のイメージを。<strong>結果が出てから</strong> でしたら、数値の読み方を一緒に整理できます。',
      choices: [
        { label: 'これから検査を受ける', hint: '当日までの準備と心構え' },
        { label: '結果が出たばかり', hint: '数値の意味を一緒に確認' },
        { label: '追加検査を勧められた', hint: '次の一歩を整理' }
      ]
    },
    consider: {
      title: '治療法を考える、ご一緒します',
      base: '<strong>主治医の先生から治療レジメンの提示がある</strong> なら、それを起点に。<strong>まだ何も決まっていない</strong> なら、まず標準治療の全体像を30秒で俯瞰します。',
      choices: [
        { label: '主治医提示あり・確認したい', hint: '提示された治療法の理解と質問整理' },
        { label: 'まだ何も決まっていない', hint: '標準治療の全体像から' },
        { label: 'セカンドオピニオン検討中', hint: '比較整理のサポート' }
      ]
    },
    treatment: {
      title: '治療中の今、どんな状況ですか?',
      base: '治療を <strong>始めたばかり</strong> なのか、<strong>続けている中での悩み</strong> なのか。副作用・通院・心の波——どれもお聞きします。',
      choices: [
        { label: '治療を始めたばかり', hint: '副作用・スケジュール・連絡網' },
        { label: '副作用が辛い', hint: 'F4 副作用記録へ' },
        { label: '通院ペースの相談', hint: '仕事・家族との両立' }
      ]
    },
    living: {
      title: '治療中の暮らし、どこから話しますか?',
      base: '<strong>仕事</strong>・<strong>食事</strong>・<strong>睡眠</strong>・<strong>家族との関係</strong>。気になっているところから、お話しください。',
      choices: [
        { label: '仕事・収入の両立', hint: '社労士・両立支援制度' },
        { label: '食事と体力', hint: '管理栄養士の知見' },
        { label: '家族との時間', hint: 'ファミリービュー設計' }
      ]
    },
    follow: {
      title: '治療後の経過観察、お疲れさまでした',
      base: '<strong>定期検査の不安</strong>・<strong>再発の不安</strong>・<strong>復職復帰</strong>。これからのことを、一緒に整えていきましょう。',
      choices: [
        { label: '定期検査が不安', hint: '頻度と内容の整理' },
        { label: '再発が心配', hint: '前向きな備え方' },
        { label: '社会復帰のこと', hint: '職場との接続' }
      ]
    },
    money: {
      title: 'お金のこと、ご一緒に',
      base: '<strong>使える制度</strong>・<strong>高額療養費</strong>・<strong>民間保険の給付</strong>・<strong>就労支援</strong>。今いちばん知りたいことは、どれでしょう。',
      choices: [
        { label: '高額療養費・公的制度', hint: '制度マッチング' },
        { label: '民間保険の給付チェック', hint: 'G3保険マイページへ' },
        { label: '就労継続・収入の不安', hint: '社労士相談' }
      ]
    },
    palliative: {
      title: 'もしものとき、お話ししませんか',
      base: '<strong>ご本人のお気持ち</strong>・<strong>ご家族に伝えたいこと</strong>・<strong>緩和ケアの選択肢</strong>。急がず、ゆっくり、お話しください。',
      choices: [
        { label: 'ご本人の気持ちを整理', hint: 'AI が代弁ノートを作成' },
        { label: '家族に伝えたいこと', hint: 'ファミリービューで共有' },
        { label: '緩和ケアの選び方', hint: '在宅・病院・ホスピス' }
      ]
    }
  };

  /* CAN(原疾患)向けのテンプレ */
  const canMsgs = {
    breast: '乳がんのこと、整理していきましょう。HER2/ER/PgR の検査結果は出ていますか? ステージはお決まりですか?',
    colon: '大腸がんのこと、整理していきましょう。KRAS/RAS/MSI の検査結果は出ていますか?',
    lung: '肺がんのこと、整理していきましょう。EGFR/ALK/ROS1/PD-L1 の検査結果は出ていますか? ステージは?',
    stomach: '胃がんのこと、整理していきましょう。HER2/MSI の検査結果は出ていますか?',
    prostate: '前立腺がんのこと、整理していきましょう。PSA の数値とグリーソンスコアはお手元にありますか?',
    pancreas: '膵がんのこと、整理していきましょう。手術可能か・切除不能かの判断は出ていますか?'
  };

  function buildBlock(ch, params){
    const wrap = document.createElement('section');
    wrap.id = 'satoi-ai-insight';
    wrap.style.cssText = 'max-width: 920px; margin: 100px auto 0; padding: 0 24px;';

    let preamble = '';
    if (params.cancer && cancerLabel[params.cancer]) {
      preamble += '<strong>' + cancerLabel[params.cancer] + '</strong>';
      if (params.stage && stageLabel[params.stage]) preamble += ' ・ ' + stageLabel[params.stage];
      preamble += ' のあなたへ。';
    }
    if (params.urgency === 'asap') {
      preamble += '<span style="color:#D4622A; font-weight:500;">お急ぎとうかがいました。</span> ';
    }

    let body = '';
    let choices = [];
    if (ch.kind === 'chp') {
      const m = chapterMsgs[ch.key];
      if (!m) return null;
      body = '<h3 style="font-size:20px; font-weight:500; margin-bottom:10px; color: #0B1736; letter-spacing:0.04em;">'+m.title+'</h3>'
        + '<p style="font-size:14px; line-height:2; color:#1A2A40; font-weight:400; margin-bottom:18px;">'+preamble+m.base+'</p>';
      choices = m.choices;
    } else {
      const t = canMsgs[ch.key] || '';
      body = '<h3 style="font-size:20px; font-weight:500; margin-bottom:10px; color: #0B1736; letter-spacing:0.04em;">SATOI からの問いかけ</h3>'
        + '<p style="font-size:14px; line-height:2; color:#1A2A40; font-weight:400; margin-bottom:18px;">'+t+'</p>';
      choices = [
        { label: '検査結果あり・整理したい', hint: 'バイオマーカーから治療選択へ' },
        { label: 'まだ結果待ち', hint: '検査の意味と次のステップ' },
        { label: 'ステージから治療を理解したい', hint: 'ステージ別の標準治療' }
      ];
    }

    const choiceHTML = choices.map((c, i) => {
      return '<a href="SATOI_Mock_v1_A2_dialog.html?resume=1&from=chp_insight&cancer='+(params.cancer||'')+'&stage='+(params.stage||'')+'&topic='+encodeURIComponent(c.label)+'&beat='+ch.key+'" '
        + 'style="display:block; padding:14px 18px; background:rgba(11,23,54,0.04); border:1px solid rgba(11,23,54,0.12); border-radius:14px; color:#0B1736; text-decoration:none; transition:all 0.25s;" '
        + 'onmouseover="this.style.background=\'rgba(212,169,94,0.16)\'; this.style.borderColor=\'#D4A95E\'; this.style.transform=\'translateX(4px)\'" '
        + 'onmouseout="this.style.background=\'rgba(11,23,54,0.04)\'; this.style.borderColor=\'rgba(11,23,54,0.12)\'; this.style.transform=\'translateX(0)\'">'
        + '<div style="font-size:14px; font-weight:500; margin-bottom:4px;">▸ '+c.label+'</div>'
        + '<div style="font-size:11.5px; color:rgba(11,23,54,0.6);">'+c.hint+'</div>'
        + '</a>';
    }).join('');

    wrap.innerHTML =
      '<div style="background: linear-gradient(135deg, rgba(212,169,94,0.18), rgba(13,115,119,0.10)); border: 1px solid rgba(212,169,94,0.5); border-radius: 22px; padding: 28px 32px; box-shadow: 0 8px 28px rgba(11,23,54,0.06); position: relative;">'
      + '<div style="position:absolute; top:18px; right:22px; font-size:10px; letter-spacing:0.32em; color:rgba(11,23,54,0.5);">SATOI AI</div>'
      + '<div style="display:flex; gap:14px; align-items:flex-start;">'
      + '<div style="width:42px; height:42px; flex-shrink:0; border-radius:50%; background: radial-gradient(circle, #F0C97A, #D4A95E); display:flex; align-items:center; justify-content:center; font-size:18px; box-shadow: 0 0 18px rgba(212,169,94,0.5);">●</div>'
      + '<div style="flex:1;">'
      + body
      + '<div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap:10px;">'+choiceHTML+'</div>'
      + '</div></div></div>';

    return wrap;
  }

  function svgBackground(beat){
    /* 章別のSVG抽象画(ヒーロー薄く重ねる) */
    const svgs = {
      diagnosis: '<svg viewBox="0 0 800 220" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="xMidYMid slice"><defs><linearGradient id="g1" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#F0C97A" stop-opacity="0.25"/><stop offset="1" stop-color="#D4A95E" stop-opacity="0"/></linearGradient></defs><rect width="800" height="220" fill="url(#g1)"/><circle cx="640" cy="60" r="32" fill="#F0C97A" fill-opacity="0.35"/><path d="M0 180 Q200 140 400 170 T800 165 L800 220 L0 220 Z" fill="#D4A95E" fill-opacity="0.18"/></svg>',
      exam: '<svg viewBox="0 0 800 220" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="xMidYMid slice"><defs><radialGradient id="g2" cx="0.5" cy="0.5"><stop offset="0" stop-color="#7FA8C9" stop-opacity="0.32"/><stop offset="1" stop-color="#7FA8C9" stop-opacity="0"/></radialGradient></defs><rect width="800" height="220" fill="url(#g2)"/><circle cx="400" cy="110" r="40" fill="none" stroke="#5A8AAD" stroke-opacity="0.3" stroke-width="1"/><circle cx="400" cy="110" r="70" fill="none" stroke="#5A8AAD" stroke-opacity="0.2" stroke-width="1"/><circle cx="400" cy="110" r="100" fill="none" stroke="#5A8AAD" stroke-opacity="0.13" stroke-width="1"/><circle cx="400" cy="110" r="130" fill="none" stroke="#5A8AAD" stroke-opacity="0.08" stroke-width="1"/></svg>',
      consider: '<svg viewBox="0 0 800 220" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="xMidYMid slice"><path d="M400 220 Q400 140 320 80 Q280 50 200 30" fill="none" stroke="#D4A95E" stroke-opacity="0.28" stroke-width="1.5"/><path d="M400 220 Q400 140 480 80 Q520 50 600 30" fill="none" stroke="#D4A95E" stroke-opacity="0.28" stroke-width="1.5"/><path d="M400 220 L400 60" fill="none" stroke="#D4A95E" stroke-opacity="0.18" stroke-width="1" stroke-dasharray="4 6"/><circle cx="200" cy="30" r="6" fill="#D4A95E" fill-opacity="0.5"/><circle cx="400" cy="60" r="6" fill="#D4A95E" fill-opacity="0.5"/><circle cx="600" cy="30" r="6" fill="#D4A95E" fill-opacity="0.5"/></svg>',
      treatment: '<svg viewBox="0 0 800 220" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="xMidYMid slice"><defs><linearGradient id="g4" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#7FB37F" stop-opacity="0.22"/><stop offset="1" stop-color="#7FB37F" stop-opacity="0"/></linearGradient></defs><rect width="800" height="220" fill="url(#g4)"/><path d="M0 80 L160 0 L220 100 L400 20 L460 130 L640 40 L800 110 L800 220 L0 220 Z" fill="#5A8A5A" fill-opacity="0.12"/></svg>',
      living: '<svg viewBox="0 0 800 220" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="xMidYMid slice"><rect x="500" y="40" width="220" height="140" fill="none" stroke="#D4A95E" stroke-opacity="0.3" stroke-width="1.5" rx="6"/><line x1="610" y1="40" x2="610" y2="180" stroke="#D4A95E" stroke-opacity="0.2" stroke-width="1"/><line x1="500" y1="110" x2="720" y2="110" stroke="#D4A95E" stroke-opacity="0.2" stroke-width="1"/><circle cx="100" cy="100" r="40" fill="#F0C97A" fill-opacity="0.28"/><path d="M0 200 Q200 180 400 190 T800 185" fill="none" stroke="#D4A95E" stroke-opacity="0.18" stroke-width="2"/></svg>',
      follow: '<svg viewBox="0 0 800 220" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="xMidYMid slice"><path d="M400 220 L400 100 M400 100 Q360 80 340 60 M400 100 Q440 80 460 60" fill="none" stroke="#9A7FB3" stroke-opacity="0.4" stroke-width="2"/><circle cx="340" cy="60" r="8" fill="#9A7FB3" fill-opacity="0.5"/><circle cx="460" cy="60" r="8" fill="#9A7FB3" fill-opacity="0.5"/><circle cx="400" cy="80" r="5" fill="#9A7FB3" fill-opacity="0.4"/><circle cx="380" cy="120" r="4" fill="#9A7FB3" fill-opacity="0.35"/><circle cx="420" cy="120" r="4" fill="#9A7FB3" fill-opacity="0.35"/></svg>',
      money: '<svg viewBox="0 0 800 220" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="xMidYMid slice"><circle cx="200" cy="110" r="38" fill="#14A6AB" fill-opacity="0.18" stroke="#14A6AB" stroke-opacity="0.4" stroke-width="1.5"/><circle cx="400" cy="110" r="38" fill="#14A6AB" fill-opacity="0.18" stroke="#14A6AB" stroke-opacity="0.4" stroke-width="1.5"/><circle cx="600" cy="110" r="38" fill="#14A6AB" fill-opacity="0.18" stroke="#14A6AB" stroke-opacity="0.4" stroke-width="1.5"/><text x="200" y="118" text-anchor="middle" fill="#0D7377" font-family="sans-serif" font-size="22" fill-opacity="0.5">¥</text><text x="400" y="118" text-anchor="middle" fill="#0D7377" font-family="sans-serif" font-size="22" fill-opacity="0.5">¥</text><text x="600" y="118" text-anchor="middle" fill="#0D7377" font-family="sans-serif" font-size="22" fill-opacity="0.5">¥</text></svg>',
      palliative: '<svg viewBox="0 0 800 220" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="xMidYMid slice"><circle cx="120" cy="50" r="3" fill="#C76B7F" fill-opacity="0.6"/><circle cx="240" cy="80" r="2" fill="#C76B7F" fill-opacity="0.45"/><circle cx="380" cy="40" r="3" fill="#C76B7F" fill-opacity="0.55"/><circle cx="520" cy="70" r="2.5" fill="#C76B7F" fill-opacity="0.5"/><circle cx="680" cy="50" r="3" fill="#C76B7F" fill-opacity="0.6"/><path d="M400 220 L400 160 L380 140 L420 140 L400 160 Z" fill="#F0C97A" fill-opacity="0.4"/><circle cx="400" cy="120" r="14" fill="#F0C97A" fill-opacity="0.35"/></svg>'
    };
    return svgs[beat] || svgs.consider;
  }

  function injectSvgIntoHero(ch){
    const hero = document.querySelector('section.hero, .hero');
    if (!hero) return;
    if (hero.querySelector('.satoi-hero-svg')) return;
    const wrap = document.createElement('div');
    wrap.className = 'satoi-hero-svg';
    wrap.style.cssText = 'position:absolute; inset:0; pointer-events:none; opacity:0.65; z-index:0;';
    wrap.innerHTML = svgBackground(ch.key);
    // hero に position:relative を確保
    const cs = getComputedStyle(hero);
    if (cs.position === 'static') hero.style.position = 'relative';
    hero.insertBefore(wrap, hero.firstChild);
    // 既存中身を z-index 1 で前面に
    Array.from(hero.children).forEach(c => {
      if (c === wrap) return;
      const ccs = getComputedStyle(c);
      if (ccs.position === 'static') c.style.position = 'relative';
      c.style.zIndex = '1';
    });
  }

  function init(){
    const ch = detectChapter();
    if (!ch) return;
    const params = getParams();
    // SVG ヒーロー装飾
    injectSvgIntoHero(ch);
    // AIインサイトブロック
    const block = buildBlock(ch, params);
    if (!block) return;
    // hero の前に挿入
    const hero = document.querySelector('section.hero, .hero');
    if (hero && hero.parentNode) {
      hero.parentNode.insertBefore(block, hero);
    } else {
      const main = document.querySelector('main, body');
      if (main) main.insertBefore(block, main.firstChild);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
