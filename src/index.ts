/**
 * Hateb to Bluesky
 *
 * @copyright (c) 2024 Kota SAITO <kotas.nico@gmail.com>
 * @license MIT
 */

import { extract, FeedEntry } from '@extractus/feed-extractor';
import { buildBlueskyAgent, postTextToBluesky } from './bluesky';
import { isPostedEntryId, putPostedEntryId, flushOldEntryIds } from './kv';
import { version } from '../package.json';

export interface Env {
  KV: KVNamespace;
  HATENA_ID: string;
  BLUESKY_IDENTIFIER: string;
  BLUESKY_PASSWORD: string;
  TEXT_TEMPLATE: string;
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);
    if (request.method === 'GET' && url.pathname === '/') {
      try {
        const banner = getBanner(env);
        // ログインできる事を確認する
        await buildBlueskyAgent(env.BLUESKY_IDENTIFIER, env.BLUESKY_PASSWORD);
        return new Response(banner, { status: 200 });
      } catch (e) {
        return new Response(String(e), { status: 500 });
      }
    } else {
      return new Response('Not found', { status: 404 });
    }
  },

  async scheduled(event: ScheduledEvent, env: Env, ctx: ExecutionContext): Promise<void> {
    try {
      console.log(getBanner(env));
      await runHatebToBluesky(env);
    } catch (e) {
      console.error(String(e));
    }
  },
};

function getBanner(env: Env): string {
  if (!env.HATENA_ID || !env.BLUESKY_IDENTIFIER || !env.BLUESKY_PASSWORD || !env.TEXT_TEMPLATE) {
    throw new Error('Environment variables are not configured!');
  }

  return `hateb-to-bluesky v${version}
Hateb:   https://b.hatena.ne.jp/${env.HATENA_ID}
Bluesky: https://bsky.app/profile/${env.BLUESKY_IDENTIFIER}
`;
}

async function runHatebToBluesky(env: Env) {
  // はてブのフィード取得
  const hatebFeedUrl = `https://b.hatena.ne.jp/${env.HATENA_ID}/bookmark.rss`;
  const hatebFeed = await extract(hatebFeedUrl);
  if (!hatebFeed || !hatebFeed.entries) {
    throw new Error(`Failed to fetch Hateb feed: ${hatebFeedUrl}`);
  }
  if (hatebFeed.entries.length === 0) {
    throw new Error(`No bookmark entries in Hateb feed: ${hatebFeedUrl}`);
  }

  // published 昇順でソート
  const entries = [...hatebFeed.entries]
    .sort((a, b) => (a.published?.getTime?.() ?? 0) - (b.published?.getTime?.() ?? 0));

  // まだ Bluesky に投稿されていない ID のエントリを抜き出す
  const postingEntries = (await Promise.all(
    entries.map(async (et) => await isPostedEntryId(env.KV, et.id) ? null : et)
  )).filter((et: FeedEntry | null): et is FeedEntry => et !== null);

  if (postingEntries.length === entries.length) {
    // フィード内の全エントリが投稿対象の場合は初回実行なのでスキップする
    console.info(`Skipped posting ${postingEntries.length} entries, since it seems the first run.`);

    for (const entry of postingEntries) {
      // すべて投稿済み扱いとしてマークする
      await putPostedEntryId(env.KV, entry.id);
    }
  } else if (postingEntries.length > 0) {
    // 投稿対象が存在するので Bluesky にそれぞれ投稿
    console.info(`Posting ${postingEntries.length} bookmark entries to Bluesky...\n`);
    console.info('-------');

    const agent = await buildBlueskyAgent(env.BLUESKY_IDENTIFIER, env.BLUESKY_PASSWORD);
    for (const entry of postingEntries) {
      const text = renderText(env.TEXT_TEMPLATE, entry);
      console.info(text);
      console.info('-------');
      await postTextToBluesky(agent, text);
      await putPostedEntryId(env.KV, entry.id);
    }

    console.info(`\nAll posted successfully!`);
  } else {
    console.info(`No new bookmark entries found.`);
  }

  // 古いキーを KV から削除する
  console.info(`Flushing old entry IDs from KV...`);
  const currentEntryIds = entries.map(e => e.id);
  await flushOldEntryIds(env.KV, currentEntryIds);
}

function renderText(template: string, entry: FeedEntry): string {
  const dict: Record<string, string> = {
    title: entry.title ?? '',
    link: entry.link ?? '',
    description: entry.description ?? '',
  };

  return template
    .replaceAll(/(%%)|%(\w+)%/g, (_, escaped, varName) => escaped ? '%' : dict[varName] ?? '')
    .trim();
}
