import { describe, expect, it } from 'vitest';
import { filterContent } from './lessonsPlugin.ts';

const entry = (file: string) => ({ file, hash: file, text: file });

describe('filterContent', () => {
  const lessons = [
    { id: 'basic-a', reviewed: true },
    { id: 'basic-b', reviewed: false },
    { id: 'basic-c' },
  ];
  const manifest = {
    'common/praise-1': entry('c.mp3'),
    'basic-a/s1/say': entry('a.mp3'),
    'basic-b/s1/say': entry('b.mp3'),
    'basic-ab/s1/say': entry('ab.mp3'),
  };

  it('keeps only reviewed lessons and their audio plus common clips', () => {
    const result = filterContent(lessons, manifest, false);
    expect(result.lessons).toEqual([{ id: 'basic-a', reviewed: true }]);
    expect(Object.keys(result.manifest).sort()).toEqual(['basic-a/s1/say', 'common/praise-1']);
  });

  it('keeps everything when drafts are included', () => {
    const result = filterContent(lessons, manifest, true);
    expect(result.lessons).toHaveLength(3);
    expect(Object.keys(result.manifest)).toHaveLength(3); // basic-ab is not a lesson
  });
});
