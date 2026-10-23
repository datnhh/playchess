import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { audioHash } from './hash.ts';
import { parseDotEnv } from './env.ts';
import { planGeneration } from './plan.ts';
import { applyPronunciation, buildSsml, escapeXml } from './ssml.ts';

describe('audioHash', () => {
  it('follows the contract: first 16 hex chars of sha256(provider|voice|rate|spoken text)', () => {
    const expected = createHash('sha256')
      .update('azure|vi-VN-HoaiMyNeural|-10%|Giỏi quá!')
      .digest('hex')
      .slice(0, 16);
    expect(audioHash('Giỏi quá!')).toBe(expected);
    expect(audioHash('Giỏi quá!')).toMatch(/^[0-9a-f]{16}$/);
    expect(audioHash('Giỏi quá')).not.toBe(expected);
  });

  it('changes with the provider', () => {
    expect(audioHash('Giỏi quá!', 'piper')).not.toBe(audioHash('Giỏi quá!', 'azure'));
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

describe('parseDotEnv', () => {
  it('parses simple KEY=value lines', () => {
    expect(parseDotEnv('# c\nA=1\nB = "two"\n\nbad\n')).toEqual({ A: '1', B: 'two' });
  });
});
