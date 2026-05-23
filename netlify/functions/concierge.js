// SATOIコンシェルジュ AIゲートウェイ（里井AIオーケストレーション層）
// 役割: フロントから来たメッセージを、サーバー側で Gemini API に橋渡しする。
// ★APIキーは絶対にHTMLに書かない。Netlifyの環境変数 GEMINI_API_KEY に置く。
// 設定する環境変数:
//   GEMINI_API_KEY  … 必須。Google AI Studio で発行（新規の事業専用Googleアカウント推奨）
//   GEMINI_MODEL    … 任意。既定 "gemini-1.5-flash"。新モデル名（例 gemini-3.5-flash）に差し替え可
//
// ※里井AIの「ワンクッション」: 患者さんの背景(context)を受け取り、
//   生の入力をそのまま渡さず、SATOIの方針(出典・主治医・安全)で包んで生成AIに渡す。

const SYSTEM_PROMPT = `あなたは「SATOIコンシェルジュ」。がんとともに歩く方に寄りそう、やさしいAIの相棒です。
- 必ず日本語で、やさしく、短めに、相手の気持ちに寄りそって話す。高齢の方にも分かる言葉で。
- 医療の判断（診断・治療・薬）は断定しない。「目安です。最終的な判断は主治医とご相談ください」を必要に応じて添える。
- 事実に基づき、可能なら出典（例：国立がん研究センター がん情報サービス）に触れる。推測で断定しない。
- つらさ・不安が強い時は、ひとりで抱えないよう受け止め、相談先（がん相談支援センター等）を案内する。
- 患者さんの背景（記録・状況）が与えられたら、それをふまえて“その人に”話す。
- 危険・自己判断を促す内容、根拠のない治療の推奨はしない。`;

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return json(405, { reply: 'Method Not Allowed', src: '', chips: [] });
  }
  let payload = {};
  try { payload = JSON.parse(event.body || '{}'); } catch (e) {}
  const message = (payload.message || '').toString().slice(0, 4000);
  const context = (payload.context || '').toString().slice(0, 4000); // 患者さんの背景（壺の要約など）

  const apiKey = process.env.GEMINI_API_KEY;
  const model = process.env.GEMINI_MODEL || 'gemini-1.5-flash';

  if (!apiKey) {
    return json(200, { reply: '（AI未接続：環境変数 GEMINI_API_KEY を設定してください）', src: '', chips: [] });
  }

  const userText = (context ? ('【患者さんの背景】\n' + context + '\n\n【メッセージ】\n') : '') + message;

  const body = {
    systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
    contents: [{ role: 'user', parts: [{ text: userText }] }],
    generationConfig: { temperature: 0.6, maxOutputTokens: 600 }
  };

  try {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
    const r = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    const data = await r.json();
    const parts = data && data.candidates && data.candidates[0] && data.candidates[0].content && data.candidates[0].content.parts;
    const reply = (parts ? parts.map(p => p.text || '').join('') : '').trim()
      || '（うまく聞き取れませんでした。もう一度お願いできますか）';
    return json(200, { reply, src: '', chips: [] });
  } catch (e) {
    return json(200, { reply: '（いま一時的にAIへつながりませんでした。少し待って、もう一度お試しください）', src: '', chips: [] });
  }
};

function json(statusCode, obj) {
  return { statusCode, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(obj) };
}
