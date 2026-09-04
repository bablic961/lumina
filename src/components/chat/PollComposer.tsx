'use client';

import { useState } from 'react';
import { Plus, X } from 'lucide-react';
import { api } from '@/lib/api';
import { toast } from '@/store/toast';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Switch } from '@/components/ui/Switch';

export function PollComposer({
  chatId,
  open,
  onClose,
}: {
  chatId: string;
  open: boolean;
  onClose: () => void;
}) {
  const [question, setQuestion] = useState('');
  const [options, setOptions] = useState(['', '']);
  const [multiple, setMultiple] = useState(false);
  const [anonymous, setAnonymous] = useState(true);
  const [busy, setBusy] = useState(false);

  async function create() {
    const cleaned = options.map((o) => o.trim()).filter(Boolean);
    if (!question.trim() || cleaned.length < 2) {
      toast.error('Нужен вопрос и минимум два варианта');
      return;
    }
    setBusy(true);
    try {
      await api.post(`/api/chats/${chatId}/poll`, {
        question: question.trim(),
        options: cleaned,
        multiple,
        anonymous,
      });
      setQuestion('');
      setOptions(['', '']);
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Не удалось создать опрос');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Новый опрос"
      description="До 10 вариантов ответа"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Отмена
          </Button>
          <Button onClick={create} loading={busy}>
            Создать
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        <Input
          label="Вопрос"
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          placeholder="Когда созвон?"
          maxLength={200}
        />

        <div className="space-y-2">
          {options.map((option, index) => (
            <div key={index} className="flex items-center gap-2">
              <div className="flex-1">
                <Input
                  value={option}
                  onChange={(e) => setOptions((prev) => prev.map((o, i) => (i === index ? e.target.value : o)))}
                  placeholder={`Вариант ${index + 1}`}
                  maxLength={120}
                />
              </div>
              {options.length > 2 ? (
                <button
                  onClick={() => setOptions((prev) => prev.filter((_, i) => i !== index))}
                  className="press flex h-9 w-9 items-center justify-center rounded-xl text-ink-faint hover:bg-glass/70"
                  aria-label={`Удалить вариант ${index + 1}`}
                >
                  <X className="h-4 w-4" aria-hidden />
                </button>
              ) : null}
            </div>
          ))}
          {options.length < 10 ? (
            <button
              onClick={() => setOptions((prev) => [...prev, ''])}
              className="press flex items-center gap-1.5 text-xs font-semibold text-accent"
            >
              <Plus className="h-3.5 w-3.5" aria-hidden /> Добавить вариант
            </button>
          ) : null}
        </div>

        <Switch checked={multiple} onChange={setMultiple} label="Несколько ответов" />
        <Switch checked={anonymous} onChange={setAnonymous} label="Анонимное голосование" />
      </div>
    </Modal>
  );
}
