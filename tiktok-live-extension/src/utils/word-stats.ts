// 简单的词频统计工具
// 支持中英文混合，按常见分隔符分词

// 停用词列表（常见无意义词）
const STOP_WORDS = new Set([
  // 英文
  'the', 'a', 'an', 'is', 'are', 'was', 'were', 'be', 'been', 'being',
  'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could', 'should',
  'may', 'might', 'must', 'can', 'to', 'of', 'in', 'for', 'on', 'with',
  'at', 'by', 'from', 'as', 'into', 'through', 'during', 'before', 'after',
  'above', 'below', 'between', 'under', 'again', 'further', 'then', 'once',
  'here', 'there', 'when', 'where', 'why', 'how', 'all', 'each', 'few', 'more',
  'most', 'other', 'some', 'such', 'no', 'nor', 'not', 'only', 'own', 'same',
  'so', 'than', 'too', 'very', 's', 't', 'just', 'don', 'now', 'i', 'you',
  'he', 'she', 'it', 'we', 'they', 'my', 'your', 'his', 'her', 'its', 'our',
  'their', 'what', 'which', 'who', 'whom', 'this', 'that', 'these', 'those',
  'am', 'and', 'but', 'if', 'or', 'because', 'until', 'while', 'about',
  // 中文
  '的', '了', '是', '我', '你', '他', '她', '它', '们', '这', '那',
  '在', '有', '和', '与', '也', '就', '都', '而', '及', '着', '等',
  '啊', '哦', '呢', '吧', '嗯', '哈', '呀', '哎', '唉', '噢', '喔',
  '吗', '么', '啦', '嘛', '哇', '呵', '额', '嘿', '欸', '咦', '嗨',
  '不', '没', '别', '很', '好', '太', '真', '可', '会', '能', '要',
  '去', '来', '到', '从', '把', '被', '让', '给', '对', '为', '以',
]);

// 简单分词：按标点、空格、emoji分割
function tokenize(text: string): string[] {
  // 移除 emoji 和特殊字符，保留中英文和数字
  const cleaned = text
    .toLowerCase()
    .replace(/[\u{1F600}-\u{1F64F}]/gu, ' ')  // 表情符号
    .replace(/[\u{1F300}-\u{1F5FF}]/gu, ' ')  // 符号和象形文字
    .replace(/[\u{1F680}-\u{1F6FF}]/gu, ' ')  // 交通和地图符号
    .replace(/[\u{1F1E0}-\u{1F1FF}]/gu, ' ')  // 国旗
    .replace(/[\u{2600}-\u{26FF}]/gu, ' ')    // 杂项符号
    .replace(/[\u{2700}-\u{27BF}]/gu, ' ')    // 装饰符号
    .replace(/[^\u4e00-\u9fa5a-z0-9\s]/g, ' '); // 只保留中英文和数字

  // 分词
  const tokens: string[] = [];

  // 英文按空格分词
  const words = cleaned.split(/\s+/).filter(w => w.length > 0);

  for (const word of words) {
    // 如果是纯英文单词
    if (/^[a-z]+$/.test(word) && word.length >= 2) {
      tokens.push(word);
    }
    // 如果包含中文，按2-4字符长度提取
    else if (/[\u4e00-\u9fa5]/.test(word)) {
      // 提取连续的中文字符
      const chineseMatches = word.match(/[\u4e00-\u9fa5]+/g);
      if (chineseMatches) {
        for (const match of chineseMatches) {
          // 对于短词（2-4字），直接作为一个词
          if (match.length >= 2 && match.length <= 4) {
            tokens.push(match);
          }
          // 对于长词，用滑动窗口提取2-3字词组
          else if (match.length > 4) {
            for (let i = 0; i < match.length - 1; i++) {
              tokens.push(match.slice(i, i + 2));
              if (i < match.length - 2) {
                tokens.push(match.slice(i, i + 3));
              }
            }
          }
        }
      }
    }
  }

  return tokens;
}

export interface WordCount {
  word: string;
  count: number;
}

export function getWordFrequency(comments: string[], topN: number = 10): WordCount[] {
  const wordMap = new Map<string, number>();

  for (const comment of comments) {
    const tokens = tokenize(comment);
    for (const token of tokens) {
      if (!STOP_WORDS.has(token) && token.length >= 2) {
        wordMap.set(token, (wordMap.get(token) || 0) + 1);
      }
    }
  }

  // 转换为数组并排序
  const sorted = Array.from(wordMap.entries())
    .map(([word, count]) => ({ word, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, topN);

  return sorted;
}
