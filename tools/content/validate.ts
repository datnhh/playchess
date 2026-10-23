import { Chess } from 'chess.js';
import type { AudioManifest } from '../../src/content/audio.ts';
import {
  applyActions,
  applyMove,
  createBoardState,
  type LessonBoardState,
} from '../../src/content/boardState.ts';
import { lessonSchema, type Lesson, type LessonStep } from '../../src/content/schema.ts';
import { legalDests } from '../../src/chess/dests.ts';
import { placementOf } from '../../src/chess/position.ts';
import { minMovesToCollect, parsePlacement } from '../../src/chess/sandbox.ts';
import type { PieceRole } from '../../src/chess/types.ts';
import { audioFileName } from '../tts/config.ts';
import { audioHash } from '../tts/hash.ts';
import {
  isMainModule,
  listAudioFiles,
  MANIFEST_FILE,
  readLessonFiles,
  readManifest,
  type RawLessonFile,
} from './files.ts';
import { commonNarration, lessonNarration, type NarrationItem } from './narration.ts';
import { countWords, findForbiddenTerms } from './text.ts';

/**
 * Content validator: catches chess and wording mistakes in AI-written lessons before a child sees them.
 * `validateLessons` is pure (inputs in memory); the CLI at the bottom reads the repo and prints a report.
 */

export type Severity = 'error' | 'warning';

export interface ValidationIssue {
  severity: Severity;
  file: string;
  /** Step id, when the issue belongs to one step. */
  step?: string;
  message: string;
}

export interface ValidationInput {
  files: readonly RawLessonFile[];
  manifest: AudioManifest;
  /** File names present in public/audio/. */
  audioFiles: ReadonlySet<string>;
}

export interface ValidationResult {
  issues: ValidationIssue[];
  lessons: { file: string; lesson: Lesson }[];
}

export const MAX_WORDS: Readonly<Record<Lesson['track'], number>> = { sprout: 15, junior: 25 };

const FILE_PATTERN = /^content\/lessons\/([^/]+)\/([^/]+)\.json$/;

const ROLE_BY_LETTER: Readonly<Record<string, PieceRole>> = {
  K: 'king',
  Q: 'queen',
  R: 'rook',
  B: 'bishop',
  N: 'knight',
  P: 'pawn',
};

type Reporter = (message: string, step?: string, severity?: Severity) => void;

export function validateLessons(input: ValidationInput): ValidationResult {
  const issues: ValidationIssue[] = [];
  const lessons: { file: string; lesson: Lesson }[] = [];

  for (const raw of input.files) {
    const report: Reporter = (message, step, severity = 'error') => {
      issues.push({ severity, file: raw.file, message, ...(step !== undefined ? { step } : {}) });
    };

    if (raw.parseError !== undefined) {
      report(`JSON không hợp lệ: ${raw.parseError}`);
      continue;
    }
    const parsed = lessonSchema.safeParse(raw.data);
    if (!parsed.success) {
      for (const issue of parsed.error.issues) {
        report(`Sai cấu trúc tại "${issue.path.join('.') || '(gốc)'}": ${issue.message}`);
      }
      continue;
    }
    const lesson = parsed.data;
    lessons.push({ file: raw.file, lesson });

    const match = FILE_PATTERN.exec(raw.file);
    if (!match) {
      report('Bài học phải nằm ở content/lessons/<track>/<tên>.json');
    } else {
      const [, folder, name] = match;
      if (folder !== lesson.track) report(`Thư mục "${folder}" không khớp track "${lesson.track}"`);
      if (lesson.id !== `${folder}-${name}`) {
        report(`id phải là "${folder}-${name}" (theo đường dẫn file), đang là "${lesson.id}"`);
      }
    }

    checkSteps(lesson, report);
    checkNarration(lesson, report);
  }

  // Cross-lesson uniqueness.
  const byId = new Map<string, string>();
  const byOrder = new Map<string, string>();
  for (const { file, lesson } of lessons) {
    const sameId = byId.get(lesson.id);
    if (sameId) {
      issues.push({ severity: 'error', file, message: `Trùng id "${lesson.id}" với ${sameId}` });
    } else byId.set(lesson.id, file);
    const orderKey = `${lesson.track}#${lesson.order}`;
    const sameOrder = byOrder.get(orderKey);
    if (sameOrder) {
      issues.push({
        severity: 'error',
        file,
        message: `Trùng order ${lesson.order} trong track ${lesson.track} với ${sameOrder}`,
      });
    } else byOrder.set(orderKey, file);
  }

  checkAudio(lessons, input, issues);
  return { issues, lessons };
}

