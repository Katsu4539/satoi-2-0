# SATOI Mock - 公開手順書

最終更新: 2026-05-19

---

## このフォルダの中身

このフォルダには、**サイトとして公開するために必要な全ファイル(計47)** が入っています。**まるごとアップロード**してください。

| 区分 | ファイル数 | 役割 |
|---|---|---|
| HTML ページ | 40 | 全画面コンテンツ |
| 共通 JS | 2 | satoi_common.js / satoi_chp_insight.js |
| 公開設定 | 4 | index.html / netlify.toml / _redirects / robots.txt |
| アイコン | 1 | favicon.svg |

---

## 公開方法(推奨順)

### ★ 方法 1:Netlify Drop(最速・15分で公開)

1. [https://app.netlify.com/drop](https://app.netlify.com/drop) にアクセス(Netlifyアカウントは無料登録)
2. このフォルダ(新Mock)をブラウザにドラッグ&ドロップ
3. アップロード完了で `https://xxx-yyy-zzz.netlify.app` のURLが即発行される
4. アクセスすると **index.html → A1入口画面に自動遷移**

**所要時間:5〜10分**
**コスト:無料(月100GB帯域まで)**
**カスタムドメイン:後から設定可能(例:`satoi.jp`)**

---

### 方法 2:Vercel

1. [https://vercel.com](https://vercel.com) でアカウント作成
2. New Project → Browse → このフォルダを選択
3. Deploy ボタン → URL発行

(GitHub経由が一般的だが、Vercel CLI で `vercel deploy` でもOK)

---

### 方法 3:レンタルサーバー(さくら/ロリポップ/XServer 等)

1. FTPクライアント(FileZilla等)でサーバーに接続
2. `public_html` または `www` 配下に全47ファイルをアップロード
3. ドメイン経由でアクセス → `https://example.com/` でA1入口画面が表示される

---

## URL構造(きれいなパス)

Netlify/Vercel では以下の短縮パスも自動で動きます(`netlify.toml` / `_redirects` で設定済み):

| 短縮パス | 飛び先 |
|---|---|
| `/` | A1入口画面(自動リダイレクト) |
| `/hub` | B1ハブ(ログイン後ホーム) |
| `/mypage` | C1マイページ |
| `/dialog` | A2 AI対話 |
| `/concierge` | コンシェルジュ |
| `/about` | SATOIについて |
| `/insurance` | 保険会員マイページ |
| `/corporate` | 法人会員ダッシュボード |

ご注意:`/hub` 等の短縮パスは Netlify/Vercel/Cloudflare Pages では動作しますが、**通常のレンタルサーバーでは効きません**。長いファイル名でアクセスしてください(例:`/SATOI_Mock_v1_B1_hub.html`)。

---

## アクセス制限(社外秘プレゼン用)

橋屋さん向けの非公開デモにしたい場合、Netlify では:

1. Site settings → Access control → Visitor access → **Password protection** を有効化(無料プランは Site password 1個まで、有料プランは個別ユーザー登録可)
2. プレゼン参加者だけにパスワードを伝える
3. 公開停止する時は、サイトを Delete または Pause

---

## 公開後にしておくべきこと

### 必須

- [ ] 公開URLを **橋屋さんに事前共有(or プレゼン当日にURLを開いて見せる)
- [ ] ブラウザで全画面の動作を3回テスト(Chrome / Safari / モバイルChrome)
- [ ] 通信環境のない場所でもプレゼンできるよう、念のため **オフラインバックアップ**としてフォルダごとUSB等にコピー

### 推奨

- [ ] アクセス制限(パスワード)を設定
- [ ] カスタムドメイン取得(例:`satoi.jp`)→ ブランディング強化
- [ ] Google Analytics 等のアクセス解析(プレゼン後のフォローアップに使える)

---

## トラブルシューティング

### Q. アップロードしてもA1入口画面ではなく「Index of /」が出る
→ index.html が正しく入っていない or サーバーの設定問題。`index.html` が存在することを確認してください。

### Q. リンクをクリックすると404が出る
→ 全47ファイルがアップロードされていない可能性。**フォルダごと**アップロードしてください(ファイル個別ではなく)。

### Q. CSS/JSが効かない
→ `satoi_common.js` / `satoi_chp_insight.js` がアップロードされていない可能性。確認してください。

### Q. 検索結果に出てしまう
→ `robots.txt` で全クロール拒否済みです(`Disallow: /`)。本番公開時のみ書き換えてください。

### Q. プレゼン当日に Wi-Fi が不安定で開けない
→ 事前にフォルダごとローカルにダウンロードし、`index.html` をブラウザで直接開けばオフラインでも動作します。

---

## ファイル構成(最終)

```
新Mock/
├─ index.html                           ← サイトのルート(A1入口へリダイレクト)
├─ netlify.toml                         ← Netlify 用設定(きれいなURL+セキュリティ)
├─ _redirects                           ← Netlify リダイレクトルール
├─ robots.txt                           ← 検索エンジン制御(現在 noindex)
├─ favicon.svg                          ← タブ表示用アイコン
├─ satoi_common.js                      ← 全画面共通(ログイン管理・ナビ・コンシェルジュ)
├─ satoi_chp_insight.js                 ← CHP/CAN系のAIインサイト+ヒーローSVG
│
├─ SATOI_Mock_v1_A1_entrance.html       ← 非会員向けトップ(夜空入口)
├─ SATOI_Mock_v1_A2_dialog.html         ← AI対話(resume後シナリオ完備)
├─ SATOI_Mock_v1_B1_hub.html            ← ログイン後ホーム(セカンドホーム)
├─ SATOI_Mock_v1_B1_mindmap.html        ← マインドマップ
├─ SATOI_Mock_v1_B3_treatment_detail.html ← 治療詳細
├─ SATOI_Mock_v1_C1_mypage.html         ← マイページ
│
├─ SATOI_Mock_v1_CHP_diagnosis.html     ← 章1 診断
├─ SATOI_Mock_v1_CHP_exam.html          ← 章2 検査
├─ SATOI_Mock_v1_CHP_consider.html      ← 章3 治療法を考える
├─ SATOI_Mock_v1_CHP_treatment.html     ← 章4 治療
├─ SATOI_Mock_v1_CHP_living.html        ← 章5 治療中の暮らし
├─ SATOI_Mock_v1_CHP_follow.html        ← 章6 治療後
├─ SATOI_Mock_v1_CHP_money.html         ← 章7 お金
├─ SATOI_Mock_v1_CHP_palliative.html    ← 章8 もしものとき
│
├─ SATOI_Mock_v1_CAN_breast.html        ← 乳がん
├─ SATOI_Mock_v1_CAN_colon.html         ← 大腸がん
├─ SATOI_Mock_v1_CAN_lung.html          ← 肺がん
├─ SATOI_Mock_v1_CAN_stomach.html       ← 胃がん
├─ SATOI_Mock_v1_CAN_prostate.html      ← 前立腺がん
├─ SATOI_Mock_v1_CAN_pancreas.html      ← 膵がん
│
├─ SATOI_Mock_v1_POSTURE_yorisou.html       ← 寄り添う
├─ SATOI_Mock_v1_POSTURE_tsunagaru.html     ← つながる
├─ SATOI_Mock_v1_POSTURE_michishirube.html  ← 道しるべ
│
├─ SATOI_Mock_v1_I_about.html           ← SATOIについて
├─ SATOI_Mock_v1_PHI_can_do.html        ← Satoiができること
├─ SATOI_Mock_v1_PRO_promises.html      ← 5つの約束
├─ SATOI_Mock_v1_MUS_community.html     ← 音楽コミュニティ
├─ SATOI_Mock_v1_CON_concierge.html     ← コンシェルジュ
├─ SATOI_Mock_v1_D1_stories.html        ← 先輩の物語
├─ SATOI_Mock_v1_D2_story_map.html      ← 物語マップ
├─ SATOI_Mock_v1_F4_side_effects.html   ← 副作用記録
├─ SATOI_Mock_v1_FAM_view.html          ← ファミリービュー
├─ SATOI_Mock_v1_FREE_map.html          ← 自由診療マップ
├─ SATOI_Mock_v1_ACAD_research.html     ← 学術ページ
├─ SATOI_Mock_v1_E1_money.html          ← お金・制度ハブ
├─ SATOI_Mock_v1_EMG_qr.html            ← 緊急QR
│
├─ SATOI_Mock_v1_G1_corporate_login.html      ← 法人ログイン
├─ SATOI_Mock_v1_G2_corporate_dashboard.html  ← 法人ダッシュボード
├─ SATOI_Mock_v1_G3_insurance_id_login.html   ← 保険会員ログイン
└─ SATOI_Mock_v1_G3_insurance_mypage.html     ← 保険会員マイページ
```

---

## サポート

公開作業でつまずいたら、いつでもこのドキュメントの内容を Claude / Cowork に貼って質問してください。
