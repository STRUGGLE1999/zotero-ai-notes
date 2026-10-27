import { describe, expect, it, vi } from 'vitest';
import { PaperChat, selectQuestionPages, type PaperRef } from '../src/chat/paper-chat';
import { paperFromAttachment } from '../src/chat/reader-panel';
import { RequestCancellationController } from '../src/llm/gemini-client';

const paper = (key: string): PaperRef => ({ libraryID: 1, attachmentKey: key, attachmentID: key === 'A' ? 10 : 20, documentID: 1, title: 'Same title', filename: `${key}.pdf` });
const pages = [{ page: 1, text: 'Brook uses streams and kernels to express parallel computation.' }];
function setup(generate = vi.fn(async () => ({ answer: 'Brook uses streams.', citations: [{ page: 1, quote: 'Brook uses streams' }] }))) {
  let saved = '{}';
  const chat = new PaperChat({ read: async () => saved, write: async value => { saved = value; }, pages: async () => pages, generate });
  return { chat, generate, saved: () => saved };
}

describe('paper-bound reading questions', () => {
  it('keeps a late answer on its original attachment even when titles match', async () => {
    let finish!: (value: unknown) => void;
    const { chat } = setup(vi.fn(() => new Promise(resolve => { finish = resolve; })) as never);
    const request = chat.ask(paper('A'), 'What are streams?');
    await vi.waitFor(() => expect(finish).toBeTypeOf('function'));
    expect(await chat.turns(paper('B'))).toEqual([]);
    finish({ answer: 'A collection of records.', citations: [] });
    await request;
    expect((await chat.turns(paper('A')))[0].answer).toBe('A collection of records.');
    expect(await chat.turns(paper('B'))).toEqual([]);
  });

  it('persists conversations and includes previous questions when following up', async () => {
    const { chat, generate, saved } = setup();
    await chat.ask(paper('A'), 'What are streams?');
    await chat.ask(paper('A'), 'How do kernels use them?');
    expect(JSON.stringify(generate.mock.calls[1])).toContain('What are streams?');
    const restored = new PaperChat({ read: async () => saved(), write: async () => {}, pages: async () => pages, generate });
    expect(await restored.turns(paper('A'))).toHaveLength(2);
  });

  it('only collects selected answers, never treating unverified citations as sources', async () => {
    const { chat } = setup(vi.fn(async () => ({ answer: 'Explanation', citations: [{ page: 99, quote: 'invented' }] })));
    const turn = await chat.ask(paper('A'), 'Why?');
    expect(turn.citations).toEqual([]);
    expect(await chat.collectedMarkdown(1, ['A'])).toBe('');
    await chat.select(paper('A'), turn.id, true);
    const markdown = await chat.collectedMarkdown(1, ['A']);
    expect(markdown).toContain('Why?');
    expect(markdown).toContain('AI 辅助解释');
    expect(markdown).not.toContain('invented');
    expect(await chat.collectedMarkdown(2, ['A'])).toBe('');
    await chat.select(paper('A'), turn.id, false);
    expect(await chat.collectedMarkdown(1, ['A'])).toBe('');
  });

  it('keeps a failed question and allows a later retry', async () => {
    const { chat, generate } = setup();
    generate.mockRejectedValueOnce(new Error('offline'));
    await expect(chat.ask(paper('A'), 'Why?')).rejects.toThrow('offline');
    expect((await chat.turns(paper('A')))[0]).toMatchObject({ question: 'Why?', status: 'error' });
    await chat.ask(paper('A'), 'Why?');
    expect((await chat.turns(paper('A')))[1].status).toBe('done');
  });

  it('does not recreate the same collected note and preserves old notes after collection changes', async () => {
    const { chat } = setup();
    const first = await chat.ask(paper('A'), 'What are streams?');
    await chat.select(paper('A'), first.id, true);
    const save = vi.fn(async () => 90);
    await chat.saveCollected(paper('A'), save);
    await chat.saveCollected(paper('A'), save);
    expect(save).toHaveBeenCalledTimes(1);
    const second = await chat.ask(paper('A'), 'What are kernels?');
    await chat.select(paper('A'), second.id, true);
    await chat.saveCollected(paper('A'), save);
    expect(save).toHaveBeenCalledTimes(2);
    expect(save.mock.calls[1][0]).toContain('What are kernels?');
  });

  it('chooses source pages containing the question terms instead of just the start of a long PDF', () => {
    const input = Array.from({ length: 12 }, (_, i) => ({ page: i + 1, text: i === 9 ? 'kernels and streams' : 'unrelated paragraph' }));
    expect(selectQuestionPages(input, 'kernels')).toContainEqual({ page: 10, text: 'kernels and streams' });
  });

  it('binds to the specific PDF attachment rather than its shared title or parent', () => {
    const parent = { id: 1, getField: () => 'Same title' };
    const zotero = { Items: { get: () => parent } };
    const attachment = { id: 10, key: 'A', parentID: 1, libraryID: 1, attachmentFilename: 'original.pdf', isPDFAttachment: () => true };
    expect(paperFromAttachment(attachment, zotero)).toMatchObject({ attachmentID: 10, attachmentKey: 'A', documentID: 1 });
    expect(paperFromAttachment({ ...attachment, id: 20, key: 'B', attachmentFilename: 'translation.pdf' }, zotero)?.attachmentKey).toBe('B');
    expect(paperFromAttachment(parent, zotero)).toBeNull();
  });

  it('requests a corrected answer once when the model returns the wrong JSON fields', async () => {
    const { chat, generate } = setup();
    generate.mockResolvedValueOnce({ explanation: 'wrong shape' } as never);
    const turn = await chat.ask(paper('A'), 'What are streams?');
    expect(turn.status).toBe('done');
    expect(turn.answer).toBe('Brook uses streams.');
    expect(generate).toHaveBeenCalledTimes(2);
  });

  it('does not accept a late model response after cancellation', async () => {
    let finish!: (value: unknown) => void;
    const { chat } = setup(vi.fn(() => new Promise(resolve => { finish = resolve; })) as never);
    const controller = new RequestCancellationController();
    const request = chat.ask(paper('A'), 'Why?', controller.signal);
    await vi.waitFor(() => expect(finish).toBeTypeOf('function'));
    controller.abort();
    finish({ answer: 'late answer', citations: [] });
    await expect(request).rejects.toThrow('取消');
    expect((await chat.turns(paper('A')))[0].status).toBe('error');
  });

  it('rolls back collection if writing to local storage fails', async () => {
    let fail = false;
    const chat = new PaperChat({ read: async () => '{}', write: async () => { if (fail) throw new Error('disk full'); }, pages: async () => pages,
      generate: async () => ({ answer: 'Explanation', citations: [] }) });
    const turn = await chat.ask(paper('A'), 'Why?');
    fail = true;
    await expect(chat.select(paper('A'), turn.id, true)).rejects.toThrow('disk full');
    expect((await chat.turns(paper('A')))[0].selected).toBe(false);
    expect(await chat.collectedMarkdown(1, ['A'])).toBe('');
  });

  it('does not create duplicate notes when two windows save simultaneously', async () => {
    const { chat } = setup();
    const turn = await chat.ask(paper('A'), 'Why?');
    await chat.select(paper('A'), turn.id, true);
    const save = vi.fn(async () => 90);
    await Promise.all([chat.saveCollected(paper('A'), save), chat.saveCollected(paper('A'), save)]);
    expect(save).toHaveBeenCalledTimes(1);
  });

  it('retains the matched passage even when it is near the end of a long page', () => {
    const text = `${'unrelated '.repeat(700)}kernels operate on streams`;
    expect(selectQuestionPages([{ page: 1, text }], 'kernels')[0].text).toContain('kernels operate on streams');
  });
});
