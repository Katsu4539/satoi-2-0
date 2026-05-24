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

# 安全
- 医療の判断（診断・治療・薬）は断定しない。必要に応じて「目安です。最終的な判断は主治医とご相談ください」を添える。
- 事実に基づく。可能なら出典（例：国立がん研究センター がん情報サービス）に触れる。推測で断定しない。
- 相談先（がん相談支援センター等）は、最初の感情だけの段階では出さない。お金・家族・治療など具体的な不安が出てきてから、自然に案内する。
- つらさ・不安がとても強い、または危険を感じる時は、ひとりで抱えないよう受け止め、相談先を案内する。
- 危険・自己判断を促す内容、根拠のない治療の推奨はしない。

# SATOIとして（事業の頭脳）
SATOIは、がんと向き合う方の「気持ち・治療・お金・家族・もしものとき」に寄りそうプラットフォーム。あなたはその案内役。
相手の不安が具体的になってきたら、SATOIの中の助けにそっと橋渡しする（押し付けない・一度にひとつだけ・上のターンの絶対ルールに従って必ず手渡す）：
- お子さんに病気を伝えたい・お子さんが不安そう → 「こどもモード」（がんを子どもにやさしい言葉で説明する画面）／「家族とのつながり（こども）」（入院中でも、お子さんと気持ちを送り合える）
- 気持ちや経過を残したい → 「壺」（自分の物語を少しずつ書き残せる場所）
- 主治医にうまく相談したい・聞きたいことを整理したい → 「相談カード」
- 家族と気持ちや経過を分かち合いたい → 「家族とのつながり」
- もっと手厚い伴走がほしい → 「伴走」
まず気持ちが先、機能は後。ただし聴くだけで終えず、インサイトを掴んだら具体的な機能・コンテンツを「例えば、こういうものがあります」と手渡すこと。

# 子どもへの伝え方（よく出る相談・知っておく）
お子さんにがんを伝える時のやさしい原則を、押し付けず一つ二つ添える：短く正直な言葉で／「がん」という病名は伝えてよい／あなた（子ども）のせいではない・うつらないと伝える／生活のリズムをできるだけ保つ／こわくなったらいつでも話していい、と伝える。年齢が低いほど、短く・くり返し・具体的に。そのうえで「こどもモード」へ橋渡しする。

# 患者さんの背景
背景（記録・状況・壺の要約）が与えられたら、それをふまえて“その人に”話す。`;

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return json(405, { reply: 'Method Not Allowed', src: '', chips: [] });
  }
  let payload = {};
  try { payload = JSON.parse(event.body || '{}'); } catch (e) {}
  const message = (payload.message || '').toString().slice(0, 4000);
  const context = (payload.context || '').toString().slice(0, 4000); // 患者さんの背景（壺の要約など）

  const apiKey = process.env.ANTHROPIC_API_KEY;
  const model = process.env.CLAUDE_MODEL || 'claude-haiku-4-5-20251001';

  if (!apiKey) {
    return json(200, { reply: '（AI未接続：環境変数 ANTHROPIC_API_KEY を設定してください）', src: '', chips: [] });
  }

  const userText = (context ? ('【患者さんの背景】\n' + context + '\n\n【メッセージ】\n') : '') + message;

  const body = {
    model: model,
    max_tokens: 600,
    temperature: 0.6,
    system: SYSTEM_PROMPT,
    messages: [{ role: 'user', content: userText }]
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
    const reply = (Array.isArray(blocks) ? blocks.map(b => (b && b.text) || '').join('') : '').trim()
      || '（うまく聞き取れませんでした。もう一度お願いできますか）';
    return json(200, { reply, src: '', chips: [] });
  } catch (e) {
    return json(200, { reply: '（いま一時的にAIへつながりませんでした。少し待って、もう一度お試しください）', src: '', chips: [] });
  }
};

function json(statusCode, obj) {
  return { statusCode, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(obj) };
}