/** Replays the lesson exactly like the player does and checks every step on its position. */
function checkSteps(lesson: Lesson, report: Reporter): void {
  const mode = lesson.boardMode;
  let state: LessonBoardState = createBoardState(lesson.start);
  /** Why the next step must begin with setPosition, or null. */
  let needsSetPosition: string | null = null;
  /** False once the position is unknown (failed action); later checks would only add noise. */
  let positionKnown = true;

  for (const step of lesson.steps) {
    const startsWithSetPosition = step.actions[0]?.type === 'setPosition';
    if (needsSetPosition && !startsWithSetPosition) {
      // Always an error: the child's moves decide the position here, so every following step
      // must reset it to show the same board on every device.
      report(`Bước này phải bắt đầu bằng setPosition vì ${needsSetPosition}`, step.id, 'error');
      positionKnown = false;
    }
    if (startsWithSetPosition) positionKnown = true;
    needsSetPosition = null;

    const applied = applyActions(state, step.actions, mode);
    if (!applied.ok) {
      if (positionKnown) report(applied.error, step.id);
      positionKnown = false;
      continue;
    }
    state = applied.state;
    if (!positionKnown) continue;

    checkAssertions(step, state, mode, report);

    switch (step.kind) {
      case 'interactMove': {
        for (const move of step.accept) {
          if (!applyMove(state, move, mode).ok) {
            report(
              `Nước được chấp nhận ${move.from}-${move.to} không hợp lệ ở thế cờ này`,
              step.id,
            );
          }
        }
        if (step.accept.length === 1) {
          const next = applyMove(state, step.accept[0]!, mode);
          if (next.ok) state = next.state;
          else positionKnown = false;
        } else {
          needsSetPosition = `bước "${step.id}" chấp nhận nhiều nước đi khác nhau`;
        }
        break;
      }
      case 'captureTargets':
        checkCaptureTargets(lesson, step, state, report);
        needsSetPosition = `bước "${step.id}" là mini-game ăn mục tiêu`;
        break;
      case 'tapSquare':
        if (step.answers.length === 0) report('tapSquare cần ít nhất một đáp án', step.id);
        break;
      case 'watch':
        break;
    }
  }
}

function checkCaptureTargets(
  lesson: Lesson,
  step: Extract<LessonStep, { kind: 'captureTargets' }>,
  state: LessonBoardState,
  report: Reporter,
): void {
  if (lesson.boardMode !== 'sandbox') {
    report('captureTargets chỉ dùng cho bài sandbox', step.id);
    return;
  }
  const pieces = parsePlacement(state.position);
  if (!pieces.has(step.piece)) {
    report(`Không có quân nào ở ô ${step.piece}`, step.id);
    return;
  }
  if (new Set(step.targets).size !== step.targets.length) {
    report('Danh sách mục tiêu bị trùng ô', step.id);
  }
  if (step.targets.includes(step.piece)) {
    report(`Mục tiêu không được trùng ô quân đang đứng (${step.piece})`, step.id);
  }
  const stickerSquares = new Set(state.stickers.map((sticker) => sticker.square));
  const missing = step.targets.filter((square) => !stickerSquares.has(square));
  if (missing.length > 0) report(`Mục tiêu chưa có hình dán: ${missing.join(', ')}`, step.id);

  if (minMovesToCollect(pieces, step.piece, step.targets, step.maxMoves) === null) {
    report(`Không thể ăn hết mục tiêu trong ${step.maxMoves} nước`, step.id);
  }
}

function checkAssertions(
  step: LessonStep,
  state: LessonBoardState,
  mode: Lesson['boardMode'],
  report: Reporter,
): void {
  for (const assertion of step.assert) {
    switch (assertion.type) {
      case 'check':
      case 'checkmate':
      case 'stalemate': {
        const chess = new Chess(state.position);
        const holds =
          assertion.type === 'check'
            ? chess.inCheck()
            : assertion.type === 'checkmate'
              ? chess.isCheckmate()
              : chess.isStalemate();
        if (!holds) report(`Khẳng định "${assertion.type}" sai ở thế cờ sau bước này`, step.id);
        break;
      }
      case 'highlightIsLegalMoves': {
        const expected = new Set(legalDests(state.position, mode).get(assertion.square) ?? []);
        const circles = new Set(
          state.shapes.flatMap((shape) => (shape.kind === 'circle' ? [shape.square] : [])),
        );
        const extra = [...circles].filter((square) => !expected.has(square)).sort();
        const missing = [...expected].filter((square) => !circles.has(square)).sort();
        if (extra.length > 0 || missing.length > 0) {
          const parts = [
            extra.length > 0 ? `thừa ${extra.join(', ')}` : '',
            missing.length > 0 ? `thiếu ${missing.join(', ')}` : '',
          ].filter(Boolean);
          report(
            `Ô tô sáng không khớp nước đi hợp lệ của quân ở ${assertion.square}: ${parts.join('; ')}`,
            step.id,
          );
        }
        break;
      }
      case 'pieceAt': {
        const piece = parsePlacement(placementOf(state.position)).get(assertion.square);
        const color = assertion.piece[0] === 'w' ? 'white' : 'black';
        const role = ROLE_BY_LETTER[assertion.piece[1] ?? ''];
        if (!piece || piece.color !== color || piece.role !== role) {
          report(`Ô ${assertion.square} không có quân ${assertion.piece}`, step.id);
        }
        break;
      }
    }
  }
}

