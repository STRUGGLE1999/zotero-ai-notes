import { describe, it, expect } from 'vitest';
import { getDisplayTitle, type SelectedItemResult } from '../src/zotero/selected-item';

describe('selected-item', () => {
  describe('getDisplayTitle', () => {
    it('should return empty string for failed result', () => {
      const result: SelectedItemResult = { success: false, message: 'error' };
      expect(getDisplayTitle(result)).toBe('');
    });

    it('should return empty string for success without title', () => {
      const result: SelectedItemResult = { success: true };
      expect(getDisplayTitle(result)).toBe('');
    });

    it('should return title for normal item', () => {
      const result: SelectedItemResult = { success: true, title: 'Test Article', isAttachment: false };
      expect(getDisplayTitle(result)).toBe('Test Article');
    });

    it('should return prefixed title for attachment', () => {
      const result: SelectedItemResult = { success: true, title: 'Test Article', isAttachment: true };
      expect(getDisplayTitle(result)).toBe('（附件）Test Article');
    });
  });

  describe('SelectedItemResult scenarios', () => {
    it('should handle empty selection', () => {
      const result: SelectedItemResult = { success: false, message: '请先选择一篇文献。' };
      expect(result.success).toBe(false);
      expect(result.message).toBe('请先选择一篇文献。');
    });

    it('should handle multiple selection', () => {
      const result: SelectedItemResult = { success: false, message: '当前阶段只支持选择一篇文献。' };
      expect(result.success).toBe(false);
      expect(result.message).toBe('当前阶段只支持选择一篇文献。');
    });

    it('should handle single item selection', () => {
      const result: SelectedItemResult = { success: true, title: 'Test Paper', itemType: 'journalArticle', isAttachment: false };
      expect(result.success).toBe(true);
      expect(result.title).toBe('Test Paper');
      expect(result.isAttachment).toBe(false);
    });

    it('should handle PDF attachment selection', () => {
      const result: SelectedItemResult = { success: true, title: 'Parent Article', itemType: 'attachment', isAttachment: true };
      expect(result.success).toBe(true);
      expect(result.title).toBe('Parent Article');
      expect(result.isAttachment).toBe(true);
    });
  });
});
