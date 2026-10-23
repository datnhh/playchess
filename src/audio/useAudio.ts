import { useSyncExternalStore } from 'react';
import { loadSettings } from '../services/storage.ts';
import { createAudioController } from './audioController.ts';
import type { AudioController, AudioState } from './types.ts';

let singleton: AudioController | null = null;

/**
 * One controller per app session: the unlocked state must survive page changes.
 * Starts muted when a parent muted the site earlier (saved in settings).
 */
export function getAudioController(): AudioController {
  if (!singleton) {
    singleton = createAudioController();
    if (loadSettings().muted) singleton.setMuted(true);
  }
  return singleton;
}

export function useAudioState(controller: AudioController = getAudioController()): AudioState {
  return useSyncExternalStore(controller.subscribe, controller.getState, controller.getState);
}
