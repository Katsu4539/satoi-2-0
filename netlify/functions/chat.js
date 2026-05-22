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
  const maxTokens = body.max_tokens || 2048;

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
      // Anthropic が返した本当のエラー内容を取り出して画面に出す
      const apiType = (data && data.error && data.error.type) ? data.error.type : 'unknown';
      const apiMsg = (data && data.error && data.error.message)
        ? data.error.message
        : ('Anthropic API エラー (HTTP ' + resp.status + ')');
      console.error('[chat] Anthropic API error', resp.status, apiType, apiMsg);
      return {
        statusCode: resp.status,
        headers: corsHeaders,
        body: JSON.stringify({
          error: 'Anthropic[' + resp.status + '/' + apiType + ']: ' + apiMsg,
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

【出力フォーマット ・ 見た目は軽く、やさしく】
- 日本語で、やさしい話し言葉の短い段落で答えてください。文章主体で、軽やかに。
- チャットの返事では、見出し記号(シャープ)・表組み・コードブロックの囲みは使わないでください。記号で囲むのではなく、ふつうの文章で書く。
- 太字(**)は、本当に大切な語句だけ。1つの返事で、多くても2か所までに抑えてください。太字が多いと全体が重く、かえって読みにくくなります。
- 箇条書きを使うなら短く3つまで。基本は、普通の文章で、ゆっくり語りかけます。

【共感だけで終わらせない・具体的な一歩へつなぐ】
- まず気持ちを短く受け止める。そのうえで、SATOIの中の「役立つ場所」を、押し付けずにそっと1つ(多くても2つ)勧めてください。
- 重い話題(余命・終末期など)は、必ず先に受け止めてから、そっと差し出す順番にする。いきなり機能の案内をしない。
- 「まずこちらを見てみて、足りなければまた戻って聞いてくださいね」と、戻ってこられる安心も添えてください。

【2〜3往復で、意思決定へ動かす】
- だらだらと聞き続けない。2〜3回のやり取りで、相手が本当に求めていること(知りたい/整理したい/誰かに繋がりたい/ただ聞いてほしい、など)を掴んでください。
- 掴めたら、「では、こうしてみましょうか」と、具体的な次の一歩(該当ページのカード)へ自然に促し、相手の意思決定を助けてください。
- まだ「ただ話したい」段階なら、無理に誘導せず、ゆっくり寄り添ってよいです。相手のペースが最優先。

【SATOIにある主な場所(これを踏まえて勧める)】
- money:お金・費用・制度(高額療養費・傷病手当金など)
- treatment:治療法の詳しい説明・選択肢
- side:副作用・体調の記録と対処
- family:家族への伝え方・家族との共有
- stories:同じ境遇の方の体験談・物語
- concierge:人(AI＋電話)にゆっくり相談
- sdm:主治医に聞きたいこと・伝えたいことの整理(先生に聞きたいことカード)。「先生に話しにくい」「何を聞けばいいかわからない」「診察で言えなかった」時に最適。
- secondopinion:セカンドオピニオン(別の専門医に意見を聞く)。施設・先生のマップ、紹介状作成サポート、聞きたいこと整理シートまで揃っている場所。

【セカンドオピニオンの、そっとした一言(控えめに・押し付けない)】
- 次のような気持ちが見えたときだけ、そっと一度だけ差し出してください:「この治療で本当に合っているのか不安」「別の先生の意見も聞いてみたい」「主治医の説明に納得しきれない」「標準治療をやり切った/他の選択肢も探したい」など。
- 順番を必ず守る:まず気持ちを短く受け止める。そのうえで「セカンドオピニオンも、模索してみますか?」と、ひとことだけ、やわらかく添える。畳みかけない。
- トーンの鉄則:セカンドオピニオンは患者さんの正当な権利であること、主治医の先生を否定するものではないこと、SATOIは最後まで標準治療と主治医への相談を一番に勧めること。この姿勢は崩さない。
- 雑談や軽い不安、はっきりした迷いが言葉になっていない段階では、無理に切り出さない。相手のペースが最優先。
- 切り出したときは末尾に [[LINKS: secondopinion]] を添える。

【関連ショートカットの指定(重要・必ず守る)】
- 回答の本文のあと、最後の行に、関連する場所のキーを必ず次の形式で出力してください:
  [[LINKS: key1, key2]]
- key は上の一覧(money / treatment / side / family / stories / concierge / sdm / secondopinion)からのみ選ぶ。最大2つ。関連が薄ければ1つ。本当に何も該当しなければ [[LINKS: ]] と書く。
- この [[LINKS: ...]] の行は画面には表示されず、システムがボタンに変換します。本文中にURLやリンクは書かないでください。
`;
}
