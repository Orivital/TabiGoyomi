# 旅暦 - 旅程アプリ

複数人で共同編集できるプライベートな旅程PWAアプリです。

## 技術スタック

- React 19 + TypeScript + Vite
- Supabase (Auth, Database, Realtime)
- PWA (vite-plugin-pwa)
- devbox (ローカル環境)

## セットアップ

### 1. 環境変数

`.env.example` をコピーして `.env` を作成し、Supabase の値を設定してください。

```bash
cp .env.example .env
```

### 2. Supabase プロジェクト

1. [Supabase](https://supabase.com) でプロジェクトを作成
2. **Google プロバイダーを有効化**（必須）:
   - Supabase Dashboard → **Authentication** → **Providers**
   - **Google** を選択し、**Enable** をオンにする
   - [Google Cloud Console](https://console.cloud.google.com/) で OAuth 2.0
     クライアント ID を作成
   - Supabase に **Client ID** と **Client Secret** を入力して保存
   - 「invalid response」や「provider is not
     enabled」エラーは、この設定が未完了の場合に発生します
3. **リダイレクト URL 設定**（重要）: Authentication → URL Configuration
   で以下を追加:
   - Site URL: `http://localhost:5173`（開発時）
   - Redirect URLs: `http://localhost:5173/**` と
     `http://localhost:5174/**`（Vite はポート 5173 または 5174 を使用）
   - 本番時は本番 URL を追加（例: `https://your-app.vercel.app/**`）
4. **マイグレーション実行**: Supabase Dashboard → SQL Editor で
   `supabase/apply-migrations.sql` の内容を実行
5. **許可ユーザー登録**: `supabase/seed.sql`
   のメールアドレスを許可するユーザーのGoogleメールに置き換え、SQL Editor で実行

（CLI を使う場合: `supabase link` でプロジェクトをリンク後、`pnpm db:push`
でマイグレーション適用）

### Supabase MCP で実行する場合

Cursor に [Supabase MCP](https://supabase.com/mcp) を設定済みなら、AI
に「Supabase MCP で `supabase/apply-migrations.sql`
を実行して」と依頼すると、`execute_sql` でマイグレーションを実行できます。

プロジェクトを限定するには、`.cursor/mcp.json` の Supabase の URL に
`?project_ref=あなたのプロジェクトID` を追加してください（プロジェクト ID は
Supabase URL の `https://xxxxx.supabase.co` の `xxxxx` 部分）。

### 3. ローカル開発

#### Taskfile を使う場合（推奨）

```bash
task install  # 依存関係をインストール
task dev      # 開発サーバーを起動
```

#### 手動で実行する場合

```bash
devbox shell
pnpm install
pnpm dev
```

### 4. ビルド

#### Taskfile を使う場合

```bash
task build
```

#### 手動で実行する場合（ビルド）

```bash
pnpm build
```

### 5. Vercel デプロイ

1. GitHub にリポジトリをプッシュ
2. [Vercel](https://vercel.com) でプロジェクトをインポート
3. 環境変数 `VITE_SUPABASE_URL`、`VITE_SUPABASE_ANON_KEY`、`VITE_GOOGLE_MAPS_API_KEY` を設定
4. Supabase インテグレーションを有効化すると環境変数が自動連携されます

### 6. Google Places API（任意）

場所入力時のオートコンプリート機能を有効にするには、Google Maps API キーが必要です。

1. [Google Cloud Console](https://console.cloud.google.com/) で API キーを作成
2. **Maps JavaScript API** と **Places API (New)** を有効化
3. `.env` に `VITE_GOOGLE_MAPS_API_KEY=your-api-key` を設定
4. Vercel にも同じ環境変数を設定

API キー未設定の場合は、通常の手動テキスト入力にフォールバックします。

## トラブルシューティング

### 「This page isn't working」「invalid response」「provider is not enabled」

**原因**: Supabase で Google プロバイダーが有効になっていません。

**対処**: Supabase Dashboard → Authentication → Providers → Google で、Enable
をオンにし、Google Cloud Console で取得した Client ID と Client Secret
を入力してください。
