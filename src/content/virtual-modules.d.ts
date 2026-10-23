// Virtual modules provided by tools/vite/lessonsPlugin.ts.

declare module 'virtual:lessons' {
  /** Raw lesson JSON (reviewed only in production builds); parse with lessonSchema. */
  const lessons: readonly unknown[];
  export default lessons;
}

declare module 'virtual:audio-manifest' {
  /**
   * content/audio/manifest.json filtered to the included lessons and common clips.
   * Same shape as AudioManifest in ./audio.ts (ambient modules cannot import relative paths).
   */
  const manifest: Readonly<Record<string, { file: string; hash: string; text: string }>>;
  export default manifest;
}
