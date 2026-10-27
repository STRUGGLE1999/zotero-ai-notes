import { PaperChat, type PaperRef, type ReadingTurn } from './paper-chat';
import { RequestCancellationController } from '../llm/gemini-client';
import { markdownToSafeHtml } from '../output/markdown';
import { buildZoteroNoteHtml } from '../output/zotero-output';

declare const Zotero: any;
type SectionProps = { body: HTMLDivElement; item: any; tabType: string; setEnabled(enabled: boolean): void };
type Binding = { paper: PaperRef; revision: number; status: HTMLElement; log: HTMLElement; input: HTMLTextAreaElement; send: HTMLButtonElement; cancel: HTMLButtonElement };
type LocalizedDocument = Document & { l10n: { addResourceIds(ids: string[]): void; removeResourceIds(ids: string[]): void } };
type ChatElements = { div: HTMLDivElement; p: HTMLParagraphElement; style: HTMLStyleElement; textarea: HTMLTextAreaElement; button: HTMLButtonElement };
const HTML = 'http://www.w3.org/1999/xhtml';

export function paperFromAttachment(item: any, zotero: any = Zotero): PaperRef | null {
  if (!item?.isPDFAttachment?.()) return null;
  const parent = item.parentID ? zotero.Items.get(item.parentID) : null;
  return { libraryID: item.libraryID, attachmentKey: item.key, attachmentID: item.id, documentID: parent?.id || item.id,
    groupID: zotero.Libraries?.get(item.libraryID)?.libraryType === 'group' ? zotero.Groups.getGroupIDFromLibraryID(item.libraryID) : undefined,
    title: String((parent || item).getField('title') || item.attachmentFilename || '未命名论文'), filename: String(item.attachmentFilename || item.getField('title') || 'PDF') };
}

export class ReaderChatPanel {
  private paneID: string | false = false;
  private bindings = new Map<HTMLDivElement, Binding>();
  private pending = new Map<string, RequestCancellationController>();
  private drafts = new Map<string, string>();
  private selection = new Map<number, { text: string; page?: number }>();
  private documents = new Set<Document>();
  private selectionHandler = ({ reader, params, doc, append }: any) => {
    const text = String(params.annotation?.text || '').trim();
    if (!text) return;
    const itemID = Number(reader._item?.id || reader.itemID);
    const button = doc.createElement('button');
    button.textContent = '带入论文问答';
    button.addEventListener('click', () => {
      this.selection.set(itemID, { text, page: params.annotation?.position?.pageIndex });
      for (const binding of this.bindings.values()) if (binding.paper.attachmentID === itemID) {
        binding.status.textContent = `已带入选中文字（${text.length} 字），请在右侧提问。`;
        binding.input.focus();
      }
    });
    append(button);
  };

  constructor(private chat: PaperChat, private pluginID: string, private rootURI: string) {}

  register() {
    this.paneID = Zotero.ItemPaneManager.registerSection({
      paneID: 'ai-notes-paper-chat', pluginID: this.pluginID,
      header: { l10nID: 'ai-notes-paper-chat-header', icon: `${this.rootURI}icons/icon-16.png` },
      sidenav: { l10nID: 'ai-notes-paper-chat-nav', icon: `${this.rootURI}icons/icon-20.png` },
      onInit: ({ doc }: { doc: LocalizedDocument }) => { doc.l10n.addResourceIds(['ai-notes-paper-chat.ftl']); this.documents.add(doc); },
      onRender: (props: SectionProps) => this.bind(props),
      onItemChange: (props: SectionProps) => this.bind(props),
      onDestroy: ({ body }: SectionProps) => { this.bindings.delete(body); }
    });
    Zotero.Reader.registerEventListener('renderTextSelectionPopup', this.selectionHandler, this.pluginID);
  }

  destroy() {
    for (const controller of this.pending.values()) controller.abort();
    this.pending.clear();
    this.bindings.clear();
    if (this.paneID) Zotero.ItemPaneManager.unregisterSection(this.paneID);
    Zotero.Reader.unregisterEventListener('renderTextSelectionPopup', this.selectionHandler);
    for (const doc of this.documents) (doc as LocalizedDocument).l10n?.removeResourceIds(['ai-notes-paper-chat.ftl']);
    this.documents.clear();
  }

