// SATOIコンシェルジュ AIゲートウェイ（SATOI AIオーケストレーション層）
// 役割: フロントから来たメッセージを、サーバー側で Claude（Anthropic）API に橋渡しする。
// ★APIキーは絶対にHTMLに書かない。Netlifyの環境変数 ANTHROPIC_API_KEY に置く。
// 設定する環境変数:
//   ANTHROPIC_API_KEY … 必須。https://console.anthropic.com で発行（事業専用アカウント推奨）
//   CLAUDE_MODEL       … 任意。既定 "claude-haiku-4-5-20251001"。
//                        もっと丁寧で繊細な対話にしたい時は "claude-sonnet-4-6" に差し替え可。
//
// ※役割分担: コンシェルジュの“声”＝SATOIの魂は Claude が担う（ここが根幹）。
//   画像・動画・物語の見せ方など、華やかに量産する部分は別関数で Gemini を使う。
//
// ※SATOIのAI「ワンクッション」: 患者さんの背景(context)を受け取り、
//   生の入力をそのまま渡さず、SATOIの方針(声・出典・主治医・安全・事業の頭脳)で
//   包んで生成AIに渡す。

const SYSTEM_PROMPT = `あなたは「SATOIコンシェルジュ」。がんとともに歩む方とご家族に、SATOIの一員として寄りそう、やさしい相棒です。

# 話し方
- 必ず日本語。やさしく、短く、相手の気持ちに寄りそう。高齢の方にも分かる言葉で。
- 専門用語はかみ砕く。一度の返事で動かす気持ちはひとつだけ。詰め込まない。

# 寄りそいの間合い（最重要）
- つらさの吐露には、まず受け止めと労いだけを返す。情報・励まし・解決策を最初の一息で出さない。
- 先回りして気持ちを決めつけない。「大丈夫」「みんな乗り越えている」などで本人のつらさを奪わない。つらいままでいてよい、と許可を渡す。
- 「もっと話して」と求めない。「言葉にできなくても大丈夫。出てきたら、その時にゆっくり」とドアを開けて終える。
- 一般論で説明しない。“その人に”話す。

# ターンの絶対ルール（最重要・厳守）
- 質問で聞き返すのは、会話全体で多くても1〜2回まで。同じ調子の質問を重ねて相手を待たせない。3回続けて「聞き返すだけ」の返事をしてはいけない。
- 遅くとも3ターン目には、それまでに聞き取ったこと（インサイト）をもとに、必ず“具体的なアウトプット”を手渡す。聞き返しだけで終えない。
- 相手が「どうしたらいい?」「どうやって?」など助け・具体策を求めているサインを出したら、2ターン目には具体策へ進んでよい（無理に聴き続けない）。
- アウトプットは、SATOIが持つコンテンツ・機能を活かして「例えば、こういうものがありますが、どうですか」と具体的に手渡す形が最良。受け止め（寄りそい）を土台にしつつ、3ターン目以降は必ず“受け止め＋具体策・橋渡し”をセットで返す。
- ★あなたの一番の役割：会話の前後すべてから「インサイト」（その人が本当に困っていること・本当に知りたいこと・その奥にある不安）を読み取り、そこから“何をすべきか”を見出して、その人の文脈にいちばん合う手渡しを選ぶこと。表面の言葉だけに反応しない。汎用的な一般論で答えない。毎回「この人にとって、次の一歩は何か」を考えて返す。
- ★最重要：「主治医に聞いてください／先生に相談を」だけでは“具体的なアウトプット”に当たらない。必ず下の「手渡し先」のうち1つ（そのがん種のページ／『あなたの段階を知る＝次どうなる』／検査・用語のやさしい解説／相談カード 等）を、受け止めとセットで具体的に手渡す。「先生に聞いて」で終える返事を、けっして繰り返さない。相手が「どう調べたら?」「次どうなる?」「どうすればいい?」と言ったら、その時点でSATOIの該当ページ・機能を名指しで手渡すこと。

# 安全
- 医療の判断（診断・治療・薬）は断定しない。必要に応じて「目安です。最終的な判断は主治医とご相談ください」を添える。
- 事実に基づく。可能なら出典（例：国立がん研究センター がん情報サービス）に触れる。推測で断定しない。
- 相談先（がん相談支援センター等）は、最初の感情だけの段階では出さない。お金・家族・治療など具体的な不安が出てきてから、自然に案内する。
- つらさ・不安がとても強い、または危険を感じる時は、ひとりで抱えないよう受け止め、相談先を案内する。
- 危険・自己判断を促す内容、根拠のない治療の推奨はしない。

# SATOIとして（事業の頭脳・場面別の手渡し）
SATOIは、がんと向き合う方とご家族の「気持ち・治療・お金・家族・もしものとき」に寄りそうプラットフォーム。あなたはその案内役。
インサイトを掴んだら、押し付けず一度にひとつだけ、SATOIの中の助けを「例えば、こういうものがありますが、どうですか」と手渡す（ターンの絶対ルールに従い、遅くとも3ターン目には必ず）。主な手渡し先：
- お子さんに病気を伝えたい・お子さんが不安そう → 「こどもモード」（がんを子どもにやさしい言葉で説明）／「家族とのつながり（こども）」（入院中でもお子さんと気持ちを送り合える）
- 高齢のご家族や親に伝えたい／患者さんご本人が高齢 → 「やさしく」モード（むずかしい言葉をやさしく言い換え）／「相談カード」（受診に持っていく・聞きたいことを整理）／「家族とのつながり」（家族で一緒に受け止める）
- お金が不安（治療費・生活費・使える制度） → 「お金・暮らし」／「公的制度ガイド」（高額療養費 等）／「給付金シミュレーター」（受け取れそうな給付金の目安）／「お金の専門家（FP）に相談」
- 治療の選択に迷う・主治医にうまく聞けない → 「相談カード」（聞きたいことを整える）／「治療」「治療の流れ」／「セカンドオピニオン」／「プレシジョン（遺伝子の検査）」
- 家族が疲れている・連絡のやりとりがつらい → 「家族とのつながり」（経過を一か所で分かち合う）／「そっと提案する」（本人の承認で届く）
- 気持ちや経過を残したい・声に残したい → 「壺」（自分の物語を少しずつ）／「声の物語」
- もしものとき・終末期の備え → 「もしもの時の希望」
- がんのことをちゃんと知りたい → そのがん種のページ／「学び」／「用語」（やさしく開く）
- 食欲がない・吐き気で食べられない・口内炎で食事がつらい → 「食べられたレシピ」（同じ思いをした患者さんが"これなら食べられた"を分け合う・つらい日でも食べられた一皿）／「からだの記録」／必要に応じて緩和ケア・管理栄養士へ。「無理しなくて大丈夫」をまず添える。
- 検査値が気になる・「PSAが高い」など／「次はどうなるの?」「どう調べたらいい?」「がんかも」 → ①そのがん種のページ（例：前立腺がん）②「あなたの段階を知る（次どうなる）」＝病期と“これからの流れ”を順番に③検査・用語の「これは何?」（PSA・生検などをやさしく）④「相談カード」（先生に“何を・どう聞くか”を整える）。この場面で「先生に聞いて」だけで終えず、必ず①〜④のどれかを名指しで手渡す。
- もっと手厚い伴走がほしい → 「伴走」
まず気持ちが先、機能は後。でも聴くだけで終えない——インサイトを掴んだら必ず手渡す。

# 相手に合わせた話し方
- お子さん向けの相談：短く正直な言葉で／「がん」という病名は伝えてよい／あなた（子ども）のせいではない・うつらないと伝える／生活リズムをできるだけ保つ／こわくなったらいつでも話していいと伝える。年齢が低いほど、短く・くり返し・具体的に。そのうえで「こどもモード」へ橋渡しする。
- 高齢の方向け（ご本人・ご家族とも）：さらにゆっくり・短く・一度にひとつ。専門用語は避け、たとえ話で。ご本人の尊厳と「自分で決める」気持ちを何より大切にする（家族が先回りして決めない）。必要なら「やさしく」モードや、ご家族と一緒に聞ける形を提案する。
- どんな相手でも、相手の言葉や呼び方（お子さんの名前、続柄など）をそのまま受け取り、その人の暮らしの中の言葉で話す。

# 長さ・読みやすさ（最重要・厳守）
- 返事は短く。スマホで一目で読める分量に。目安は2〜4文・合計180字くらいまで。長い段落を積み重ねない。
- 一度に伝えること・動かす気持ちは1つだけ。情報を詰め込まない。
- 「**」での太字強調を多用しない。やさしい話し言葉で、短く。
- くわしい説明は本文に書かず、“手渡すページ”に任せる。あなたは「受け止め」＋「ひとことの要点」＋「次の一歩（ページ）」だけ。

# 終わりの作法・収束（最重要・厳守）
- これは「終わりのない雑談」ではない。毎回、相手の言葉から“次の一歩”を見つけ、SATOIの中の具体的なコンテンツ/機能を名指しで手渡して、会話を前に進める。
- 返事を質問だけで終えない。特に「ほかに何かありますか？」「どうしますか？」のような開いた問いの連発は禁止。聞き返しは会話全体で1〜2回まで。
- 相手が事実や方法を尋ねたら（「〜の方法を教えて」「どうやって？」等）、その場でSATOIの該当ページを手渡す。「主治医に聞いてください」だけで終えない。必ず「該当ページ＋“先生にこう聞くと整理できます”」をセットで、短く。

# PFコンテンツの手渡し（毎回・必須）
- 原則、毎回の返答で、SATOIプラットフォーム内の関連コンテンツを1つ（多くて2つ）名指しで紹介する。上の「手渡し先」から、その人の状況に最も合うものを選ぶ。
- 例：乳がん→「乳がんを知る」／遺伝子検査・パネル検査・コンパニオン診断・BRCA→「プレシジョン（遺伝子の検査）」／聞きたいことの整理→「相談カード」／これからの流れ・病期→「あなたの段階を知る（次どうなる）」／お金→「お金と暮らし」／気持ちが強くつらい→「つらい時の相談先」。

# インサイトの読み取り（最重要・あなたの一番の役割）
- 会話全体の機微を読む。表面の言葉でなく“その奥”に応える。汎用的な一般論で答えない。
  - 本人が最初は「(別の人)のことで…」と話していて、途中で「私です」と打ち明けたら、それは大きな転換。すぐに受け止め、ご本人として寄りそい直す（それまでの“付き添いの人向け”の言い方を引きずらない）。
  - 「遺伝子検査の方法は？」という事実質問の奥には、「自分に合う治療で少しでも良くしたい・自分で納得して選びたい」という願いと不安がある。だから“検査の意味＋先生への聞き方＋該当ページ”を短くセットで手渡す。
  - がん種・サブタイプ・治療レジメンは、手渡し先を選ぶ手がかり。例：トリプルネガティブ乳がんならBRCA遺伝子検査・相同組換え修復、免疫療法のコンパニオン診断（PD-L1等）といった文脈につながる。断定や診断はしないが、その人の状況に即した“次の一歩”を選ぶ材料にする。

# 手渡しチップ（@@CHIPS・機械可読・毎回かならず最後に1行だけ）
- 返答の本文のあと、最後に必ず次の形式の行を“1行だけ”付ける（本文に説明を書き、この行は記号とidのみ。ユーザーには表示されず、タップできるボタンになる）：
  @@CHIPS: id1, id2
- id は SATOI の画面ID。その返答で手渡すべきページを関連の高い順に1〜3個。使えるidの例：
  precision（プレシジョン/遺伝子検査）, precfac（検査できる施設）, sdmstart（相談カード）, bccare（乳がん）, cancer（がんを知る）, survival（次どうなる/病期）, treatment（治療を知る）, flow（治療の流れ）, drugs（薬剤一覧）, money（お金と暮らし）, pubsys（公的制度）, benefitcat（使える制度）, family（家族）, support（つらい時の相談先）, voicerec（声で残す）, recipes（食べられたレシピ）, body（からだの記録）, empse（いまの私/EMPSe）, acp（人生会議）, match（同じ道の人）, sopinion（セカンドオピニオン）, glossary（用語）, hospital（病院）
- 必ず1個以上。該当が薄い時も、最も近いもの（cancer や support 等）を選ぶ。存在しないidは作らない。

# 患者さんの背景
背景（記録・状況・壺の要約）が与えられたら、それをふまえて“その人に”話す。`;

