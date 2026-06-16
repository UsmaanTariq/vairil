'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';

interface Question {
  id: string;
  question: string;
  answer?: string;
}

interface InterviewProps {
  projectId: string;
  onUpdate: (updated: { status: string }) => void;
}

export default function InterviewStage({ projectId, onUpdate }: InterviewProps) {
  const [questions, setQuestions] = useState<Question[]>([]);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [loadingMessage, setLoadingMessage] = useState('Loading questions…');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    async function loadQuestions() {
      try {
        // Check for cached questions first
        const cached = await fetch(`/api/questions?project_id=${projectId}`);
        const cachedData = await cached.json();

        if (cachedData.questions && cachedData.questions.length > 0) {
          const qs: Question[] = cachedData.questions;
          setQuestions(qs);
          // Pre-fill answers if they were previously saved
          const pre: Record<string, string> = {};
          for (const q of qs) {
            if (q.answer) pre[q.id] = q.answer;
          }
          if (Object.keys(pre).length > 0) setAnswers(pre);
          setLoading(false);
          return;
        }

        // No cache — generate questions
        setLoadingMessage('Generating questions…');
        const res = await fetch('/api/questions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ project_id: projectId }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? 'Failed to generate questions');
        setQuestions(data.questions ?? []);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Something went wrong');
      } finally {
        setLoading(false);
      }
    }

    loadQuestions();
  }, [projectId]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError('');

    try {
      const answersArray = questions.map((q) => ({
        question: q.question,
        answer: answers[q.id] ?? '',
      }));

      const res = await fetch('/api/synthesis', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ project_id: projectId, answers: answersArray }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Failed to build profile');

      onUpdate({ status: 'synthesis' });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div className="py-20 text-center">
        <p className="text-sm text-neutral-400 animate-pulse">{loadingMessage}</p>
      </div>
    );
  }

  if (error && questions.length === 0) {
    return (
      <div className="py-12 text-center space-y-4">
        <p className="text-sm text-red-500">{error}</p>
        <Button
          variant="outline"
          onClick={() => {
            setError('');
            setLoading(true);
            setLoadingMessage('Retrying…');
            fetch('/api/questions', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ project_id: projectId }),
            })
              .then((r) => r.json())
              .then((d) => {
                if (d.error) throw new Error(d.error);
                setQuestions(d.questions ?? []);
              })
              .catch((err) => setError(err.message))
              .finally(() => setLoading(false));
          }}
        >
          Retry
        </Button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-8">
      <div>
        <h3 className="text-lg font-bold text-neutral-950 mb-1">
          Clarifying questions
        </h3>
        <p className="text-sm text-neutral-500">
          Answer as many as you can — leave anything unknown blank.
        </p>
      </div>

      <div className="space-y-6">
        {questions.map((q, i) => (
          <div key={q.id} className="space-y-2">
            <Label htmlFor={q.id} className="text-sm font-medium text-neutral-700">
              {i + 1}. {q.question}
            </Label>
            <Textarea
              id={q.id}
              rows={3}
              placeholder="Your answer…"
              value={answers[q.id] ?? ''}
              onChange={(e) =>
                setAnswers((prev) => ({ ...prev, [q.id]: e.target.value }))
              }
              className="resize-y"
            />
          </div>
        ))}
      </div>

      {error && <p className="text-sm text-red-500">{error}</p>}

      <Button type="submit" disabled={submitting} className="w-full">
        {submitting ? 'Building profile…' : 'Submit answers →'}
      </Button>
    </form>
  );
}
