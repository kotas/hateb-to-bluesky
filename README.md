# Hateb to Bluesky

[はてなブックマーク](https://b.hatena.ne.jp/) でブックマークした記事を、自動で [Bluesky](https://bsky.app/) に投稿する [Cloudflare Worker](https://www.cloudflare.com/ja-jp/developer-platform/workers/) です。

- すべて無料で利用できます。
- デフォルトで 15 分ごとにブックマークをチェックし、新着のものを自動投稿します。
- Bluesky に投稿済みのブックマークかどうか Cloudflare KV に記録します。
- ページの OGP 情報や画像を取得し、自動的にカードとして添付します。

![Screenshot](./screenshot.png)

## 使い方

前提: Cloudflare と GitHub のアカウントが必要です。

[![Deploy to Cloudflare Workers](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/kotas/hateb-to-bluesky)

1. 上の [Deploy with Workers] ボタンを押します。

2. Cloudflare のページに移動するので、GitHub での認証やアカウント設定を進めて GitHub 上でフォークします。（GitHub Actions で Cloudflare に自動デプロイされます）

3. [Cloudflare Dashboard](https://dash.cloudflare.com/) を開き、左側の `Workers & Pages` → `hateb-to-bluesky-production` → `Settings` → `Variables` を開きます。

4. `Environment Variables` の `Edit variables` ボタン → `+ Add variable` ボタンから、下記の環境変数 3 つを作成して、 **それぞれの右側にある [Encrypt] ボタンを押してから**、`Save and deploy` します。

    | Variable name | Value 設定内容 |
    | ------------- | ------------- |
    | `HATENA_ID` | はてな ID `id:kotas` の場合は `kotas` を入力 |
    | `BLUESKY_IDENTIFIER` | Bluesky ID `@ksaito.bsky.social` の場合は `ksaito.bsky.social` を入力 |
    | `BLUESKY_PASSWORD` | Bluesky のパスワードを入力 |

   3 つそれぞれで `Encrypt` を押さないと、次回デプロイ時に消えてしまうため注意してください。

5. 上部の Preview URL (`*.workers.dev`) にアクセスすると、正しく設定できていれば下記のような情報が表示されます。
    ```
    hateb-to-bluesky v1.0.0
    Hateb:   https://b.hatena.ne.jp/kotas
    Bluesky: https://bsky.app/profile/kotas.jp
    ```

6. 以上で完了です。デフォルトでは 15 分おきに, はてブの新着をチェックして Bluesky へ投稿するようになっています（初回実行時は何もしません）。更新間隔など設定を変えたい場合は、`wrangler.toml` を編集してください。
