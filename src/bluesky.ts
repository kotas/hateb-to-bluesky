import { BskyAgent, RichText } from '@atproto/api';

export async function buildBlueskyAgent(identifier: string, password: string): Promise<BskyAgent> {
  const agent = new BskyAgent({
    service: 'https://bsky.social',
  });
  await agent.login({
    identifier,
    password,
  });
  return agent;
}

export async function postTextToBluesky(agent: BskyAgent, text: string): Promise<void> {
  const richText = new RichText({ text });
  await richText.detectFacets(agent);
  await agent.post({
    $type: 'app.bsky.feed.post',
    text: richText.text,
    facets: richText.facets,
    createdAt: new Date().toISOString(),
  });
}
