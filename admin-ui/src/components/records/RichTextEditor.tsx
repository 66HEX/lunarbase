import React from 'react';
import { EditorContent, useEditor, useEditorState } from '@tiptap/react'
import type { Editor } from '@tiptap/react'
import { TextStyleKit } from '@tiptap/extension-text-style'
import StarterKit from '@tiptap/starter-kit';
import type { JSONContent } from '@tiptap/core';
import { cn } from '@/lib/utils';
import {
  TextBIcon,
  TextItalicIcon,
  TextStrikethroughIcon,
  CodeIcon,
  TextAaIcon,
  TextHOneIcon,
  TextHTwoIcon,
  TextHThreeIcon,
  ListBulletsIcon,
  ListNumbersIcon,
  CodeBlockIcon,
  QuotesIcon,
  MinusIcon,
  ArrowCounterClockwiseIcon,
  ArrowClockwiseIcon,
  BroomIcon
} from '@phosphor-icons/react'

const extensions = [
  TextStyleKit,
  StarterKit.configure({
    blockquote: {
      HTMLAttributes: {
        class: "border-l-2 border-nocta-300 dark:border-nocta-700 pl-4 my-3 text-nocta-700 dark:text-nocta-300",
      },
    },
    bold: {
      HTMLAttributes: {
        class: "font-bold",
      },
    },
    bulletList: {
      HTMLAttributes: {
        class: "list-disc pl-6 my-2",
      },
    },
    code: {
      HTMLAttributes: {
        class: "font-mono text-[0.9em] bg-nocta-100 dark:bg-nocta-800/50 rounded px-1 py-0.5",
      },
    },
    codeBlock: {
      HTMLAttributes: {
        class:
          "font-mono text-[0.9em] bg-nocta-100 dark:bg-nocta-900/40 border border-nocta-200 dark:border-nocta-800 rounded-md p-3 my-2 overflow-x-auto",
      },
    },
    heading: {
      levels: [1, 2, 3, 4, 5, 6],
      HTMLAttributes: {
        class: "tracking-tight text-nocta-900 dark:text-nocta-100 mt-3 mb-1 text-2xl",
      },
    },
    horizontalRule: {
      HTMLAttributes: {
        class: "my-4 border-nocta-200 dark:border-nocta-800",
      },
    },
    italic: {
      HTMLAttributes: {
        class: "italic",
      },
    },
    orderedList: {
      HTMLAttributes: {
        class: "list-decimal pl-6 my-2",
      },
    },
    paragraph: {
      HTMLAttributes: {
        class: "my-2 leading-relaxed",
      },
    },
    strike: {
      HTMLAttributes: {
        class: "line-through",
      },
    },
  }),
];

type RichTextEditorProps = {
  value: JSONContent | null;
  onChange: (content: JSONContent) => void;
  className?: string;
  label?: string;
  helperText?: string;
  containerClassName?: string;
};

