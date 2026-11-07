"use client";

import { useSkeletonPhase } from "@/hooks/use-skeleton-phase";
import {
  IconArrowBackUp,
  IconArrowForwardUp,
  IconBlockquote,
  IconBold,
  IconCode,
  IconH1,
  IconH2,
  IconH3,
  IconItalic,
  IconList,
  IconListNumbers,
} from "@tabler/icons-react";
import { Placeholder } from "@tiptap/extension-placeholder";
import { Markdown } from "@tiptap/markdown";
import { EditorContent, useEditor, useEditorState } from "@tiptap/react";
import type { Editor } from "@tiptap/react";
import { StarterKit } from "@tiptap/starter-kit";
import { useEffect, useId, useRef, useState } from "react";
import { MarkdownEditorSkeleton } from "@/components/skeletons/components/markdown-editor-skeleton";
import { Button } from "@/components/ui/button";
import { SegmentedControl, SegmentedControlItem } from "@/components/ui/segmented-control";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import * as m from "@/paraglide/messages";

const formatting = [
  {
    group: "headings",
    tools: [
      {
        Icon: IconH1,
        label: m.markdown_heading_1,
        key: "h1",
        apply: (e: Editor) => e.chain().focus().toggleHeading({ level: 1 }).run(),
      },
      {
        Icon: IconH2,
        label: m.markdown_heading_2,
        key: "h2",
        apply: (e: Editor) => e.chain().focus().toggleHeading({ level: 2 }).run(),
      },
      {
        Icon: IconH3,
        label: m.markdown_heading_3,
        key: "h3",
        apply: (e: Editor) => e.chain().focus().toggleHeading({ level: 3 }).run(),
      },
    ],
  },
  {
    group: "inline",
    tools: [
      {
        Icon: IconBold,
        label: m.markdown_bold,
        key: "bold",
        apply: (e: Editor) => e.chain().focus().toggleBold().run(),
      },
      {
        Icon: IconItalic,
        label: m.markdown_italic,
        key: "italic",
        apply: (e: Editor) => e.chain().focus().toggleItalic().run(),
      },
      {
        Icon: IconCode,
        label: m.markdown_code,
        key: "code",
        apply: (e: Editor) => e.chain().focus().toggleCode().run(),
      },
    ],
  },
  {
    group: "blocks",
    tools: [
      {
        Icon: IconList,
        label: m.markdown_bullet_list,
        key: "bulletList",
        apply: (e: Editor) => e.chain().focus().toggleBulletList().run(),
      },
      {
        Icon: IconListNumbers,
        label: m.markdown_ordered_list,
        key: "orderedList",
        apply: (e: Editor) => e.chain().focus().toggleOrderedList().run(),
      },
      {
        Icon: IconBlockquote,
        label: m.markdown_quote,
        key: "blockquote",
        apply: (e: Editor) => e.chain().focus().toggleBlockquote().run(),
      },
    ],
  },
] as const;

function FormatControls({ editor, disabled }: { editor: Editor; disabled: boolean }) {
  const state = useEditorState({
    editor,
    selector: ({ editor: current }) => ({
      blockquote: current.isActive("blockquote"),
      bold: current.isActive("bold"),
      bulletList: current.isActive("bulletList"),
      code: current.isActive("code"),
      h1: current.isActive("heading", { level: 1 }),
      h2: current.isActive("heading", { level: 2 }),
      h3: current.isActive("heading", { level: 3 }),
      italic: current.isActive("italic"),
      orderedList: current.isActive("orderedList"),
      redo: current.can().redo(),
      undo: current.can().undo(),
    }),
  });

  return (
    <>
      <div
        role="group"
        aria-label={m.markdown_formatting()}
        className="flex flex-wrap items-center gap-y-1 max-sm:w-full"
      >
        {formatting.map(({ group, tools }) => (
          <div
            key={group}
            className="flex items-center gap-0.5 border-e border-border/75 pe-1.5 ps-1.5 first:ps-0 max-sm:last:border-e-0"
          >
            {tools.map(({ Icon, label, key, apply }) => (
              <Button
                key={key}
                variant="ghost"
                size="icon-xs"
                aria-label={label()}
                title={label()}
                aria-pressed={state[key]}
                className="text-muted-foreground aria-pressed:bg-accent aria-pressed:text-accent-foreground"
                disabled={disabled}
                onClick={() => apply(editor)}
              >
                <Icon aria-hidden="true" />
              </Button>
            ))}
          </div>
        ))}
      </div>
      <div className="flex items-center gap-0.5">
        <Button
          variant="ghost"
          size="icon-xs"
          aria-label={m.markdown_undo()}
          title={m.markdown_undo()}
          disabled={disabled || !state.undo}
          onClick={() => editor.chain().focus().undo().run()}
        >
          <IconArrowBackUp aria-hidden="true" />
        </Button>
        <Button
          variant="ghost"
          size="icon-xs"
          aria-label={m.markdown_redo()}
          title={m.markdown_redo()}
          disabled={disabled || !state.redo}
          onClick={() => editor.chain().focus().redo().run()}
        >
          <IconArrowForwardUp aria-hidden="true" />
        </Button>
      </div>
    </>
  );
}