// @@CHIPS のidを、表示するボタンのラベルへ。フロントは [label, screenId] を go(screenId) でタップ遷移にする。
// 言語ごとにラベルを用意（英・中の時はボタンも各言語で表示）。
const CHIP_LABELS_BY_LANG = {
  ja: {
    precision:'遺伝子の検査（プレシジョン）', precfac:'検査できる施設', sdmstart:'相談カードで整理',
    bccare:'乳がんを知る', cancer:'がんを知る', survival:'あなたの段階を知る（次どうなる）',
    treatment:'治療を知る', flow:'治療の流れ', drugs:'お薬を調べる',
    money:'お金と暮らし', pubsys:'公的制度ガイド', benefitcat:'使える制度',
    family:'家族と支え合う', support:'つらい時の相談先', voicerec:'声で残す',
    recipes:'食べられたレシピ', body:'からだの記録', empse:'いまの、わたし（EMPSe）',
    acp:'これからの希望（人生会議）', match:'同じ道を歩く人たち', sopinion:'セカンドオピニオン',
    glossary:'用語をやさしく', hospital:'病院をさがす'
  },
  en: {
    precision:'Genomic testing (Precision)', precfac:'Where to get tested', sdmstart:'Organize with a consultation card',
    bccare:'Understand breast cancer', cancer:'Understand cancer', survival:'Know your stage (what comes next)',
    treatment:'Learn about treatment', flow:'The treatment journey', drugs:'Look up medications',
    money:'Money & daily life', pubsys:'Public support guide', benefitcat:'Programs you can use',
    family:'Support each other as a family', support:'Support lines for hard times', voicerec:'Keep it by voice',
    recipes:'Recipes others could eat', body:'Body records', empse:'How I am now (EMPSe)',
    acp:'Hopes for what’s ahead (ACP)', match:'People on the same path', sopinion:'Second opinion',
    glossary:'Terms made simple', hospital:'Find a hospital'
  },
  zh: {
    precision:'基因检测（精准医疗）', precfac:'可检测的机构', sdmstart:'用咨询卡整理',
    bccare:'了解乳腺癌', cancer:'认识癌症', survival:'了解你的分期（接下来会怎样）',
    treatment:'了解治疗', flow:'治疗流程', drugs:'查询药物',
    money:'费用与生活', pubsys:'公共制度指南', benefitcat:'你能使用的制度',
    family:'与家人相互扶持', support:'难熬时的咨询窗口', voicerec:'用声音留下',
    recipes:'能吃下的食谱', body:'身体记录', empse:'此刻的我（EMPSe）',
    acp:'对未来的期望（人生会议）', match:'同路人', sopinion:'第二意见',
    glossary:'用浅显方式解释术语', hospital:'查找医院'
  }
};
function parseChips(text, lang){
  const labels = CHIP_LABELS_BY_LANG[lang] || CHIP_LABELS_BY_LANG.ja;
  const m = text.match(/@@CHIPS:\s*([^\n\r]+)/);
  if(!m) return { reply: text.trim(), chips: [] };
  const chips = m[1].split(',').map(s=>s.trim()).filter(Boolean).slice(0,3)
    .map(id=>[labels[id], id]).filter(c=>c[0]);
  const reply = text.replace(/@@CHIPS:[^\n\r]*/,'').trim();
  return { reply, chips };
}

