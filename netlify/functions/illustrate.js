// SATOI 物語の挿絵ゲートウェイ（SATOI AIオーケストレーション層・画像版ワンクッション）
// 役割: 患者さんが残した「物語」を受け取り、
//   ① まず Claude が物語を“理解”して、SATOIのトーンと安全配慮を込めた“絵のプロンプト”を書く
//   ② そのプロンプトを Gemini（Nano Banana系・画像生成）に渡して一枚の挿絵を描かせる
// 生の物語をそのまま画像AIに渡さない。絵の“魂”も SATOI（Claude）がワンクッションで設計する。
//
// 設定する環境変数:
//   ANTHROPIC_API_KEY  … 必須。絵のプロンプトを書く Claude 用（コンシェルジュと共用）
//   GEMINI_API_KEY     … 必須。画像生成 Gemini 用（※画像生成は有料枠の場合あり）
//   CLAUDE_MODEL       … 任意。既定 "claude-haiku-4-5-20251001"
//   GEMINI_IMAGE_MODEL … 任意。既定 "gemini-2.5-flash-image"（他: gemini-3.1-flash-image-preview 等）
//
// 返却: { ok:true, prompt, image:"data:image/png;base64,..." }
//        画像が作れない時は { ok:false, prompt, reason } を返し、フロントは「プロンプトだけ」見せて優雅にフォールバック。

const ART_DIRECTOR = `あなたはSATOIのイラストディレクター。がんとともに歩む方が残した「物語」を読み、その気持ちにそっと寄りそう一枚の挿絵のための、画像生成プロンプトを書きます。

# 絵のトーン
やわらかく、あたたかく、希望をほのかに感じる。水彩・絵本のようなやさしいタッチ。夜明け〜朝の光の色（淡いブルー、桜色、やさしい琥珀）。静かで、心がほどける雰囲気。

# 必ず避ける
- 医療的に生々しいもの（注射・点滴・手術・病室の生々しさ・痛みの描写）。
- 特定できる人物の顔、文字やロゴ、暗く絶望的な表現、過度に悲しい描写。
- がんや病気を直接描かない。比喩と情景で表す。

# 描くもの
物語の中の象徴的な情景や比喩（窓からの光、あたたかいお茶、夜明けに向かう小道、芽吹く小さな植物、寄りそう手のぬくもり、静かな朝の景色 など）。人物を入れる場合も後ろ姿やシルエットにとどめ、顔は描かない。

# 出力（厳守）
英語で、一段落の画像生成プロンプトだけを出力する（説明・前置き・引用符は書かない）。
最後に必ず次を含める: soft watercolor, storybook illustration, gentle dawn light, calm, hopeful, no text, no words.`;

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return json(405, { ok: false, reason: 'Method Not Allowed' });
  }
  let payload = {};
  try { payload = JSON.parse(event.body || '{}'); } catch (e) {}
  const story = (payload.story || '').toString().slice(0, 3000).trim();

  if (!story) {
    return json(200, { ok: false, reason: '物語が空です' });
  }

  const anthropicKey = process.env.ANTHROPIC_API_KEY;
  const geminiKey = process.env.GEMINI_API_KEY;
  const claudeModel = process.env.CLAUDE_MODEL || 'claude-haiku-4-5-20251001';
  const imageModel = process.env.GEMINI_IMAGE_MODEL || 'gemini-2.5-flash-image';

  // ---- ① Claude が「絵のプロンプト」を書く（SATOIのワンクッション） ----
  let prompt = '';
  if (anthropicKey) {
    try {
      const r = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': anthropicKey,
          'anthropic-version': '2023-06-01'
        },
        body: JSON.stringify({
          model: claudeModel,
          max_tokens: 400,
          temperature: 0.7,
          system: ART_DIRECTOR,
          messages: [{ role: 'user', content: 'この物語にそっとそえる、やさしい挿絵の画像生成プロンプトを書いてください。\n\n【物語】\n' + story }]
        })
      });
      const data = await r.json();
      const blocks = data && data.content;
      prompt = (Array.isArray(blocks) ? blocks.map(b => (b && b.text) || '').join('') : '').trim();
    } catch (e) { /* fallthrough */ }
  }

  // Claudeが使えない／失敗した時の控えめなプロンプト（最低限SATOIのトーンは保つ）
  if (!prompt) {
    prompt = 'A quiet path winding toward a soft dawn over gentle hills, a small sprouting plant in the foreground, warm morning light, soft watercolor, storybook illustration, gentle dawn light, calm, hopeful, no text, no words.';
  }

  // ---- ② Gemini が絵を描く ----
  if (!geminiKey) {
    return json(200, { ok: false, prompt, reason: 'GEMINI_API_KEY が未設定です' });
  }
  try {
    const url = 'https://generativelanguage.googleapis.com/v1beta/models/' + imageModel + ':generateContent?key=' + geminiKey;
    const r = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
    });
    const data = await r.json();
    const parts = data && data.candidates && data.candidates[0] && data.candidates[0].content && data.candidates[0].content.parts;
    let dataUrl = '';
    if (Array.isArray(parts)) {
      for (const p of parts) {
        const inline = p && (p.inlineData || p.inline_data);
        if (inline && inline.data) {
          const mime = inline.mimeType || inline.mime_type || 'image/png';
          dataUrl = 'data:' + mime + ';base64,' + inline.data;
          break;
        }
      }
    }
    if (dataUrl) {
      return json(200, { ok: true, prompt, image: dataUrl });
    }
    // 画像が返らない（権限/課金/モデル名など）→ プロンプトだけ返す
    const reason = (data && data.error && data.error.message) ? data.error.message : '画像を生成できませんでした（画像生成は有料枠の場合があります）';
    return json(200, { ok: false, prompt, reason: reason });
  } catch (e) {
    return json(200, { ok: false, prompt, reason: 'いま画像AIへつながりませんでした' });
  }
};

function json(statusCode, obj) {
  return { statusCode, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(obj) };
}
