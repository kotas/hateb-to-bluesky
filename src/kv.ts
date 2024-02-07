const PREFIX = 'entry:';

export async function isPostedEntryId(kv: KVNamespace, entryId: string): Promise<boolean> {
  return await kv.get(PREFIX + entryId) === 't';
}

export async function putPostedEntryId(kv: KVNamespace, entryId: string): Promise<void> {
  await kv.put(PREFIX + entryId, 't');
}

export async function flushOldEntryIds(kv: KVNamespace, currentEntryIds: string[]): Promise<void> {
  const keepingKeySet = new Set(currentEntryIds.map(id => PREFIX + id));

  let cursor: string | undefined;
  while (true) {
    const listed = await kv.list({ prefix: PREFIX, cursor });
    for (const key of listed.keys) {
      if (!keepingKeySet.has(key.name)) {
        await kv.delete(key.name);
      }
    }
    if (listed.list_complete) {
      break;
    } else {
      cursor = listed.cursor;
    }
  }
}
