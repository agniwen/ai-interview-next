import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

export function MeetingMarkdown({ children }: { children: string }) {
  return (
    <div className="prose prose-sm max-w-none text-left leading-7 wrap-anywhere dark:prose-invert">
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{children}</ReactMarkdown>
    </div>
  );
}