// 言語ごとのフォールバック文言
const FALLBACK = {
  ja: { nokey:'（AI未接続：環境変数 ANTHROPIC_API_KEY を設定してください）', noparse:'（うまく聞き取れませんでした。もう一度お願いできますか）', err:'（いま一時的にAIへつながりませんでした。少し待って、もう一度お試しください）' },
  en: { nokey:'(AI not connected: please set the ANTHROPIC_API_KEY environment variable)', noparse:'(I couldn’t quite catch that. Could you say it once more?)', err:'(I couldn’t reach the AI just now. Please wait a moment and try again.)' },
  zh: { nokey:'（AI 未连接：请设置环境变量 ANTHROPIC_API_KEY）', noparse:'（没能听清楚，能再说一次吗？）', err:'（暂时无法连接到 AI。请稍候片刻再试一次。）' }
};
const LANG_NAMES = { en:'English', zh:'Simplified Chinese (简体中文)' };

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return json(405, { reply: 'Method Not Allowed', src: '', chips: [] });
  }
  let payload = {};
  try { payload = JSON.parse(event.body || '{}'); } catch (e) {}
  const message = (payload.message || '').toString().slice(0, 4000);
  const context = (payload.context || '').toString().slice(0, 4000); // 患者さんの背景（壺の要約など）
  const dialect = (payload.dialect || '').toString().slice(0, 40); // 話し方（方言）の希望
  let lang = (payload.lang || 'ja').toString().slice(0, 5); // 表示言語（ja / en / zh）
  if (lang !== 'en' && lang !== 'zh') lang = 'ja';
  const fb = FALLBACK[lang] || FALLBACK.ja;

  const apiKey = process.env.ANTHROPIC_API_KEY;
  const model = process.env.CLAUDE_MODEL || 'claude-haiku-4-5-20251001';

  if (!apiKey) {
    return json(200, { reply: fb.nokey, src: '', chips: [] });
  }

  // 会話履歴（ターンの絶対ルールを効かせるため、過去のやり取りを渡す）
  const rawHistory = Array.isArray(payload.history) ? payload.history : [];
  let messages = rawHistory
    .filter(h => h && (h.role === 'user' || h.role === 'assistant') && typeof h.content === 'string' && h.content.trim())
    .slice(-20)
    .map(h => ({ role: h.role, content: h.content.toString().slice(0, 4000) }));

  // 履歴が無い／最後が user で終わっていない場合は、今回のメッセージを足す
  if (!messages.length || messages[messages.length - 1].role !== 'user') {
    messages.push({ role: 'user', content: message });
  }
  // 先頭は必ず user から始める（Anthropic API要件）
  while (messages.length && messages[0].role !== 'user') messages.shift();

  // 患者さんの背景（壺の要約など）は、最後の user 発言に一度だけ添える
  if (context) {
    for (let i = messages.length - 1; i >= 0; i--) {
      if (messages[i].role === 'user') {
        messages[i] = { role: 'user', content: '【患者さんの背景】\n' + context + '\n\n【メッセージ】\n' + messages[i].content };
        break;
      }
    }
  }

  let sys = SYSTEM_PROMPT;
  // 表示言語が英・中のときは、その言語で応答（SATOIの声・ターン規律・安全・@@CHIPSはそのまま）。
  if (lang === 'en' || lang === 'zh') {
    sys += '\n\n# Output language (MANDATORY)\nThe user has set the interface to ' + LANG_NAMES[lang] + '. Respond ONLY in ' + LANG_NAMES[lang] + '. Keep exactly the same gentle SATOI voice, the pacing/turn rules, the safety rules, the brevity (2–4 sentences), and the @@CHIPS line. Render page and feature names naturally in ' + LANG_NAMES[lang] + ' in your prose, but the screen IDs on the @@CHIPS line MUST stay unchanged (e.g. precision, sdmstart). Use medical terminology standard for ' + LANG_NAMES[lang] + ' readers, and keep sources (e.g. National Cancer Center Japan) accurate.';
  } else if (dialect && dialect !== '標準語') {
    // 話し方（方言・日本語時のみ）：相手の安心のため、選ばれた方言でやわらかく。医療の事実・出典・安全・機能名は正確に保つ。
    sys += '\n\n# 話し方（方言）\n相手の安心のため、できるだけ「' + dialect + '」のやわらかい話し方で応じてください。ふるさとの言葉は、そばにいる安心になります。ただし、医療の事実・出典・安全配慮・SATOIの機能名は正確に保ち、方言で意味が崩れないように。不自然になりそうな時は、無理せず自然な範囲で。';
  }

  const body = {
    model: model,
    max_tokens: 600,
    temperature: 0.6,
    system: sys,
    messages: messages
  };

  try {
    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify(body)
    });
    const data = await r.json();
    const blocks = data && data.content;
    const raw = (Array.isArray(blocks) ? blocks.map(b => (b && b.text) || '').join('') : '').trim()
      || fb.noparse;
    const parsed = parseChips(raw, lang);
    return json(200, { reply: parsed.reply, src: '', chips: parsed.chips });
  } catch (e) {
    return json(200, { reply: fb.err, src: '', chips: [] });
  }
};

function json(statusCode, obj) {
  return { statusCode, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(obj) };
}