const contentClassName = cn(
  "min-h-(--markdown-editor-min-height) px-3.5 py-3 text-base/7 wrap-anywhere outline-none sm:text-sm/6",
  "[&>*+*]:mt-2 [&>h1]:font-heading [&>h1]:text-xl [&>h2]:font-heading [&>h2]:text-lg [&>h3]:text-base [&>:is(h1,h2,h3)]:font-semibold [&>:is(h1,h2,h3):not(:first-child)]:mt-4",
  "[&_ul]:list-disc [&_ol]:list-decimal [&_:is(ul,ol)]:ps-6 [&_li+li]:mt-0.5 [&_li>:is(ul,ol)]:mt-0.5",
  "[&_blockquote]:border-s-2 [&_blockquote]:border-border [&_blockquote]:ps-3 [&_blockquote]:text-muted-foreground [&_hr]:border-border",
  "[&_a]:underline [&_a]:underline-offset-3 [&_code]:rounded-sm [&_code]:bg-muted [&_code]:px-1 [&_code]:font-mono [&_code]:text-[0.9em]",
  "[&_pre]:rounded-md [&_pre]:bg-muted [&_pre]:p-3 [&_pre_code]:bg-transparent [&_pre_code]:p-0",
  "[&_.is-editor-empty:first-child]:before:pointer-events-none [&_.is-editor-empty:first-child]:before:float-start [&_.is-editor-empty:first-child]:before:h-0 [&_.is-editor-empty:first-child]:before:text-muted-foreground/75 [&_.is-editor-empty:first-child]:before:content-[attr(data-placeholder)]",
);

export interface MarkdownEditorProps {
  id?: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  maxLength?: number;
  disabled?: boolean;
  compact?: boolean;
  className?: string;
  "aria-label"?: string;
  "aria-labelledby"?: string;
  "aria-required"?: boolean | "true" | "false";
}

