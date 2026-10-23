export interface LessonPageProps {
  lessonId: string;
}

/** Placeholder: plays one lesson and saves its stars (wave 2, branch 10). */
export function LessonPage({ lessonId }: LessonPageProps) {
  return <main className="page">Bài {lessonId}: đang làm.</main>;
}
