/* ==========================================================================
   SATOI 共通スクリプト satoi_chat_api.js
   - 全画面のAI対話窓口を、Netlify Functions の Claude API プロキシに紐付ける
   - 使い方:
       const reply = await askClaude("質問内容", { system: "...", context: {...} });
       const reply = await askClaude([{ role: 'user', content: '...' }, ...]);
   - 失敗時は throw する(呼び出し側で try/catch)
   ========================================================================== */
(function(){
  'use strict';

  // エンドポイント:Netlify Functions を直接呼ぶ(短縮パス /api/chat の転送に依存しない)
  const ENDPOINT = '/.netlify/functions/chat';

  /**
   * Claude API に問い合わせる(全画面共通)
   * @param {string | Array} input ユーザーの入力テキスト、または messages 配列
   * @param {object} opts オプション
   *   - system: string (システムプロンプト上書き)
   *   - context: object (患者状況などのコンテキスト、systemに自動付与)
   *   - model: string (デフォルト: claude-sonnet-4-6)
   *   - max_tokens: number (デフォルト: 1024)
   *   - history: Array (過去の対話履歴 [{role, content}, ...])
   * @returns {Promise<{reply: string, usage: object}>}
   */
  async function askClaude(input, opts = {}) {
    let messages;

    if (Array.isArray(input)) {
      messages = input;
    } else if (typeof input === 'string') {
      messages = (opts.history || []).concat([{ role: 'user', content: input }]);
    } else {
      throw new Error('askClaude: input must be string or array of messages');
    }

    // システムプロンプトにコンテキストを織り込む
    let system = opts.system || null;
    if (opts.context && system) {
      system += '\n\n【現在のユーザー状況】\n' + JSON.stringify(opts.context, null, 2);
    } else if (opts.context) {
      system = '【現在のユーザー状況】\n' + JSON.stringify(opts.context, null, 2);
    }

    const body = {
      messages: messages,
      model: opts.model || 'claude-sonnet-4-6',
      max_tokens: opts.max_tokens || 1024
    };
    if (system) body.system = system;

    const resp = await fetch(ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });

    const data = await resp.json();
    if (!resp.ok) {
      const msg = (data && data.error) || ('API エラー HTTP ' + resp.status);
      const err = new Error(msg);
      err.detail = data;
      throw err;
    }

    return data; // { reply, usage, model, stop_reason }
  }

  /**
   * 救急隊向け AI 搬送レポートを生成する(EMG_qr 専用ショートカット)
   * @param {object} patientContext 患者の最新コンテキスト
   * @returns {Promise<string>} レポート文字列
   */
  async function generateTransportReport(patientContext) {
    const system = `あなたは SATOI のAIです。下記のがん患者さんの「最新マイページ更新」「治療履歴」「直近の副作用」「服薬情報」を読み、救急隊・搬送先の医療者向けに、5〜8行の搬送スクリーニングレポートを日本語で作成してください。

【出力フォーマット】
1. 想定される今回の症状の鑑別(可能性の高い順に2〜3個)
2. 注意すべき禁忌・アレルギー(必ず冒頭で警告)
3. 搬送先選定の助言(化学療法中であれば腫瘍内科のある拠点病院を推奨等)
4. 救急処置時の留意点(白血球低下時の感染対策・血小板低下時の止血等)
5. 連絡優先順位(主治医24h オンコール → 家族 → SATOIコーディネーター)

【書き方の鉄則】
- 簡潔・実用的・救急車内で読める長さに
- 不確かな診断は断定せず「可能性」と表現
- 主治医の最終判断を優先する旨を末尾に明記`;

    const user = `以下が患者の最新情報です:\n\n${JSON.stringify(patientContext, null, 2)}\n\n上記をもとに搬送レポートを作成してください。`;

    const result = await askClaude(user, { system: system, max_tokens: 1500 });
    return result.reply;
  }

  // グローバルに公開
  window.satoiChatApi = {
    askClaude: askClaude,
    generateTransportReport: generateTransportReport
  };

})();