  private bind(props: SectionProps) {
    const { body, item, tabType } = props;
    const section = body.closest('item-pane-custom-section') as HTMLElement & { tabID?: string } | null;
    const reader = tabType === 'reader' && section?.tabID ? Zotero.Reader.getByTabID(section.tabID) : null;
    const attachment = reader ? Zotero.Items.get(reader._item?.id || reader.itemID) : item;
    const paper = paperFromAttachment(attachment);
    props.setEnabled(Boolean(paper || item?.isRegularItem?.()));
    const previous = this.bindings.get(body);
    if (previous) this.drafts.set(this.key(previous.paper), previous.input.value);
    if (paper && previous && this.key(paper) === this.key(previous.paper)) return;
    if (previous) previous.revision++;
    this.bindings.delete(body);
    body.replaceChildren();
    if (!paper) {
      const text = body.ownerDocument.createElementNS(HTML, 'p');
      text.textContent = '请打开要阅读的 PDF，或选择下面的附件开始问答。';
      body.appendChild(text);
      for (const id of item?.getAttachments?.() || []) {
        const candidate = Zotero.Items.get(id);
        if (!candidate?.isPDFAttachment?.()) continue;
        const button = body.ownerDocument.createElementNS(HTML, 'button');
        button.textContent = candidate.attachmentFilename || candidate.getField('title');
        button.addEventListener('click', () => { this.bind({ ...props, item: candidate, tabType: 'library' }); });
        body.appendChild(button);
      }
      return;
    }
    this.mount(body, paper);
  }

  private key(paper: PaperRef) { return `${paper.libraryID}:${paper.attachmentKey}`; }

