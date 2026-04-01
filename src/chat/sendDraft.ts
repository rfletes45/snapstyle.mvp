import type { UseAttachmentPickerReturn } from "@/hooks/useAttachmentPicker";
import type { SendMessageOptions, UseChatReturn } from "@/hooks/useChat";
import type { UseChatComposerReturn } from "@/hooks/useChatComposer";
import type { VoiceRecording } from "@/hooks/useVoiceRecorder";
import type { LocalAttachment } from "@/types/messaging";
import { createLogger } from "@/utils/log";

const log = createLogger("chat/sendDraft");

type ChatSendTarget = Pick<UseChatReturn, "sendMessage" | "replyTo" | "clearReplyTo">;
type ChatComposerState = Pick<UseChatComposerReturn, "text" | "clearText" | "setText">;
type ChatAttachmentState = Pick<
  UseAttachmentPickerReturn,
  "attachments" | "clearAttachments" | "setAttachments"
>;

export interface SharedDraftOptionsFactoryContext {
  text: string;
  replyTo: UseChatReturn["replyTo"];
}

export interface SendChatDraftInput {
  currentUid?: string | null;
  conversationId?: string | null;
  isSending: boolean;
  chat: ChatSendTarget;
  composer: ChatComposerState;
  attachmentPicker: ChatAttachmentState;
  onBeforeSend?: () => void;
  onError?: (message: string) => void;
  buildTextOptions?: (
    context: SharedDraftOptionsFactoryContext,
  ) => Partial<SendMessageOptions>;
  buildAttachmentOptions?: (
    context: SharedDraftOptionsFactoryContext,
  ) => Partial<SendMessageOptions>;
}

function toMediaAttachment(attachment: LocalAttachment): NonNullable<
  SendMessageOptions["attachments"]
>[number] {
  return {
    id: attachment.id,
    uri: attachment.uri,
    kind: attachment.kind,
    mime: attachment.mime || "image/jpeg",
    durationMs: attachment.durationMs,
  };
}

export async function sendChatDraft({
  currentUid,
  conversationId,
  isSending,
  chat,
  composer,
  attachmentPicker,
  onBeforeSend,
  onError,
  buildTextOptions,
  buildAttachmentOptions,
}: SendChatDraftInput): Promise<{ success: boolean; error?: string }> {
  const text = composer.text.trim();
  const attachments = [...attachmentPicker.attachments];
  const hasText = text.length > 0;
  const hasAttachments = attachments.length > 0;

  if (!currentUid || !conversationId || isSending || (!hasText && !hasAttachments)) {
    return { success: false, error: "Nothing to send" };
  }

  const replyTo = chat.replyTo;
  const draftContext = { text, replyTo };
  let remainingAttachments = attachments;

  onBeforeSend?.();
  composer.clearText();

  if (!hasAttachments) {
    try {
      const result = await chat.sendMessage(text, {
        replyTo: replyTo || undefined,
        ...(buildTextOptions?.(draftContext) ?? {}),
      });

      if (!result.success) {
        composer.setText(text);
        onError?.(result.error || "Failed to send");
      }

      return result;
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to send";
      composer.setText(text);
      onError?.(message);
      return { success: false, error: message };
    }
  }

  chat.clearReplyTo();
  attachmentPicker.clearAttachments();

  try {
    for (const attachment of attachments) {
      const result = await chat.sendMessage("", {
        replyTo: replyTo || undefined,
        kind: "media",
        attachments: [toMediaAttachment(attachment)],
        ...(buildAttachmentOptions?.(draftContext) ?? {}),
      });

      if (!result.success) {
        throw new Error(result.error || "Failed to send attachment");
      }

      remainingAttachments = remainingAttachments.slice(1);
    }

    if (hasText) {
      const result = await chat.sendMessage(text, {
        replyTo: replyTo || undefined,
        ...(buildTextOptions?.(draftContext) ?? {}),
      });

      if (!result.success) {
        throw new Error(result.error || "Failed to send message");
      }
    }

    return { success: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to send";

    if (remainingAttachments.length > 0) {
      attachmentPicker.setAttachments(remainingAttachments);
    }
    if (hasText) {
      composer.setText(text);
    }

    onError?.(message);
    log.warn("sendChatDraft failed", {
      operation: "sendChatDraft",
      data: {
        conversationId,
        remainingAttachments: remainingAttachments.length,
        error: message,
      },
    });

    return { success: false, error: message };
  }
}

export async function sendVoiceRecordingMessage(input: {
  chat: Pick<UseChatReturn, "sendMessage">;
  currentUid?: string | null;
  recording: VoiceRecording;
}): Promise<{ success: boolean; error?: string }> {
  const { chat, currentUid, recording } = input;

  if (!currentUid) {
    return { success: false, error: "Missing current user" };
  }

  return chat.sendMessage("", {
    kind: "voice",
    attachments: [
      {
        id: `voice_${Date.now()}_${currentUid}`,
        uri: recording.uri,
        kind: "audio",
        mime: "audio/m4a",
        durationMs: recording.durationMs,
      },
    ],
  });
}

export async function sendMediaAttachmentMessage(input: {
  chat: Pick<UseChatReturn, "sendMessage">;
  attachment: LocalAttachment;
}): Promise<{ success: boolean; error?: string }> {
  const { chat, attachment } = input;

  return chat.sendMessage("", {
    kind: "media",
    attachments: [toMediaAttachment(attachment)],
  });
}

export async function sendAnimalSignalMessage(input: {
  chat: Pick<UseChatReturn, "sendMessage">;
  animalId?: string | null;
}): Promise<{ success: boolean; error?: string }> {
  const { chat, animalId } = input;

  if (!animalId) {
    return { success: false, error: "Missing animal" };
  }

  return chat.sendMessage("", {
    kind: "animal",
    animalId,
  });
}
