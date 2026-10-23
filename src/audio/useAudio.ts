import { useSyncExternalStore } from 'react';
import { createAudioController } from './audioController.ts';
import type { AudioController, AudioState } from './types.ts';

let singleton: AudioController | null = null;

/** One controller per app session: the unlocked state must survive page changes. */
export function getAudioController(): AudioController {
  singleton ??= createAudioController();
  return singleton;
}

export function useAudioState(controller: AudioController = getAudioController()): AudioState {
  return useSyncExternalStore(controller.subscribe, controller.getState, controller.getState);
}
