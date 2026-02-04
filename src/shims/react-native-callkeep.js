/**
 * react-native-callkeep shim for web
 *
 * This module provides stub exports for react-native-callkeep
 * to prevent bundler errors on web platform.
 */

const RNCallKeep = {
  setup: () => Promise.resolve(),
  hasDefaultPhoneAccount: () => Promise.resolve(false),
  displayIncomingCall: () => {},
  answerIncomingCall: () => {},
  rejectCall: () => {},
  endCall: () => {},
  endAllCalls: () => {},
  reportEndCallWithUUID: () => {},
  setMutedCall: () => {},
  setOnHold: () => {},
  checkIfBusy: () => Promise.resolve(false),
  checkSpeaker: () => Promise.resolve(false),
  setAvailable: () => {},
  setCurrentCallActive: () => {},
  backToForeground: () => {},
  addEventListener: () => ({ remove: () => {} }),
  removeEventListener: () => {},
  supportConnectionService: () => Promise.resolve(false),
  hasPhoneAccount: () => Promise.resolve(false),
  hasOutgoingCall: () => Promise.resolve(false),
  getInitialEvents: () => Promise.resolve([]),
  clearInitialEvents: () => {},
};

export default RNCallKeep;
