# MAGIシステム デプロイガイド

このプロジェクトは、OpenAI APIキーを安全に管理するために [Vercel](https://vercel.com) 上にデプロイするように構成されています。

## 前提条件

1.  Vercelアカウント
2.  OpenAI APIキー
3.  Vercel CLI（任意ですが、ローカルテストに推奨されます）

## デプロイ手順

1.  **GitHub/GitLab/Bitbucketへのプッシュ**:
    *   このリポジトリをお好みのGitプロバイダーにプッシュしてください。

2.  **Vercelでのプロジェクトインポート**:
    *   Vercelのダッシュボードにアクセスします。
    *   "Add New..." -> "Project" をクリックします。
    *   先ほどプッシュしたリポジトリをインポートします。

3.  **環境変数の設定**:
    *   "Configure Project" のステップで、"Environment Variables" セクションを見つけます。
    *   新しい変数を追加します:
        *   **Key**: `OPENAI_API_KEY`
        *   **Value**: `sk-...` で始まるあなたのOpenAI APIキー

4.  **デプロイ**:
    *   "Deploy" をクリックします。
    *   Vercelがプロジェクトをビルドし、URL（例: `magi-system.vercel.app`）を割り当てます。

## ローカル開発

サーバーレス関数を含めてローカルでプロジェクトを実行するには:

1.  Vercel CLIのインストール: `npm i -g vercel`
2.  ログイン: `vercel login`
3.  プロジェクトのリンク: `vercel link`
4.  環境変数の取得: `vercel env pull`
5.  ローカルサーバーの起動: `vercel dev`

アプリケーションは `http://localhost:3000` で利用可能になります。
