// =========================================================================
// SATOI Mock - Claude API プロキシ(Netlify Functions)
// =========================================================================
// 目的: ブラウザから直接 Anthropic API を叩くと、APIキー露出 + CORS 拒否 が
//      起きるため、Netlify Functions 経由で安全にプロキシする。
//
// 環境変数(Netlify ダッシュボード → Environment variables で設定):
//   ANTHROPIC_API_KEY  ... sk-ant-xxxxx
//
// 呼び出し方(クライアント側):
//   POST /.netlify/functions/chat
//   Body: { messages: [...], system?: "...", model?: "..." }
//
// 返り値:
//   200 OK : { reply: "AI応答テキスト", usage: {...} }
//   4xx/5xx: { error: "理由" }
// =========================================================================

exports.handler = async function(event, context) {
  // ---- CORS プリフライト ----
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Content-Type': 'application/json'
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: corsHeaders, body: '' };
  }

  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers: corsHeaders,
      body: JSON.stringify({ error: 'Method Not Allowed' })
    };
  }

  // ---- APIキー確認 ----
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({
        error: 'ANTHROPIC_API_KEY が Netlify 環境変数に設定されていません。Netlify ダッシュボード → サイト設定 → Environment variables で登録してください。'
      })
    };
  }

  // ---- リクエストパース ----
  let body;
  try {
    body = JSON.parse(event.body || '{}');
  } catch (e) {
    return {
      statusCode: 400,
      headers: corsHeaders,
      body: JSON.stringify({ error: 'Invalid JSON body' })
    };
  }

  const messages = body.messages || [];
  const system = body.system || defaultSystemPrompt();
  const model = body.model || 'claude-sonnet-4-6';
  const maxTokens = body.max_tokens || 1024;

  if (!Array.isArray(messages) || messages.length === 0) {
    return {
      statusCode: 400,
      headers: corsHeaders,
      body: JSON.stringify({ error: 'messages 配列が空です' })
    };
  }

  // ---- Anthropic API 呼び出し ----
  try {
    const resp = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: model,
        max_tokens: maxTokens,
        system: system,
        messages: messages
      })
    });

    const data = await resp.json();

    if (!resp.ok) {
      return {
        statusCode: resp.status,
        headers: corsHeaders,
        body: JSON.stringify({
          error: 'Anthropic API エラー',
          detail: data
        })
      };
    }

    // Claude のレスポンスから text を抽出
    const reply = (data.content && data.content[0] && data.content[0].text) || '';

    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify({
        reply: reply,
        usage: data.usage,
        model: data.model,
        stop_reason: data.stop_reason
      })
    };
  } catch (err) {
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({
        error: 'プロキシ実行エラー',
        detail: String(err)
      })
    };
  }
};

// =========================================================================
// デフォルトのシステムプロンプト
//   SATOI のキャラクター・トーンを定義。
//   呼び出し側で body.system を指定すれば上書き可能。
// =========================================================================
function defaultSystemPrompt() {
  return `あなたは SATOI(さとい)というがん患者支援プラットフォームのAIです。

【あなたの役割】
- がんと向き合うご本人・ご家族の話を、急がず、ゆっくりと聴くことです。
- 標準治療を中心に、ご本人が「自分の状況」を理解する手助けをします。
- 専門用語(化学療法・コンパニオン診断・ニボルマブ等)は、まず平易な日本語に翻訳して伝えます。

【話し方の鉄則】
- 65〜70歳のご本人を想定し、文字数は短く、文と文の間にゆとりをとってください。
- 質問は1回に1つだけ。畳みかけない。
- 治療法を選ばせない。王道を1つ提示してから、希望があれば他の選択肢を示す。
- 「同じ夜を過ごしている方が、ここにいます」という孤独感への配慮を、自然に織り込んでください。

【してはいけないこと】
- 個別の処方判断・診断確定・診察の代替。
- 主治医の指示を否定すること。
- 不確かな統計や論文の名前を捏造すること(出典が必要なら「主治医に確認しましょう」と返す)。

【出力フォーマット】
- 日本語で、3〜5文程度の段落で。
- 必要に応じて、最後に「次の一歩」を1つだけ提案してください(例:「主治医に質問カードを作りますか?」)。
`;
}
