# 旅暦 - 旅程アプリ

複数人で共同編集できるプライベートな旅程PWAアプリです。

## 技術スタック

- React 19 + TypeScript + Vite
- Supabase (Auth, Database, Realtime)
- PWA (vite-plugin-pwa)
- devbox (ローカル環境)

## 環境構成

| 環境 | 用途 | Supabase プロジェクト | 接続設定 |
|------|------|----------------------|---------|
| Development | ローカル開発 | ローカル（`supabase start`） | `.env.local` |
| Staging (Preview) | 検証・プレビュー | TabiGoyomi-staging (`fowxrnfttrnvogssaqef`) | Vercel Preview 環境変数 |
| Production | 本番 | TabiGoyomi (`ssyeychimkqjhzvwucap`) | Vercel Production 環境変数 |

## セットアップ

### 1. ローカル開発環境

```bash
devbox shell
pnpm install
```

ローカル Supabase を起動します:

```bash
devbox run supabase:start
```

**前提:** 初回から `.env.local` が必要です（最後に本番同期 `db:sync` が走るため）。
無い場合は先に `.env.example` をコピーして作成してください。

`devbox run supabase:start` は `supabase start` の後に `supabase status -o env`
から現在の `API_URL` / `PUBLISHABLE_KEY` / `ANON_KEY` を `.env.local` へ同期します。
ローカル Realtime は stale な鍵で不安定になるため、`.env.local` の
`VITE_SUPABASE_PUBLISHABLE_KEY` は常にこの同期結果を使ってください。

**本番データ同期（`db:sync`）について:** ダンプ元は **`supabase link` ではなく**
`scripts/sync-db-targets.json` の **`production`** に固定されています。
`db:sync-staging` は同ファイルの **`staging`** を書き込み先に使います（本番からダンプして Staging に流し込み）。
`.env.local` の `SUPABASE_PROD_DB_PASSWORD` は本番 DB 用、`SUPABASE_STAGING_DB_PASSWORD` は Staging 用です。

一時ダンプは **`mktemp`・パーミッション 600・終了時削除** し、`/tmp/prod_data.sql` のように固定パスに本番データを残しません。

投入前の **`TRUNCATE` 対象テーブル**は `scripts/db-sync-truncate-app-data.sql` に一本化しています（変更時は `src/lib/syncDbTargets.test.ts` も更新）。

接続先を変えるときは `sync-db-targets.json` を編集するか、
`SUPABASE_PROD_PROJECT_REF` / `SUPABASE_PROD_POOLER_HOST`、
`SUPABASE_STAGING_PROJECT_REF` / `SUPABASE_STAGING_POOLER_HOST` で上書きしてください。

`scripts/sync-db-targets.json` や **`db-sync-truncate-app-data.sql`** を変えたら **`src/lib/syncDbTargets.test.ts` の期待値も合わせて更新**してください。

`pnpm db:push` などマイグレーション用の **`supabase link` は別**です（リンク先は作業内容に合わせて Staging / Production を選びます）。

手動で起動した場合も、開発サーバー起動前に以下を実行してください。

```bash
./scripts/sync-local-supabase-env.sh
```

```bash
pnpm dev
```

### 2. Supabase 各環境の設定

各 Supabase プロジェクト（ローカル・staging・production）に対して以下を設定します。

#### Google プロバイダーの有効化（必須）

- Supabase Dashboard → **Authentication** → **Providers**
- **Google** を選択し、**Enable** をオンにする
- [Google Cloud Console](https://console.cloud.google.com/) で OAuth 2.0
  クライアント ID を作成
- Supabase に **Client ID** と **Client Secret** を入力して保存

#### リダイレクト URL 設定（重要）

Authentication → URL Configuration で以下を追加:

| 環境 | Site URL | Redirect URLs |
|------|----------|---------------|
| ローカル | `http://localhost:5173` | `http://localhost:5173/**`, `http://localhost:5174/**` |
| Staging | `https://tabigoyomi-git-*.vercel.app` | `https://tabigoyomi-git-*.vercel.app/**` |
| Production | `https://tabigoyomi.vercel.app` | `https://tabigoyomi.vercel.app/**` |

#### マイグレーション実行

CLI を使う場合:

```bash
supabase link --project-ref <project-id>
pnpm db:push
```

または Supabase Dashboard → SQL Editor で `supabase/apply-migrations.sql` を実行。

#### 許可ユーザー登録

`supabase/seed.sql` のメールアドレスを実際のGoogleメールに置き換え、SQL Editor で実行。

### Supabase MCP で実行する場合

Cursor に [Supabase MCP](https://supabase.com/mcp) を設定済みなら、AI
に「Supabase MCP で `supabase/apply-migrations.sql`
を実行して」と依頼すると、`execute_sql` でマイグレーションを実行できます。

プロジェクトを限定するには、`.cursor/mcp.json` の Supabase の URL に
`?project_ref=あなたのプロジェクトID` を追加してください（プロジェクト ID は
Supabase URL の `https://xxxxx.supabase.co` の `xxxxx` 部分）。

### 3. Vercel 環境変数の設定

[Vercel Dashboard](https://vercel.com) → プロジェクト → **Settings** →
**Environment Variables** で以下を設定します。

**Production 環境（`ssyeychimkqjhzvwucap`）:**

| 変数名 | 対象 Environment |
|--------|----------------|
| `VITE_SUPABASE_URL` | Production |
| `VITE_SUPABASE_ANON_KEY` | Production |
| `VITE_GOOGLE_MAPS_API_KEY` | Production |

**Preview 環境（staging: `fowxrnfttrnvogssaqef`）:**

| 変数名 | 対象 Environment |
|--------|----------------|
| `VITE_SUPABASE_URL` | Preview |
| `VITE_SUPABASE_ANON_KEY` | Preview |
| `VITE_GOOGLE_MAPS_API_KEY` | Preview |

Staging の接続情報:
- URL: `https://fowxrnfttrnvogssaqef.supabase.co`
- Anon Key: Supabase Dashboard → **Settings** → **API** で確認

### 4. ビルド

```bash
pnpm build
```

### 5. Vercel デプロイ

1. GitHub にリポジトリをプッシュ
2. Vercel が自動でデプロイ（`main` ブランチ → Production、PR → Preview/Staging）

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
