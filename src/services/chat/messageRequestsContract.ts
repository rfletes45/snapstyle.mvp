import {
  decodeMessageRequest,
  isMessageRequestResponse,
  MessageRequest,
} from "@/types/messaging";

interface MessageRequestDocLike {
  id: string;
  data: unknown;
}

export function normalizePendingMessageRequests(
  docs: MessageRequestDocLike[],
): MessageRequest[] {
  return docs
    .map((docLike) => decodeMessageRequest(docLike.data, docLike.id))
    .filter((item): item is MessageRequest => item !== null)
    .filter((item) => item.status === "pending")
    .sort((a, b) => b.createdAt - a.createdAt);
}

export async function callAcceptMessageRequest(
  chatId: string,
  invoke: (
    payload: { chatId: string },
  ) => Promise<{ data: unknown }>,
): Promise<void> {
  const response = await invoke({ chatId });
  if (!isMessageRequestResponse(response.data) || !response.data.success) {
    throw new Error("acceptMessageRequest returned an invalid response");
  }
}

export async function callDeclineMessageRequest(
  chatId: string,
  blockRequester: boolean,
  invoke: (
    payload: { chatId: string; blockRequester: boolean },
  ) => Promise<{ data: unknown }>,
): Promise<void> {
  const response = await invoke({ chatId, blockRequester });
  if (!isMessageRequestResponse(response.data) || !response.data.success) {
    throw new Error("declineMessageRequest returned an invalid response");
  }
}
