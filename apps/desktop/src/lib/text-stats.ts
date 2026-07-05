export type TextStats = {
  /** 汉字与英文单词合计（写作场景常用「字数」） */
  words: number;
  /** 全部字符数（含空格与换行） */
  characters: number;
  /** 不含空白字符的字符数 */
  charactersNoWhitespace: number;
  /** 总行数 */
  lines: number;
  /** 非空行数 */
  nonEmptyLines: number;
};

const CJK_PATTERN = /[\u4e00-\u9fff\u3400-\u4dbf\uf900-\ufaff]/g;
const LATIN_WORD_PATTERN = /[a-zA-Z]+(?:'[a-zA-Z]+)?/g;

export function computeTextStats(text: string): TextStats {
  const lines = text.length === 0 ? 0 : text.split(/\r\n|\r|\n/).length;
  const nonEmptyLines =
    text.length === 0 ? 0 : text.split(/\r\n|\r|\n/).filter((line) => line.trim().length > 0).length;

  const cjkMatches = text.match(CJK_PATTERN);
  const latinMatches = text.match(LATIN_WORD_PATTERN);

  return {
    words: (cjkMatches?.length ?? 0) + (latinMatches?.length ?? 0),
    characters: text.length,
    charactersNoWhitespace: text.replace(/\s/g, "").length,
    lines,
    nonEmptyLines,
  };
}

export function formatTextStats(stats: TextStats): string {
  return `${stats.words.toLocaleString()} 字 · ${stats.characters.toLocaleString()} 字符 · ${stats.lines.toLocaleString()} 行`;
}
