/**
 * Profile Picture Components Index
 *
 * Export all profile picture related components.
 *
 * @module components/profile/ProfilePicture
 */

// Core components
export { ProfilePicture } from "./ProfilePicture";
export type { ProfilePictureProps } from "./ProfilePicture";

export {
  DECORATION_SCALE,
  ProfilePictureWithDecoration,
} from "./ProfilePictureWithDecoration";
export type { ProfilePictureWithDecorationProps } from "./ProfilePictureWithDecoration";

export { InitialsAvatar } from "./InitialsAvatar";
export type { InitialsAvatarProps } from "./InitialsAvatar";

// Decoration components
export { DecorationOverlay } from "./DecorationOverlay";
export type { DecorationOverlayProps } from "./DecorationOverlay";

export { DecorationPicker } from "./DecorationPicker";
export type { DecorationPickerProps } from "./DecorationPicker";

export { DecorationPickerModal } from "./DecorationPickerModal";
export type { DecorationPickerModalProps } from "./DecorationPickerModal";

// Editor components
export { ProfilePictureEditor } from "./ProfilePictureEditor";
export type { ProfilePictureEditorProps } from "./ProfilePictureEditor";
