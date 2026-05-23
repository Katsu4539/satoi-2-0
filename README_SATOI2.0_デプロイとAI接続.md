# SATOI 2.0 プロトタイプ — デプロイ と AI接続ガイド

## ファイル
- `SATOI_2.0_prototype.html` … 本体（単一ファイルのアプリ）。ダブルクリックでブラウザ表示。
- `netlify/functions/concierge.js` … AIゲートウェイ（里井AIオーケストレーション層／Gemini橋渡し）。

## いますぐ見る（キー不要）
`SATOI_2.0_prototype.html` をブラウザで開くだけ。AIコンシェルジュは、未接続時は内蔵のやさしい返答（ルールベース）にフォールバックするので、そのまま操作感を確認できます。

## 本物のAI（Gemini）につなぐ＝アップロード時
1. このフォルダを Netlify にデプロイ（ドラッグ＆ドロップ、または GitHub 連携）。`functions = "netlify/functions"` 設定済みなので関数が自動で有効になります。
2. **この事業専用の新規Googleアカウント**を作成 → Google AI Studio で **Gemini APIキー**を発行（個人や、管理者でない会社Workspaceは避ける）。
3. Netlify サイト設定 → Environment variables に登録：
   - `GEMINI_API_KEY` = 取得したキー（★HTMLには絶対書かない。サーバー側のみ）
   - `GEMINI_MODEL` = 任意。既定 `gemini-1.5-flash`。最新名（例 `gemini-3.5-flash`）に差し替え可。
4. 再デプロイ。コンシェルジュのチャットがサーバー越しに Gemini を使うようになります（キーはブラウザに出ません）。

## 仕組み（安全）
- フロントは `/.netlify/functions/concierge` に POST するだけ。キーは関数の環境変数にあり、HTMLからは見えない。
- 関数内で「里井AIのワンクッション」：患者さんの背景(context)と方針（出典・主治医・安全）で包んでから Gemini に渡す。
- 機能別にモデルを差し替え可能（医療特化AIや生成AI＝Gemini Omni/Spark等）。本ファイルはコンシェルジュ用の最小ゲートウェイ。

## 本番前のTODO（後工程・専門家）
- 医療回答は監修データへの RAG ＋ 専門医監修 ＋ 出典必須（自由生成にしない）。
- ソーシャルログインの実認証（OAuth申請）。
- がん種・薬・病院などの本データ投入（国がん級・data-driven）。
- 法令確認（薬機法／個人情報／医療広告ガイドライン）。