function checkNarration(lesson: Lesson, report: Reporter): void {
  const limit = MAX_WORDS[lesson.track];
  for (const item of lessonNarration(lesson)) {
    const step = item.stepId ?? undefined;
    const words = countWords(item.text);
    if (words > limit) {
      report(
        `Câu "${item.field}" dài ${words} từ, tối đa ${limit} cho track ${lesson.track}`,
        step,
      );
    }
    for (const term of findForbiddenTerms(item.text)) {
      report(`Câu "${item.field}" chứa "${term.term}" (${term.reason})`, step);
    }
  }
}

/** Problem with the audio of one narration item, or null when it is up to date. */
export function audioProblem(
  item: Pick<NarrationItem, 'key' | 'text'>,
  manifest: AudioManifest,
  audioFiles: ReadonlySet<string>,
): string | null {
  const entry = manifest[item.key];
  if (!entry) return 'chưa có audio';
  const hash = audioHash(item.text);
  if (entry.text !== item.text || entry.hash !== hash) return 'audio cũ (câu chữ đã đổi)';
  if (entry.file !== audioFileName(hash)) return `tên file audio sai (${entry.file})`;
  if (!audioFiles.has(entry.file)) return `thiếu file public/audio/${entry.file}`;
  return null;
}

function checkAudio(
  lessons: readonly { file: string; lesson: Lesson }[],
  input: ValidationInput,
  issues: ValidationIssue[],
): void {
  const expectedKeys = new Set<string>();
  const items: { file: string; item: NarrationItem }[] = [
    ...lessons.flatMap(({ file, lesson }) =>
      lessonNarration(lesson).map((item) => ({ file, item })),
    ),
    ...commonNarration().map((item) => ({ file: MANIFEST_FILE, item })),
  ];
  for (const { file, item } of items) {
    expectedKeys.add(item.key);
    const problem = audioProblem(item, input.manifest, input.audioFiles);
    if (!problem) continue;
    // Missing audio blocks only lessons that are about to ship (reviewed); drafts may lack it.
    const severity: Severity = item.lessonId !== null && item.reviewed ? 'error' : 'warning';
    issues.push({
      severity,
      file,
      ...(item.stepId !== null ? { step: item.stepId } : {}),
      message: `${item.key}: ${problem} (chạy npm run tts)`,
    });
  }

  const referenced = new Set<string>();
  for (const [key, entry] of Object.entries(input.manifest)) {
    referenced.add(entry.file);
    if (!expectedKeys.has(key)) {
      issues.push({
        severity: 'warning',
        file: MANIFEST_FILE,
        message: `Mục "${key}" không còn được dùng (chạy npm run tts)`,
      });
    }
  }
  for (const name of [...input.audioFiles].sort()) {
    if (!referenced.has(name)) {
      issues.push({
        severity: 'warning',
        file: `public/audio/${name}`,
        message: 'File audio thừa (chạy npm run tts -- --prune)',
      });
    }
  }
}

export function formatReport(issues: readonly ValidationIssue[]): string {
  const lines: string[] = [];
  const byFile = new Map<string, ValidationIssue[]>();
  for (const issue of issues) byFile.set(issue.file, [...(byFile.get(issue.file) ?? []), issue]);
  for (const [file, fileIssues] of [...byFile].sort(([a], [b]) => a.localeCompare(b))) {
    lines.push(file);
    for (const issue of fileIssues) {
      const tag = issue.severity === 'error' ? 'LỖI     ' : 'CẢNH BÁO';
      lines.push(`  ${tag} ${issue.step ? `[${issue.step}] ` : ''}${issue.message}`);
    }
  }
  const errors = issues.filter((issue) => issue.severity === 'error').length;
  lines.push('', `Tổng: ${errors} lỗi, ${issues.length - errors} cảnh báo.`);
  return lines.join('\n');
}

if (isMainModule(import.meta.url)) {
  const files = readLessonFiles();
  const { issues, lessons } = validateLessons({
    files,
    manifest: readManifest(),
    audioFiles: listAudioFiles(),
  });
  console.log(`Đã kiểm tra ${files.length} file bài học (${lessons.length} hợp lệ về cấu trúc).\n`);
  console.log(formatReport(issues));
  if (issues.some((issue) => issue.severity === 'error')) process.exitCode = 1;
}