function MenuBar({ editor }: { editor: Editor }) {
  const editorState = useEditorState({
    editor,
    selector: ctx => {
      return {
        isBold: ctx.editor.isActive('bold') ?? false,
        canBold: ctx.editor.can().chain().toggleBold().run() ?? false,
        isItalic: ctx.editor.isActive('italic') ?? false,
        canItalic: ctx.editor.can().chain().toggleItalic().run() ?? false,
        isStrike: ctx.editor.isActive('strike') ?? false,
        canStrike: ctx.editor.can().chain().toggleStrike().run() ?? false,
        isCode: ctx.editor.isActive('code') ?? false,
        canCode: ctx.editor.can().chain().toggleCode().run() ?? false,
        canClearMarks: ctx.editor.can().chain().unsetAllMarks().run() ?? false,
        isParagraph: ctx.editor.isActive('paragraph') ?? false,
        isHeading1: ctx.editor.isActive('heading', { level: 1 }) ?? false,
        isHeading2: ctx.editor.isActive('heading', { level: 2 }) ?? false,
        isHeading3: ctx.editor.isActive('heading', { level: 3 }) ?? false,
        isHeading4: ctx.editor.isActive('heading', { level: 4 }) ?? false,
        isHeading5: ctx.editor.isActive('heading', { level: 5 }) ?? false,
        isHeading6: ctx.editor.isActive('heading', { level: 6 }) ?? false,
        isBulletList: ctx.editor.isActive('bulletList') ?? false,
        isOrderedList: ctx.editor.isActive('orderedList') ?? false,
        isCodeBlock: ctx.editor.isActive('codeBlock') ?? false,
        isBlockquote: ctx.editor.isActive('blockquote') ?? false,
        canUndo: ctx.editor.can().chain().undo().run() ?? false,
        canRedo: ctx.editor.can().chain().redo().run() ?? false,
      }
    },
  })

  return (
    <div className="flex flex-wrap gap-1 p-2 border-b border-nocta-200 dark:border-nocta-800/50 bg-nocta-200/50 dark:bg-nocta-800/20">
      <div className="flex gap-0.5">
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleBold().run()}
          disabled={!editorState.canBold}
          className={cn(
            "aspect-square inline-flex items-center justify-center w-8 h-8 text-xs font-medium rounded-md transition-all duration-200 ease-in-out",
            "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-offset-1 focus-visible:ring-nocta-900/50 dark:focus-visible:ring-nocta-100/50",
            "disabled:opacity-50 disabled:cursor-not-allowed",
            editorState.isBold
              ? "bg-nocta-900 dark:bg-nocta-100 text-nocta-100 dark:text-nocta-900 shadow-sm"
              : "text-nocta-700 dark:text-nocta-300 hover:bg-nocta-200 dark:hover:bg-nocta-800"
          )}
        >
          <TextBIcon size={14} weight="bold" />
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleItalic().run()}
          disabled={!editorState.canItalic}
          className={cn(
            "aspect-square inline-flex items-center justify-center w-8 h-8 text-xs font-medium rounded-md transition-all duration-200 ease-in-out",
            "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-offset-1 focus-visible:ring-nocta-900/50 dark:focus-visible:ring-nocta-100/50",
            "disabled:opacity-50 disabled:cursor-not-allowed",
            editorState.isItalic
              ? "bg-nocta-900 dark:bg-nocta-100 text-nocta-100 dark:text-nocta-900 shadow-sm"
              : "text-nocta-700 dark:text-nocta-300 hover:bg-nocta-200 dark:hover:bg-nocta-800"
          )}
        >
          <TextItalicIcon size={14} />
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleStrike().run()}
          disabled={!editorState.canStrike}
          className={cn(
            "aspect-square inline-flex items-center justify-center w-8 h-8 text-xs font-medium rounded-md transition-all duration-200 ease-in-out",
            "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-offset-1 focus-visible:ring-nocta-900/50 dark:focus-visible:ring-nocta-100/50",
            "disabled:opacity-50 disabled:cursor-not-allowed",
            editorState.isStrike
              ? "bg-nocta-900 dark:bg-nocta-100 text-nocta-100 dark:text-nocta-900 shadow-sm"
              : "text-nocta-700 dark:text-nocta-300 hover:bg-nocta-200 dark:hover:bg-nocta-800"
          )}
        >
          <TextStrikethroughIcon size={14} />
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleCode().run()}
          disabled={!editorState.canCode}
          className={cn(
            "aspect-square inline-flex items-center justify-center w-8 h-8 text-xs font-medium rounded-md transition-all duration-200 ease-in-out",
            "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-offset-1 focus-visible:ring-nocta-900/50 dark:focus-visible:ring-nocta-100/50",
            "disabled:opacity-50 disabled:cursor-not-allowed font-mono",
            editorState.isCode
              ? "bg-nocta-900 dark:bg-nocta-100 text-nocta-100 dark:text-nocta-900 shadow-sm"
              : "text-nocta-700 dark:text-nocta-300 hover:bg-nocta-200 dark:hover:bg-nocta-800"
          )}
        >
          <CodeIcon size={14} />
        </button>
      </div>

      <div className="w-px h-6 bg-nocta-300 dark:bg-nocta-700 mx-1 self-center" />

      <div className="flex gap-0.5">
        <button
          type="button"
          onClick={() => editor.chain().focus().setParagraph().run()}
          className={cn(
            "aspect-square inline-flex items-center justify-center px-2 h-8 text-xs font-medium rounded-md transition-all duration-200 ease-in-out",
            "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-offset-1 focus-visible:ring-nocta-900/50 dark:focus-visible:ring-nocta-100/50",
            editorState.isParagraph
              ? "bg-nocta-900 dark:bg-nocta-100 text-nocta-100 dark:text-nocta-900 shadow-sm"
              : "text-nocta-700 dark:text-nocta-300 hover:bg-nocta-200 dark:hover:bg-nocta-800"
          )}
        >
          <TextAaIcon size={14} />
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
          className={cn(
            "aspect-square inline-flex items-center justify-center px-2 h-8 text-xs font-medium rounded-md transition-all duration-200 ease-in-out",
            "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-offset-1 focus-visible:ring-nocta-900/50 dark:focus-visible:ring-nocta-100/50",
            editorState.isHeading1
              ? "bg-nocta-900 dark:bg-nocta-100 text-nocta-100 dark:text-nocta-900 shadow-sm"
              : "text-nocta-700 dark:text-nocta-300 hover:bg-nocta-200 dark:hover:bg-nocta-800"
          )}
        >
          <TextHOneIcon size={14} />
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
          className={cn(
            "aspect-square inline-flex items-center justify-center px-2 h-8 text-xs font-medium rounded-md transition-all duration-200 ease-in-out",
            "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-offset-1 focus-visible:ring-nocta-900/50 dark:focus-visible:ring-nocta-100/50",
            editorState.isHeading2
              ? "bg-nocta-900 dark:bg-nocta-100 text-nocta-100 dark:text-nocta-900 shadow-sm"
              : "text-nocta-700 dark:text-nocta-300 hover:bg-nocta-200 dark:hover:bg-nocta-800"
          )}
        >
          <TextHTwoIcon size={14} />
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
          className={cn(
            "aspect-square inline-flex items-center justify-center px-2 h-8 text-xs font-medium rounded-md transition-all duration-200 ease-in-out",
            "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-offset-1 focus-visible:ring-nocta-900/50 dark:focus-visible:ring-nocta-100/50",
            editorState.isHeading3
              ? "bg-nocta-900 dark:bg-nocta-100 text-nocta-100 dark:text-nocta-900 shadow-sm"
              : "text-nocta-700 dark:text-nocta-300 hover:bg-nocta-200 dark:hover:bg-nocta-800"
          )}
        >
          <TextHThreeIcon size={14} />
        </button>
      </div>

      <div className="w-px h-6 bg-nocta-300 dark:bg-nocta-700 mx-1 self-center" />

      <div className="flex gap-0.5">
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          className={cn(
            "aspect-square inline-flex items-center justify-center w-8 h-8 text-xs font-medium rounded-md transition-all duration-200 ease-in-out",
            "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-offset-1 focus-visible:ring-nocta-900/50 dark:focus-visible:ring-nocta-100/50",
            editorState.isBulletList
              ? "bg-nocta-900 dark:bg-nocta-100 text-nocta-100 dark:text-nocta-900 shadow-sm"
              : "text-nocta-700 dark:text-nocta-300 hover:bg-nocta-200 dark:hover:bg-nocta-800"
          )}
        >
          <ListBulletsIcon size={14} />
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
          className={cn(
            "aspect-square inline-flex items-center justify-center w-8 h-8 text-xs font-medium rounded-md transition-all duration-200 ease-in-out",
            "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-offset-1 focus-visible:ring-nocta-900/50 dark:focus-visible:ring-nocta-100/50",
            editorState.isOrderedList
              ? "bg-nocta-900 dark:bg-nocta-100 text-nocta-100 dark:text-nocta-900 shadow-sm"
              : "text-nocta-700 dark:text-nocta-300 hover:bg-nocta-200 dark:hover:bg-nocta-800"
          )}
        >
          <ListNumbersIcon size={14} />
        </button>
      </div>

      <div className="w-px h-6 bg-nocta-300 dark:bg-nocta-700 mx-1 self-center" />

      <div className="flex gap-0.5">
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleCodeBlock().run()}
          className={cn(
            "aspect-square inline-flex items-center justify-center px-2 h-8 text-xs font-medium rounded-md transition-all duration-200 ease-in-out font-mono",
            "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-offset-1 focus-visible:ring-nocta-900/50 dark:focus-visible:ring-nocta-100/50",
            editorState.isCodeBlock
              ? "bg-nocta-900 dark:bg-nocta-100 text-nocta-100 dark:text-nocta-900 shadow-sm"
              : "text-nocta-700 dark:text-nocta-300 hover:bg-nocta-200 dark:hover:bg-nocta-800"
          )}
        >
          <CodeBlockIcon size={14} />
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleBlockquote().run()}
          className={cn(
            "aspect-square inline-flex items-center justify-center w-8 h-8 text-xs font-medium rounded-md transition-all duration-200 ease-in-out",
            "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-offset-1 focus-visible:ring-nocta-900/50 dark:focus-visible:ring-nocta-100/50",
            editorState.isBlockquote
              ? "bg-nocta-900 dark:bg-nocta-100 text-nocta-100 dark:text-nocta-900 shadow-sm"
              : "text-nocta-700 dark:text-nocta-300 hover:bg-nocta-200 dark:hover:bg-nocta-800"
          )}
        >
          <QuotesIcon size={14} />
        </button>
      </div>

      <div className="w-px h-6 bg-nocta-300 dark:bg-nocta-700 mx-1 self-center" />

      <div className="flex gap-0.5">
        <button
          type="button"
          onClick={() => editor.chain().focus().unsetAllMarks().run()}
          className="aspect-square inline-flex items-center justify-center px-2 h-8 text-xs font-medium rounded-md transition-all duration-200 ease-in-out text-nocta-700 dark:text-nocta-300 hover:bg-nocta-200 dark:hover:bg-nocta-800 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-offset-1 focus-visible:ring-nocta-900/50 dark:focus-visible:ring-nocta-100/50"
        >
          <BroomIcon size={14} />
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().setHorizontalRule().run()}
          className="aspect-square inline-flex items-center justify-center px-2 h-8 text-xs font-medium rounded-md transition-all duration-200 ease-in-out text-nocta-700 dark:text-nocta-300 hover:bg-nocta-200 dark:hover:bg-nocta-800 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-offset-1 focus-visible:ring-nocta-900/50 dark:focus-visible:ring-nocta-100/50"
        >
          <MinusIcon size={14} />
        </button>
      </div>

      <div className="w-px h-6 bg-nocta-300 dark:bg-nocta-700 mx-1 self-center" />

      <div className="flex gap-0.5">
        <button
          type="button"
          onClick={() => editor.chain().focus().undo().run()}
          disabled={!editorState.canUndo}
          className="aspect-square inline-flex items-center justify-center w-8 h-8 text-xs font-medium rounded-md transition-all duration-200 ease-in-out text-nocta-700 dark:text-nocta-300 hover:bg-nocta-200 dark:hover:bg-nocta-800 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-offset-1 focus-visible:ring-nocta-900/50 dark:focus-visible:ring-nocta-100/50 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <ArrowCounterClockwiseIcon size={14} />
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().redo().run()}
          disabled={!editorState.canRedo}
          className="aspect-square inline-flex items-center justify-center w-8 h-8 text-xs font-medium rounded-md transition-all duration-200 ease-in-out text-nocta-700 dark:text-nocta-300 hover:bg-nocta-200 dark:hover:bg-nocta-800 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-offset-1 focus-visible:ring-nocta-900/50 dark:focus-visible:ring-nocta-100/50 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <ArrowClockwiseIcon size={14} />
        </button>
      </div>
    </div>
  )
}

