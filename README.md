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

ローカル本番同期の**既定の実行環境は devbox** です（`devbox run db:sync`）。devbox の `postgresql` パッケージにより **`psql` が PATH に入る**想定です。  
`db:sync` は **`supabase db reset` は行わず**、未適用の **`supabase migration up --local`** のあと、`db-sync-truncate-app-data.sql` でアプリ用テーブルを空にしてから本番ダンプを投入します（スキーマ追加だけなら reset 不要）。ローカル DB が壊れているときだけ、手動で `supabase db reset` を検討してください。  
**devbox 外**で `./scripts/db-sync-local.sh` を直接実行するとホストに `psql` が無いことがあり、その場合は `supabase start` 済みの Docker コンテナ `supabase_db_*` へ `docker exec` して流し込むフォールバックがあります（`supabase db query -f` は複文 SQL のダンプに使えないため）。

一時ダンプは **`mktemp`・パーミッション 600・終了時削除** し、`/tmp/prod_data.sql` のように固定パスに本番データを残しません。

投入前の **`TRUNCATE` 対象**は `scripts/db-sync-truncate-app-data.sql` に一本化しています（アプリ用テーブルに加え、`auth.users` と `auth.flow_state` を空にして認証系データの主キー衝突を防ぎます。認証側は GoTrue がシーケンス所有者のため `RESTART IDENTITY` は付けません）。本番ダンプ側も `dump-prod-data.sh` で `auth.flow_state` を除外。変更時は `src/lib/syncDbTargets.test.ts` も更新してください。

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

## ドキュメント

- [プッシュ通知・旅程リマインダー要件](docs/push-reminders-requirements.md)（[#26](https://github.com/Orivital/TabiGoyomi/issues/26)）

### 旅程リマインダー（Web Push）の有効化

1. **VAPID 鍵**: `npx web-push generate-vapid-keys` で鍵ペアを生成する。
2. **フロント**: `.env` / Vercel に `VITE_VAPID_PUBLIC_KEY`（公開鍵のみ）を設定する。
3. **マイグレーション**: `pnpm db:push` を実行するか、Dashboard を使う場合は `supabase/apply-migrations.sql`（全マイグレーションをまとめたファイル）を適用する。個別に適用する場合は `20260321120000_push_reminders.sql`・`20260321140000_remind_end_at.sql`・`20260327000001_fix_reminder_due_window.sql` をすべて適用すること。
4. **Edge Function `send-trip-reminders`**: `supabase functions deploy send-trip-reminders` でデプロイし、次をシークレットに設定する。
   - `CRON_SECRET`（任意の長いランダム文字列。呼び出し時 `Authorization: Bearer <CRON_SECRET>`）
   - `VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` / `VAPID_SUBJECT`（例: `mailto:you@example.com`）
   - `SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY`（CLI デプロイ時は自動設定される場合あり）
5. **定期実行**: 1 分毎程度で Edge Function を HTTP 起動する。遅延が大きいと通知がずれる（DB 側は約 7 分のウィンドウ）。
   - **GitHub Actions**（本リポジトリの `.github/workflows/send-trip-reminders.yml`）: リポジトリの **Settings → Secrets and variables → Actions** に次を設定する。
     - **`REMINDERS_CRON_SECRET`**（必須）: Supabase のシークレット `CRON_SECRET` と**同じ値**。
     - **`REMINDERS_FUNCTION_URL`**（任意）: 省略時は本番の `send-trip-reminders` URL を使う。別プロジェクトや Staging 向けに上書きできる。
   - スケジュールは **UTC**（`cron`）。GitHub の都合で**数分遅れる・稀に欠ける**ことがある。
   - リポジトリが**長期間非アクティブ**だと、GitHub がスケジュール済みワークフローを**自動無効化**することがある。通知が止まったら Actions の設定で再有効化を確認する。
   - **Private リポジトリ**で Actions の無料枠を使う場合、毎分実行は**分消費が大きい**のでプラン・上限に注意する。**Public リポジトリ**では標準ランナーの利用に追加課金がない。
   - その他の例: Supabase `pg_cron` + `pg_net`、外部 Cron サービスなど。
6. **プッシュ購読**と **`user_reminder_preferences.reminders_enabled`**（リマインダー全体 ON）を有効にする。一覧には設定 UI が無いため、開発時はコンソールや Supabase SQL / Dashboard で登録するか、別途 UI を足す。各予定の編集画面で開始／終了リマインダーを調整する。

## トラブルシューティング

### 「This page isn't working」「invalid response」「provider is not enabled」

**原因**: Supabase で Google プロバイダーが有効になっていません。

**対処**: Supabase Dashboard → Authentication → Providers → Google で、Enable
をオンにし、Google Cloud Console で取得した Client ID と Client Secret
を入力してください。
