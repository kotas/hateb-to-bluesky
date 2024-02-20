/**
 * Hateb to Bluesky
 *
 * @copyright (c) 2024 Kota SAITO <kotas.nico@gmail.com>
 * @license MIT
 */

import { BlueskyCard, BlueskyClient } from './bluesky';
import { EntryKV } from './kv';
import { extractOgSummaryFromUrl } from './og';
import { version } from '../package.json';
import { HatebEntry, extractEntriesFromHatebFeed } from './hateb';

export interface Env {
  KV: KVNamespace;
  HATENA_ID: string;
  BLUESKY_IDENTIFIER: string;
  BLUESKY_PASSWORD: string;
  TEXT_TEMPLATE: string;
  ENABLE_OG?: 'true' | 'false';
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);
    if (request.method === 'GET' && url.pathname === '/') {
      try {
        const banner = getBanner(env);
        BlueskyClient.ensureLogin(env.BLUESKY_IDENTIFIER, env.BLUESKY_PASSWORD);
        return new Response(banner, { status: 200 });
      } catch (e) {
        console.error(e);
        return new Response(String(e), { status: 500 });
      }
    } else {
      return new Response('Not found', { status: 404 });
    }
  },

  async scheduled(event: ScheduledEvent, env: Env, ctx: ExecutionContext): Promise<void> {
    console.log(getBanner(env));
    await runHatebToBluesky(env);
  },
};

function getBanner(env: Env): string {
  if (!env.HATENA_ID || !env.BLUESKY_IDENTIFIER || !env.BLUESKY_PASSWORD || !env.TEXT_TEMPLATE) {
    throw new Error('Environment variables are not configured!');
  }
  if (!env.KV) {
    throw new Error('KV binding is not set!');
  }

  return `hateb-to-bluesky v${version}
Hateb:   https://b.hatena.ne.jp/${env.HATENA_ID}
Bluesky: https://bsky.app/profile/${env.BLUESKY_IDENTIFIER}
`;
}

async function runHatebToBluesky(env: Env) {
  const kv = new EntryKV(env.KV);

  // はてブのフィード取得
  const entries = (await extractEntriesFromHatebFeed(env.HATENA_ID))
    .sort((a, b) => (a.published.getTime?.() ?? 0) - (b.published.getTime?.() ?? 0));

  // まだ Bluesky に投稿されていない ID のエントリを抜き出す
  const postingEntries = (await Promise.all(
    entries.map(async (et) => await kv.isPostedEntryId(et.id) ? null : et)
  )).filter((et: HatebEntry | null): et is HatebEntry => et !== null);

  if (postingEntries.length === entries.length) {
    // フィード内の全エントリが投稿対象の場合は初回実行なのでスキップする
    console.info(`Skipped posting ${postingEntries.length} entries, since it seems the first run.`);

    for (const entry of postingEntries) {
      // すべて投稿済み扱いとしてマークする
      await kv.putPostedEntryId(entry.id);
    }
  } else if (postingEntries.length > 0) {
    // 投稿対象が存在するので Bluesky にそれぞれ投稿
    console.info(`Posting ${postingEntries.length} bookmark entries to Bluesky...\n`);
    console.info('-------');

    const client = new BlueskyClient(env.BLUESKY_IDENTIFIER, env.BLUESKY_PASSWORD);
    await client.login();

    for (const entry of postingEntries) {
      // 投稿内容をテンプレートから作成
      const body = renderText(env.TEXT_TEMPLATE, entry);
      console.info(body);

      // OG カードが有効になっている場合は OG 情報取得
      let card: BlueskyCard | undefined;
      if (env.ENABLE_OG === 'true' && entry.link) {
        const ogSummary = await extractOgSummaryFromUrl(entry.link);
        if (ogSummary) {
          card = {
            link: entry.link,
            title: ogSummary.title,
            description: ogSummary.description,
          };

          if (ogSummary.image) {
            // OG 画像がある場合は Bluesky にアップロードして添付
            card.image = await client.uploadImage(ogSummary.image);
          }
        }
      }

      // Bluesky に投稿
      await client.post({ body, card });

      // 投稿済みとしてマーク
      await kv.putPostedEntryId(entry.id);

      console.info('-------');
    }

    console.info(`\nAll posted successfully!`);
  } else {
    // 新しい投稿対象がなかった
    console.info(`No new bookmark entries found.`);
  }

  // 古いキーを KV から削除する
  console.info(`Flushing old entry IDs from KV...`);
  const currentEntryIds = entries.map(e => e.id);
  await kv.flushOldEntryIds(currentEntryIds);
}

function renderText(template: string, entry: HatebEntry): string {
  const dict: Record<string, string> = {
    title: entry.title ?? '',
    link: entry.link ?? '',
    description: entry.comment ?? '',
  };

  return template
    .replaceAll(/(%%)|%(\w+)%/g, (_, escaped, varName) => escaped ? '%' : dict[varName] ?? '')
    .trim();
}