export const RichTextEditor: React.FC<RichTextEditorProps> = ({
  value,
  onChange,
  className,
  containerClassName = '',
}) => {
  const editor = useEditor({
    extensions: [...extensions],
    content: value || '',
    onUpdate: ({ editor }) => {
      onChange(editor.getJSON());
    },
  });

  return (
    <div className={cn("not-prose", containerClassName)}>
      <div className={cn(
        'w-full flex flex-col rounded-lg border transition-all duration-200 ease-in-out overflow-hidden',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2',
        'focus-visible:ring-offset-nocta-50/50 dark:focus-visible:ring-offset-nocta-900/50',
        'disabled:opacity-50 disabled:cursor-not-allowed',
        'not-prose shadow-sm',
        'border-nocta-200 dark:border-nocta-50/10',
        'bg-white dark:bg-nocta-950',
        'text-nocta-900 dark:text-nocta-100',
        'hover:border-nocta-300 dark:hover:border-nocta-700/50',
        'focus-visible:border-nocta-900/50 dark:focus-visible:border-nocta-100/50',
        'focus-visible:ring-nocta-900/50 dark:focus-visible:ring-nocta-100/50 min-h-140',
        className
      )}>
        <MenuBar editor={editor} />
        <EditorContent 
          editor={editor} 
          className="prose prose-sm sm:prose lg:prose-lg xl:prose-2xl p-4 bg-white dark:bg-nocta-950 text-nocta-900 dark:text-nocta-100 border-0 focus:outline-none focus:ring-0"
        />
      </div>
    </div>
  );
};