import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import path from 'node:path';
import { TTS_VOICES, voiceSettings } from './config.ts';
import { audioHash } from './hash.ts';
import { checkPiperModel, resolveTool, SetupError } from './providers.ts';
import { DOWNLOADS, verify } from './setup.ts';
import { parseDotEnv } from './env.ts';
import { planGeneration } from './plan.ts';
import { applyPronunciation, buildSsml, escapeXml } from './ssml.ts';

describe('audioHash', () => {
  it('follows the contract: first 16 hex chars of sha256(provider|voice|rate|spoken text)', () => {
    const expected = createHash('sha256')
      .update('piper|vi_VN-vais1000-medium|ls=1.25,ss=0.5|Giỏi quá!')
      .digest('hex')
      .slice(0, 16);
    expect(audioHash('Giỏi quá!')).toBe(expected);
    expect(audioHash('Giỏi quá!')).toMatch(/^[0-9a-f]{16}$/);
    expect(audioHash('Giỏi quá')).not.toBe(expected);
    const azure = createHash('sha256')
      .update('azure|vi-VN-HoaiMyNeural|-10%|Giỏi quá!')
      .digest('hex')
      .slice(0, 16);
    expect(audioHash('Giỏi quá!', 'azure')).toBe(azure);
  });

  it('changes with the provider, the Piper model and every speed setting', () => {
    const base = audioHash('Giỏi quá!', 'piper');
    expect(audioHash('Giỏi quá!', 'azure')).not.toBe(base);
    expect(voiceSettings('piper')).toEqual({
      voice: TTS_VOICES.piper.model,
      rate: 'ls=1.25,ss=0.5',
    });
    expect(audioHash('Giỏi quá!', 'piper', 'vi_VN-other-medium')).not.toBe(base);
    expect(audioHash('Giỏi quá!', 'piper', undefined, 'ls=1.4,ss=0.5')).not.toBe(base);
    expect(audioHash('Giỏi quá!', 'piper', undefined, 'ls=1.25,ss=0.4')).not.toBe(base);
  });
});

describe('SSML', () => {
  it('escapes XML special characters', () => {
    expect(escapeXml(`a<b>&"c'`)).toBe('a&lt;b&gt;&amp;&quot;c&apos;');
    const ssml = buildSsml('Xe & Mã <3', []);
    expect(ssml).toContain('Xe &amp; Mã &lt;3');
    expect(ssml).toContain('<voice name="vi-VN-HoaiMyNeural"><prosody rate="-10%">');
    expect(ssml).toContain('xml:lang="vi-VN"');
  });

  it('applies glossary pronunciation overrides as whole words', () => {
    const glossary = [{ term: 'Mã', meaning: 'knight', say: 'Mả' }];
    expect(buildSsml('Quân Mã nhảy. Mãi.', glossary)).toContain(
      'Quân <sub alias="Mả">Mã</sub> nhảy. Mãi.',
    );
    expect(applyPronunciation('mã đi', glossary)).toBe('Mả đi');
  });
});

describe('planGeneration', () => {
  const items = [
    { key: 'a/s/say', text: 'Một' },
    { key: 'b/s/say', text: 'Hai' },
    { key: 'c/s/say', text: 'Một' },
  ];

  it('creates one job per distinct text and skips existing files', () => {
    const existing = `${audioHash('Hai')}.mp3`;
    const plan = planGeneration(
      items,
      { 'old/s/say': { file: 'zzz.mp3', hash: 'zzz', text: 'Cũ' } },
      new Set([existing, 'zzz.mp3']),
    );
    expect(plan.jobs).toHaveLength(1);
    expect(plan.jobs[0]?.keys).toEqual(['a/s/say', 'c/s/say']);
    expect(plan.upToDate).toBe(1);
    expect(plan.removedKeys).toEqual(['old/s/say']);
    expect(plan.orphanFiles).toEqual(['zzz.mp3']);
    expect(Object.keys(plan.manifest)).toEqual(['a/s/say', 'b/s/say', 'c/s/say']);
    expect(plan.manifest['b/s/say']).toEqual({
      file: existing,
      hash: audioHash('Hai'),
      text: 'Hai',
    });
  });

  it('regenerates when the text changed', () => {
    const oldHash = audioHash('Cũ');
    const plan = planGeneration(
      [{ key: 'a/s/say', text: 'Mới' }],
      { 'a/s/say': { file: `${oldHash}.mp3`, hash: oldHash, text: 'Cũ' } },
      new Set([`${oldHash}.mp3`]),
    );
    expect(plan.jobs.map((job) => job.text)).toEqual(['Mới']);
    expect(plan.orphanFiles).toEqual([`${oldHash}.mp3`]);
  });
});

describe('partial plan (--only)', () => {
  it('keeps the entries of other lessons and reports nothing as removed or orphaned', () => {
    const other = { file: 'other.mp3', hash: 'other', text: 'Khác' };
    const plan = planGeneration(
      [{ key: 'a/s/say', text: 'Một' }],
      { 'b/s/say': other },
      new Set(['other.mp3']),
      'piper',
      { partial: true },
    );
    expect(plan.manifest['b/s/say']).toEqual(other);
    expect(Object.keys(plan.manifest).sort()).toEqual(['a/s/say', 'b/s/say']);
    expect(plan.removedKeys).toEqual([]);
    expect(plan.orphanFiles).toEqual([]);
    expect(plan.jobs).toHaveLength(1);
  });
});

describe('tool paths', () => {
  it('prefers the environment, then .tools/, then the command on PATH', () => {
    expect(resolveTool('rel/ffmpeg.exe', '/t/ffmpeg.exe', 'ffmpeg', () => true)).toBe(
      path.resolve('rel/ffmpeg.exe'),
    );
    expect(resolveTool(undefined, '/t/ffmpeg.exe', 'ffmpeg', () => true)).toBe('/t/ffmpeg.exe');
    expect(resolveTool(undefined, '/t/ffmpeg.exe', 'ffmpeg', () => false)).toBe('ffmpeg');
  });

  it('rejects a Piper model that does not match the configured one or lacks its config', () => {
    const good = `/v/${TTS_VOICES.piper.model}.onnx`;
    expect(() => checkPiperModel('/v/vi_VN-vivos-x_low.onnx', () => true)).toThrow(SetupError);
    expect(() => checkPiperModel(good, (file) => !file.endsWith('.json'))).toThrow(/.json/);
    expect(() => checkPiperModel(good, () => true)).not.toThrow();
  });
});

describe('parseDotEnv', () => {
  it('parses simple KEY=value lines', () => {
    expect(parseDotEnv('# c\nA=1\nB = "two"\n\nbad\n')).toEqual({ A: '1', B: 'two' });
  });
});

describe('tts:setup downloads', () => {
  it('pins every file by size and rejects a mismatch', () => {
    for (const item of DOWNLOADS) expect(item.size).toBeGreaterThan(0);
    const model = DOWNLOADS.find((item) => item.file.endsWith('.onnx'))!;
    expect(() => verify(model, model.size, model.sha256!)).not.toThrow();
    expect(() => verify(model, model.size - 1, model.sha256!)).toThrow(/dung lượng/);
    expect(() => verify(model, model.size, '0'.repeat(64))).toThrow(/sha256/);
  });
});
