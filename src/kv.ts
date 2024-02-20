const PREFIX = 'entry:';

export class EntryKV {
  constructor(private kv: KVNamespace) {}

  async isPostedEntryId(entryId: string): Promise<boolean> {
    return (await this.kv.get(PREFIX + entryId)) === 't';
  }

  async putPostedEntryId(entryId: string): Promise<void> {
    await this.kv.put(PREFIX + entryId, 't');
  }

  async flushOldEntryIds(currentEntryIds: string[]): Promise<void> {
    const keepingKeySet = new Set(currentEntryIds.map((id) => PREFIX + id));

    let cursor: string | undefined;
    while (true) {
      const listed = await this.kv.list({ prefix: PREFIX, cursor });
      await Promise.all(listed.keys.filter((key) => !keepingKeySet.has(key.name)).map((key) => this.kv.delete(key.name)));

      if (listed.list_complete) {
        break;
      } else {
        cursor = listed.cursor;
      }
    }
  }
}