export function MarkdownEditor({
  id,
  value,
  onChange,
  placeholder,
  maxLength,
  disabled = false,
  compact = false,
  className,
  "aria-label": label,
  "aria-labelledby": labelledBy,
  "aria-required": required,
}: MarkdownEditorProps) {
  const [source, setSource] = useState(false);
  const generatedId = useId();
  const editorId = id ?? generatedId;
  const countId = `${editorId}-count`;
  const overLimit = maxLength !== undefined && value.length > maxLength;
  const lastMarkdown = useRef(value);
  const editor = useEditor(
    {
      content: value,
      contentType: "markdown",
      editable: !disabled,
      extensions: [
        StarterKit.configure({ link: { openOnClick: false }, underline: false }),
        Markdown,
        Placeholder.configure({ placeholder: placeholder ?? "" }),
      ],
      immediatelyRender: false,
      onUpdate: ({ editor: current }) => {
        const markdown = current.isEmpty ? "" : current.getMarkdown();
        lastMarkdown.current = markdown;
        onChange(markdown);
      },
      shouldRerenderOnTransaction: false,
    },
    [placeholder],
  );

  useEffect(() => {
    if (editor && !source && value !== lastMarkdown.current) {
      lastMarkdown.current = value;
      editor.commands.setContent(value, { contentType: "markdown", emitUpdate: false });
    }
  }, [editor, source, value]);

  useEffect(() => {
    editor?.setEditable(!disabled, false);
  }, [editor, disabled]);

  useEffect(() => {
    editor?.setOptions({
      editorProps: {
        attributes: {
          "aria-describedby": maxLength === undefined ? "" : countId,
          "aria-invalid": String(overLimit),
          "aria-label": label ?? "",
          "aria-labelledby": labelledBy ?? "",
          "aria-multiline": "true",
          "aria-readonly": String(disabled),
          "aria-required": String(required ?? false),
          class: contentClassName,
          id: editorId,
          role: "textbox",
        },
      },
    });
  }, [editor, editorId, countId, label, labelledBy, required, disabled, maxLength, overLimit]);

  const phase = useSkeletonPhase(!editor);
  if (phase === "skeleton") {
    return <MarkdownEditorSkeleton className={className} compact={compact} />;
  }
  if (!editor) {
    return null;
  }

  return (
    <div
      className={cn(
        "w-full min-w-0 overflow-hidden rounded-lg border border-input bg-background text-foreground shadow-xs/5 transition-shadow focus-within:border-ring focus-within:ring-[3px] focus-within:ring-ring/24 dark:bg-input/32",
        overLimit &&
          "border-destructive/50 focus-within:border-destructive/64 focus-within:ring-destructive/16",
        disabled && "opacity-64",
        compact ? "[--markdown-editor-min-height:5.5rem]" : "[--markdown-editor-min-height:11rem]",
        className,
      )}
      data-slot="markdown-editor"
    >
      <div className="flex min-h-10 flex-wrap items-center justify-between gap-x-3 gap-y-1.5 border-b border-border/75 bg-muted/35 px-2 py-1.5">
        {source ? (
          <span className="ps-1 text-xs text-muted-foreground">{m.markdown_source_hint()}</span>
        ) : (
          <FormatControls editor={editor} disabled={disabled} />
        )}
        <SegmentedControl
          size="sm"
          className="ms-auto shrink-0"
          role="group"
          aria-label={m.markdown_mode()}
        >
          <SegmentedControlItem
            aria-pressed={!source}
            data-checked={source ? undefined : ""}
            onClick={() => setSource(false)}
            className="text-xs"
          >
            {m.markdown_visual()}
          </SegmentedControlItem>
          <SegmentedControlItem
            aria-pressed={source}
            data-checked={source ? "" : undefined}
            onClick={() => setSource(true)}
            className="text-xs"
          >
            Markdown
          </SegmentedControlItem>
        </SegmentedControl>
      </div>
      <ScrollArea className="h-auto" viewportClassName="max-h-80" overscrollContain>
        {source ? (
          <Textarea
            unstyled
            id={editorId}
            aria-label={label}
            aria-labelledby={labelledBy}
            aria-describedby={maxLength === undefined ? undefined : countId}
            aria-invalid={overLimit}
            aria-required={required}
            readOnly={disabled}
            className="block [&_textarea]:block [&_textarea]:min-h-(--markdown-editor-min-height) [&_textarea]:resize-none [&_textarea]:px-3.5 [&_textarea]:py-3 [&_textarea]:font-mono [&_textarea]:text-base/7 sm:[&_textarea]:text-sm/6"
            placeholder={placeholder}
            value={value}
            onChange={(event) => onChange(event.target.value)}
          />
        ) : (
          <EditorContent editor={editor} />
        )}
      </ScrollArea>
      {maxLength !== undefined && (
        <div
          id={countId}
          className={cn(
            "border-t border-border/65 px-3.5 py-1.5 text-end text-xs tabular-nums text-muted-foreground",
            overLimit && "text-destructive-foreground",
          )}
        >
          {m.markdown_character_count({ count: value.length, max: maxLength })}
        </div>
      )}
    </div>
  );
}
