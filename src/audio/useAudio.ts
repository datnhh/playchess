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

let unlockRequested = false;

/**
 * Unlocks sound from a tap that opens a lesson, so the lesson can start without its ▶ screen.
 * Must run synchronously inside the tap (iOS rule).
 */
export function unlockAudio(): void {
  unlockRequested = true;
  void getAudioController().unlock();
}

/**
 * True when sound is unlocked or being unlocked by the tap that opened the page: only then may a
 * lesson start by itself. A lesson opened from a link or a reload keeps its ▶ screen, which
 * unlocks sound. (navigator.userActivation is not used: automation browsers report it as set.)
 */
export function canStartWithSound(): boolean {
  return unlockRequested || getAudioController().getState().unlocked;
}

export function useAudioState(controller: AudioController = getAudioController()): AudioState {
  return useSyncExternalStore(controller.subscribe, controller.getState, controller.getState);
}