  private mount(body: HTMLDivElement, paper: PaperRef) {
    const doc = body.ownerDocument;
    const element = <K extends keyof ChatElements>(tag: K, text = '') => {
      const node = doc.createElementNS(HTML, tag) as ChatElements[K]; node.textContent = text; return node;
    };
    const style = element('style');
    style.textContent = `
      .ain-chat{font:13px/1.6 system-ui,sans-serif;min-width:0;color:var(--fill-primary,#24283b)}
      .ain-chat *{box-sizing:border-box}.ain-chat .ain-bound{border:1px solid #7088c84d;border-radius:10px;padding:12px;background:#5479db0d;margin:4px 0 12px}
      .ain-chat .ain-title{font-size:14px;font-weight:650;overflow-wrap:anywhere}.ain-chat .ain-sub{font-size:11px;opacity:.72;overflow-wrap:anywhere}
      .ain-chat .ain-log{max-height:48vh;overflow:auto;overflow-wrap:anywhere}.ain-chat article{padding:12px 0;border-bottom:1px solid #8191af30}
      .ain-chat .ain-question{font-weight:650;white-space:pre-wrap;margin:0 0 7px}.ain-chat .ain-answer p{margin:6px 0}.ain-chat pre{white-space:pre-wrap}.ain-chat table{display:block;overflow:auto}
      .ain-chat textarea{display:block;width:100%;min-height:88px;padding:10px;border:1px solid #8191af80;border-radius:9px;background:transparent;color:inherit;font:inherit;resize:vertical}
      .ain-chat button{height:auto;min-height:28px;padding:6px 10px;border-radius:7px;border:1px solid #8191af60;background:transparent;color:inherit;cursor:pointer;font:inherit;max-width:100%;white-space:normal}
      .ain-chat button:disabled{opacity:.5;cursor:default}.ain-chat .ain-send{background:#3868cf;color:white;border-color:#3868cf}.ain-chat .ain-actions{display:flex;gap:8px;margin-top:8px}
      .ain-chat .ain-status{font-size:11px;opacity:.8;min-height:30px;margin:9px 0}.ain-chat .ain-citation{display:block;height:auto;line-height:1.5;overflow:hidden;text-align:left;font-size:11px;margin:6px 0;width:100%}.ain-chat .ain-save{display:block;font-size:12px;margin-top:8px}
      .ain-chat .ain-hint{font-size:11px;opacity:.7;margin:8px 0}.ain-chat .ain-empty{padding:14px 0;color:#73809b}
    `;
    const root = element('div'); root.className = 'ain-chat';
    const bound = element('div'); bound.className = 'ain-bound';
    bound.append(element('div', '正在询问 · 当前 PDF'));
    const title = element('div', paper.title); title.className = 'ain-title'; bound.append(title);
    const sub = element('div', `${paper.filename} · ${paper.attachmentKey}`); sub.className = 'ain-sub'; bound.append(sub);
    const log = element('div'); log.className = 'ain-log'; log.setAttribute('aria-label', '这篇论文的问答记录');
    const status = element('div'); status.className = 'ain-status'; status.setAttribute('role', 'status');
    const input = element('textarea'); input.placeholder = '哪里不理解？例如：作者为什么采用这个方法？'; input.setAttribute('aria-label', '关于当前论文的问题');
    input.value = this.drafts.get(this.key(paper)) || '';
    input.addEventListener('input', () => { this.drafts.set(this.key(paper), input.value); });
    const actions = element('div'); actions.className = 'ain-actions';
    const send = element('button', '询问这篇论文'); send.className = 'ain-send';
    const cancel = element('button', '停止回答'); cancel.hidden = true;
    actions.append(send, cancel);
    const hint = element('p', '发送时会将问题相关的论文文字交给设置中的模型。对话保存在本机；勾选后才收入笔记。'); hint.className = 'ain-hint';
    const save = element('button', '保存已收录问答到 Zotero');
    root.append(bound, log, status, input, actions, hint, save); body.append(style, root);
    const binding: Binding = { paper, revision: 0, status, log, input, send, cancel };
    this.bindings.set(body, binding);
    send.addEventListener('click', () => { void this.ask(binding); });
    input.addEventListener('keydown', event => { if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) { event.preventDefault(); void this.ask(binding); } });
    cancel.addEventListener('click', () => { this.pending.get(this.key(paper))?.abort(); });
    save.addEventListener('click', async () => {
      save.disabled = true;
      try {
        const owner = Zotero.Items.get(paper.documentID);
        await this.chat.saveCollected(paper, async markdown => {
          const note = new Zotero.Item('note');
          note.libraryID = paper.libraryID;
          if (owner?.isRegularItem?.()) note.parentItemID = paper.documentID;
          const library = paper.groupID ? `groups/${paper.groupID}` : 'library';
          markdown = `来源：[${paper.title}](zotero://open-pdf/${library}/items/${paper.attachmentKey})\n\n${markdown}`;
          note.setNote(buildZoteroNoteHtml(markdown, {
            generatedAt: new Date().toISOString(), model: '各回答所用模型', template: '阅读问答', mode: '用户选择收录 · AI辅助解释', evidenceCount: 0, pluginVersion: '0.5.0'
          }));
          return note.saveTx();
        });
        status.textContent = owner?.isRegularItem?.()
          ? '已保存到论文下。同内容不会重复创建；收录变更后保存为新笔记，保留原笔记。'
          : '此 PDF 没有上级文献，已保存为附原文链接的独立笔记。同内容不会重复创建。';
      } catch (error) { status.textContent = String(error); }
      finally { save.disabled = false; }
    });
    void this.refresh(binding);
  }

  private async refresh(binding: Binding) {
    const revision = ++binding.revision;
    try {
      const turns = await this.chat.turns(binding.paper);
      if (binding.revision !== revision || ![...this.bindings.values()].includes(binding)) return;
      binding.log.replaceChildren();
      if (!turns.length) {
        const empty = binding.log.ownerDocument.createElementNS(HTML, 'p'); empty.className = 'ain-empty';
        empty.textContent = '边读边问，把有价值的理解留在笔记里。'; binding.log.append(empty);
      }
      for (const turn of turns) this.renderTurn(binding, turn);
      const pending = this.pending.has(this.key(binding.paper));
      binding.send.disabled = pending; binding.cancel.hidden = !pending;
      binding.status.textContent = pending ? '正在查找相关原文并回答… 切换论文不会改变本次回答的归属。' : '仅引用已读取的相关片段；AI 解释请结合原文核对。';
      binding.log.scrollTop = binding.log.scrollHeight;
    } catch (error) { binding.status.textContent = String(error); }
  }

  private renderTurn(binding: Binding, turn: ReadingTurn) {
    const doc = binding.log.ownerDocument;
    const article = doc.createElementNS(HTML, 'article');
    const question = doc.createElementNS(HTML, 'p'); question.className = 'ain-question'; question.textContent = turn.question;
    const answer = doc.createElementNS(HTML, 'div'); answer.className = 'ain-answer';
    if (turn.status === 'done') answer.innerHTML = markdownToSafeHtml(turn.answer);
    else answer.textContent = turn.status === 'pending' ? '正在生成…' : `本次未完成：${turn.answer}`;
    article.append(question, answer);
    for (const citation of turn.citations) {
      const button = doc.createElementNS(HTML, 'button'); button.className = 'ain-citation';
      button.textContent = `原文 · PDF 第 ${citation.page} 页：${citation.quote}`;
      button.addEventListener('click', () => { void Zotero.Reader.open(binding.paper.attachmentID, { pageIndex: citation.page - 1 }); });
      article.append(button);
    }
    if (turn.status === 'done') {
      if (!turn.citations.length) {
        const warning = doc.createElementNS(HTML, 'p'); warning.textContent = '本次未取得可逐字核对的原文引用，请核对解释。'; warning.className = 'ain-hint'; article.append(warning);
      }
      const label = doc.createElementNS(HTML, 'label'); label.className = 'ain-save';
      const checkbox = doc.createElementNS(HTML, 'input') as HTMLInputElement; checkbox.type = 'checkbox'; checkbox.checked = turn.selected;
      label.append(checkbox, doc.createTextNode(' 收入这篇论文的阅读笔记'));
      checkbox.addEventListener('change', async () => {
        checkbox.disabled = true;
        try { await this.chat.select(binding.paper, turn.id, checkbox.checked); binding.status.textContent = '已保存收录选择；生成批注笔记时会附上，或使用下方按钮单独保存。'; }
        catch (error) { checkbox.checked = !checkbox.checked; binding.status.textContent = String(error); }
        finally { checkbox.disabled = false; }
      });
      article.append(label);
    } else if (turn.status === 'error') {
      const retry = doc.createElementNS(HTML, 'button'); retry.textContent = '重新带入问题';
      retry.addEventListener('click', () => { binding.input.value = turn.question; binding.input.focus(); }); article.append(retry);
    }
    binding.log.append(article);
  }

  private async ask(binding: Binding) {
    if (!binding.input.value.trim() || this.pending.has(this.key(binding.paper))) return;
    const question = binding.input.value.trim();
    const selected = this.selection.get(binding.paper.attachmentID);
    const fullQuestion = selected ? `${question}\n\n我选中的原文${selected.page === undefined ? '' : `（PDF 第 ${selected.page + 1} 页）`}：\n${selected.text}` : question;
    const controller = new RequestCancellationController(); this.pending.set(this.key(binding.paper), controller);
    binding.input.value = ''; this.drafts.delete(this.key(binding.paper)); this.selection.delete(binding.paper.attachmentID);
    binding.send.disabled = true; binding.cancel.hidden = false;
    binding.status.textContent = '正在提取这篇 PDF 的文字并查找相关内容…';
    try {
      const result = this.chat.ask(binding.paper, fullQuestion, controller.signal);
      void this.refresh(binding);
      await result;
    } catch (error) {
      const key = this.key(binding.paper);
      if (!this.drafts.get(key)) {
        this.drafts.set(key, question);
        for (const current of this.bindings.values()) if (this.key(current.paper) === key && !current.input.value) current.input.value = question;
      }
      if (selected && !this.selection.has(binding.paper.attachmentID)) this.selection.set(binding.paper.attachmentID, selected);
      binding.status.textContent = `回答未完成：${String(error)}`;
    } finally {
      this.pending.delete(this.key(binding.paper));
      for (const current of this.bindings.values()) if (this.key(current.paper) === this.key(binding.paper)) await this.refresh(current);
    }
  }
}
