import * as React from "react";

import { loadHighlighter } from "@/lib/highlighter";

export function useHighlightedCode(value: string, language: string) {
  // 末尾换行会渲染成额外的空白行。
  // A trailing newline would render as an extra empty line.
  const code = value.endsWith("\n") ? value.slice(0, -1) : value;
  const [loaded, setLoaded] = React.useState<{
    language: string;
    highlighter: Awaited<ReturnType<typeof loadHighlighter>>;
  } | null>(null);
  const highlighter = loaded?.language === language ? loaded.highlighter : null;

  React.useEffect(() => {
    let cancelled = false;

    loadHighlighter(language)
      .then((next) => {
        if (!cancelled) {
          setLoaded({ highlighter: next, language });
        }
        return next;
      })
      .catch(() => null);

    return () => {
      cancelled = true;
    };
  }, [language]);

  // 缓存完整行的高亮；流式输出仅从上一行语法状态继续处理新增行。
  // The complete lines, highlighted. While the code streams, only the new
  // lines are tokenized, starting from the grammar state of the last one.
  const [done, setDone] = React.useState<{
    highlighter: typeof highlighter;
    text: string;
    lines: React.ReactNode[];
    state?: Parameters<NonNullable<typeof highlighter>["highlight"]>[1];
  }>({ highlighter: null, lines: [], text: "" });

  let next = done;

  if (next.highlighter !== highlighter || !code.startsWith(next.text)) {
    next = { highlighter, lines: [], text: "" };
  }

  const end = code.lastIndexOf("\n") + 1;

  if (highlighter && end > next.text.length) {
    const result = highlighter.highlight(code.slice(next.text.length, end - 1), next.state);

    next = {
      highlighter,
      lines: [...next.lines, ...result.lines],
      state: result.state,
      text: code.slice(0, end),
    };
  }

  if (next !== done) {
    setDone(next);
  }

  // 最后一行尚未完成，每次渲染都重新分词。
  // The last line is still being written, so it is tokenized on every render.
  const tail = code.slice(end);

  return React.useMemo(() => {
    if (!highlighter) {
      return code.split("\n");
    }

    return [...next.lines, highlighter.highlight(tail, next.state).lines[0]];
  }, [code, highlighter, next, tail]);
}
