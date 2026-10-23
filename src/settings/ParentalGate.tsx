import { useState, type ReactNode } from 'react';
import { Link } from '../app/Link.tsx';
import { checkGateAnswer, createGateQuestion } from './gate.ts';
import '../map/map.css';
import './settings.css';

interface ParentalGateProps {
  children: ReactNode;
}

const DIGITS = ['1', '2', '3', '4', '5', '6', '7', '8', '9'];

/** Shows `children` only after an adult answers a multiplication (valid for this visit). */
export function ParentalGate({ children }: ParentalGateProps) {
  const [question, setQuestion] = useState(() => createGateQuestion());
  const [answer, setAnswer] = useState('');
  const [wrong, setWrong] = useState(false);
  const [open, setOpen] = useState(false);

  if (open) return <>{children}</>;

  const type = (digit: string) => {
    setWrong(false);
    setAnswer((current) => (current.length < 3 ? current + digit : current));
  };
  const submit = () => {
    if (checkGateAnswer(question, answer)) {
      setOpen(true);
      return;
    }
    setWrong(true);
    setAnswer('');
    setQuestion(createGateQuestion());
  };

  return (
    <main className="page gate">
      <header className="map-header">
        <Link to="/" className="icon-button">
          <span aria-hidden="true">🏠</span>
          <span className="visually-hidden">Về trang chủ</span>
        </Link>
        <h1 className="page-title">Dành cho phụ huynh</h1>
      </header>
      <p className="gate-question">
        {question.a} × {question.b} = ?
      </p>
      <output className="gate-answer" aria-live="polite">
        {answer}
      </output>
      {wrong && <p className="gate-wrong">Chưa đúng, thử câu khác nhé.</p>}
      <div className="gate-pad">
        {DIGITS.map((digit) => (
          <button key={digit} type="button" className="button" onClick={() => type(digit)}>
            {digit}
          </button>
        ))}
        <button
          type="button"
          className="button button--secondary"
          aria-label="Xoá"
          onClick={() => setAnswer((current) => current.slice(0, -1))}
        >
          ⌫
        </button>
        <button type="button" className="button" onClick={() => type('0')}>
          0
        </button>
        <button
          type="button"
          className="button"
          aria-label="Xác nhận"
          disabled={answer === ''}
          onClick={submit}
        >
          ✓
        </button>
      </div>
    </main>
  );
}
