import { describe, expect, it } from 'vitest';
import { filterContent } from './lessonsPlugin.ts';

const entry = (file: string) => ({ file, hash: file, text: file });

describe('filterContent', () => {
  const lessons = [
    { id: 'sprout-a', reviewed: true },
    { id: 'sprout-b', reviewed: false },
    { id: 'sprout-c' },
  ];
  const manifest = {
    'common/praise-1': entry('c.mp3'),
    'sprout-a/s1/say': entry('a.mp3'),
    'sprout-b/s1/say': entry('b.mp3'),
    'sprout-ab/s1/say': entry('ab.mp3'),
  };

  it('keeps only reviewed lessons and their audio plus common clips', () => {
    const result = filterContent(lessons, manifest, false);
    expect(result.lessons).toEqual([{ id: 'sprout-a', reviewed: true }]);
    expect(Object.keys(result.manifest).sort()).toEqual(['common/praise-1', 'sprout-a/s1/say']);
  });

  it('keeps everything when drafts are included', () => {
    const result = filterContent(lessons, manifest, true);
    expect(result.lessons).toHaveLength(3);
    expect(Object.keys(result.manifest)).toHaveLength(3); // sprout-ab is not a lesson
  });
});
