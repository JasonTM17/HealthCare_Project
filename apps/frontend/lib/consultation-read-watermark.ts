interface ReadWatermarkMessage {
  id: string;
  authorUserId: string;
}

interface ReadWatermarkPage<TMessage extends ReadWatermarkMessage> {
  items: TMessage[];
  nextCursor: string | null;
  hasMore: boolean;
}

export interface ConsultationServerSnapshot<TMessage extends ReadWatermarkMessage> {
  messages: TMessage[];
  nextCursor: string | null;
  hasMore: boolean;
  complete: boolean;
  stalled: boolean;
  readWatermark: string | null;
}

function mergeUniqueMessages<TMessage extends ReadWatermarkMessage>(
  currentMessages: readonly TMessage[],
  nextMessages: readonly TMessage[],
): TMessage[] {
  const seen = new Set(currentMessages.map((message) => message.id));
  const merged = [...currentMessages];
  for (const message of nextMessages) {
    if (seen.has(message.id)) continue;
    seen.add(message.id);
    merged.push(message);
  }
  return merged;
}

function latestRemoteMessageId<TMessage extends ReadWatermarkMessage>(
  messages: readonly TMessage[],
  viewerUserId: string,
): string | null {
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const message = messages[index];
    if (message.authorUserId !== viewerUserId) return message.id;
  }
  return null;
}

/**
 * Reconciles only pages returned by the server. Locally appended messages must
 * never be passed as currentMessages because they are not an authoritative
 * read watermark. A cursor that claims more data but does not advance is
 * treated as incomplete so the caller cannot acknowledge an unseen tail.
 */
export function reconcileConsultationServerPage<TMessage extends ReadWatermarkMessage>(
  currentMessages: readonly TMessage[],
  page: ReadWatermarkPage<TMessage>,
  viewerUserId: string,
  requestedCursor: string | null,
): ConsultationServerSnapshot<TMessage> {
  const messages = mergeUniqueMessages(currentMessages, page.items);
  const stalled = page.hasMore
    && (!page.nextCursor || (requestedCursor !== null && page.nextCursor === requestedCursor));
  const complete = !page.hasMore && !stalled;

  return {
    messages,
    nextCursor: page.nextCursor,
    hasMore: page.hasMore,
    complete,
    stalled,
    readWatermark: complete ? latestRemoteMessageId(messages, viewerUserId) : null,
  };
}
