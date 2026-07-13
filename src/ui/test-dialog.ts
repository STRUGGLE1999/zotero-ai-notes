import type { SelectedItemResult } from '../zotero/selected-item';
import { getDisplayTitle } from '../zotero/selected-item';

declare const Zotero: any;

export function showTestDialog(win: any, result: SelectedItemResult) {
  let title = 'Zotero AI Notes 插件加载成功';
  let message = '';

  if (result.success && result.title) {
    message = `当前文献：${getDisplayTitle(result)}`;
  } else {
    title = '提示';
    message = result.message || '未知错误';
  }

  Zotero.alert(win, title, message);
}
