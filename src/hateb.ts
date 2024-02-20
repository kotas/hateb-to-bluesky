import { decode } from 'html-entities';
import { extract, FeedEntry } from '@extractus/feed-extractor';

export interface HatebEntry {
  id: string;
  title: string;
  link: string;
  comment: string;
  published: Date;
}

type FeedEntryWithComment = FeedEntry & { comment: string };

export async function extractEntriesFromHatebFeed(hatenaId: string) {
  const hatebFeedUrl = `https://b.hatena.ne.jp/${hatenaId}/bookmark.rss`;
  const hatebFeed = await extract(hatebFeedUrl, {
    getExtraEntryFields(entryData) {
      return {
        comment: decode((entryData as { description: string }).description),
      };
    },
  });
  if (!hatebFeed || !hatebFeed.entries) {
    throw new Error(`Failed to fetch Hateb feed: ${hatebFeedUrl}`);
  }
  if (hatebFeed.entries.length === 0) {
    throw new Error(`No bookmark entries in Hateb feed: ${hatebFeedUrl}`);
  }

  return hatebFeed.entries
    .filter((entry) => entry.link && entry.published)
    .map(
      (entry): HatebEntry => ({
        id: entry.id,
        title: entry.title ?? 'No title',
        link: entry.link!,
        comment: (entry as FeedEntryWithComment).comment,
        published: entry.published!,
      }),
    );
}
