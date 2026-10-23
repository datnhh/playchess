import { z } from 'zod';
import { checkPlacement, checkStandardFen } from '../chess/position.ts';
import { FILES, RANKS } from '../chess/types.ts';

/**
 * Lesson content contract. Lessons live in content/lessons/<track>/<id>.json and are mostly written by AI,
 * so everything a machine can check is expressed as data here.
 *
 * This schema covers structure and position format. Deeper rules are enforced by the content
 * validator (tools/content, wave 1 branch B): move legality, BFS reachability of capture targets,
 * assertions, sentence length per track, glossary terms, and audio files matching the narration hash.
 *
 * Sync model: one step = one narration sentence = one audio clip + the board actions of that step.
 * The player runs a step's actions, plays its clip, and only then moves on (no timestamps).
 */

export const LESSON_SCHEMA_VERSION = 1;

const idSchema = z
  .string()
  .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, 'id chỉ gồm chữ thường không dấu, số và dấu gạch ngang');

const squareSchema = z.templateLiteral([z.enum(FILES), z.enum(RANKS)]);

/** Text read aloud by TTS. Kept short; the validator applies stricter per-track word limits. */
const narrationSchema = z.string().trim().min(1).max(300);

const toneSchema = z.enum(['info', 'good', 'warn']);

const promotionSchema = z.enum(['queen', 'rook', 'bishop', 'knight']);

export const stickerKindSchema = z.enum(['star', 'apple', 'flower', 'heart']);

const moveIntentSchema = z.object({
  from: squareSchema,
  to: squareSchema,
  promotion: promotionSchema.optional(),
});

// ---------- Board actions (run at the start of a step, in order) ----------

export const actionSchema = z.discriminatedUnion('type', [
  /** Replace the whole position. Format follows the lesson boardMode. */
  z.object({ type: z.literal('setPosition'), position: z.string().min(1) }),
  /** Animate a move on the board. */
  z.object({
    type: z.literal('move'),
    from: squareSchema,
    to: squareSchema,
    promotion: promotionSchema.optional(),
  }),
  z.object({
    type: z.literal('highlight'),
    squares: z.array(squareSchema).min(1),
    tone: toneSchema.default('info'),
  }),
  z.object({
    type: z.literal('arrow'),
    from: squareSchema,
    to: squareSchema,
    tone: toneSchema.default('info'),
  }),
  /** Replace the stickers (mini-game targets) shown on top of squares. */
  z.object({
    type: z.literal('stickers'),
    items: z.array(z.object({ square: squareSchema, kind: stickerKindSchema })),
  }),
  z.object({ type: z.literal('clear'), target: z.enum(['shapes', 'stickers', 'all']) }),
]);

// ---------- Assertions (checked by the validator on the position after the step's actions) ----------

const STANDARD_ONLY_ASSERTIONS = new Set(['check', 'checkmate', 'stalemate']);

export const assertionSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('check') }),
  z.object({ type: z.literal('checkmate') }),
  z.object({ type: z.literal('stalemate') }),
  /** The highlighted squares are exactly the legal destinations of the piece on `square`. */
  z.object({ type: z.literal('highlightIsLegalMoves'), square: squareSchema }),
  /** Piece code: colour (w|b) + role letter, e.g. "wR". */
  z.object({
    type: z.literal('pieceAt'),
    square: squareSchema,
    piece: z.string().regex(/^[wb][KQRBNP]$/),
  }),
]);

// ---------- Steps ----------

const stepBase = {
  id: idSchema,
  say: narrationSchema,
  actions: z.array(actionSchema).default([]),
  assert: z.array(assertionSchema).default([]),
};

const feedback = {
  /** Spoken when the child gets it right / wrong. Falls back to shared generic clips when omitted. */
  praise: narrationSchema.optional(),
  retry: narrationSchema.optional(),
};

export const stepSchema = z.discriminatedUnion('kind', [
  /** Child watches: actions animate while the narration plays. */
  z.object({ kind: z.literal('watch'), ...stepBase }),
  /** Child must play one of the accepted moves. */
  z.object({
    kind: z.literal('interactMove'),
    ...stepBase,
    ...feedback,
    accept: z.array(moveIntentSchema).min(1),
  }),
  /** Mini-game: move the piece on `piece` to collect every target within `maxMoves` moves. */
  z.object({
    kind: z.literal('captureTargets'),
    ...stepBase,
    ...feedback,
    piece: squareSchema,
    targets: z.array(squareSchema).min(1).max(8),
    maxMoves: z.number().int().min(1).max(20),
  }),
  /** Child taps a square (e.g. "chạm vào quân Mã"). No reading needed. */
  z.object({
    kind: z.literal('tapSquare'),
    ...stepBase,
    ...feedback,
    answers: z.array(squareSchema).min(1),
  }),
]);

// ---------- Lesson ----------

/** basic = "Học cơ bản" (all rules needed to play a game), advanced = "Học nâng cao" (openings, endgames). */
export const trackSchema = z.enum(['basic', 'advanced']);

export const lessonSchema = z
  .object({
    schemaVersion: z.literal(LESSON_SCHEMA_VERSION),
    id: idSchema,
    track: trackSchema,
    /** Position of the lesson inside its track (1-based). */
    order: z.number().int().min(1),
    /** Shown to parents on the map; children rely on icons and audio. */
    title: z.string().trim().min(1).max(80),
    summary: z.string().trim().max(200).optional(),
    boardMode: z.enum(['sandbox', 'standard']),
    orientation: z.enum(['white', 'black']).default('white'),
    start: z.string().min(1),
    /** Only lessons approved by a human reviewer are included in production builds. */
    reviewed: z.boolean(),
    steps: z.array(stepSchema).min(1),
  })
  .superRefine((lesson, ctx) => {
    const checkPosition = (position: string, path: (string | number)[]) => {
      const error =
        lesson.boardMode === 'standard' ? checkStandardFen(position) : checkPlacement(position);
      if (error) {
        ctx.addIssue({
          code: 'custom',
          message: `Thế cờ không hợp lệ cho chế độ ${lesson.boardMode}: ${error}`,
          path,
        });
      }
    };

    checkPosition(lesson.start, ['start']);

    const seenStepIds = new Set<string>();
    lesson.steps.forEach((step, stepIndex) => {
      if (seenStepIds.has(step.id)) {
        ctx.addIssue({
          code: 'custom',
          message: `Trùng id bước "${step.id}"`,
          path: ['steps', stepIndex, 'id'],
        });
      }
      seenStepIds.add(step.id);

      step.actions.forEach((action, actionIndex) => {
        if (action.type === 'setPosition') {
          checkPosition(action.position, ['steps', stepIndex, 'actions', actionIndex, 'position']);
        }
      });

      if (lesson.boardMode === 'sandbox') {
        step.assert.forEach((assertion, assertionIndex) => {
          if (STANDARD_ONLY_ASSERTIONS.has(assertion.type)) {
            ctx.addIssue({
              code: 'custom',
              message: `Khẳng định "${assertion.type}" chỉ dùng cho bài standard (có đủ hai Vua)`,
              path: ['steps', stepIndex, 'assert', assertionIndex],
            });
          }
        });
      }
    });
  });

export type Lesson = z.infer<typeof lessonSchema>;
export type LessonInput = z.input<typeof lessonSchema>;
export type LessonStep = z.infer<typeof stepSchema>;
export type LessonAction = z.infer<typeof actionSchema>;
export type LessonAssertion = z.infer<typeof assertionSchema>;
export type Track = z.infer<typeof trackSchema>;
export type StickerKind = z.infer<typeof stickerKindSchema>;
