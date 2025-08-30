import React from 'react';
import { EditorContent, useEditor, useEditorState } from '@tiptap/react'
import type { Editor } from '@tiptap/react'
import { TextStyleKit } from '@tiptap/extension-text-style'
import { ReactNodeViewRenderer, NodeViewContent } from '@tiptap/react'
import Heading from '@tiptap/extension-heading';
import Bold from '@tiptap/extension-bold';
import Italic from '@tiptap/extension-italic';
import Strike from '@tiptap/extension-strike';
import Code from '@tiptap/extension-code';
import CodeBlockLowlight from '@tiptap/extension-code-block-lowlight';
import { all, createLowlight } from 'lowlight'
import js from 'highlight.js/lib/languages/javascript';
import ts from 'highlight.js/lib/languages/typescript';
import python from 'highlight.js/lib/languages/python';
import css from 'highlight.js/lib/languages/css';
import html from 'highlight.js/lib/languages/xml';
import json from 'highlight.js/lib/languages/json';
import bash from 'highlight.js/lib/languages/bash';
import sql from 'highlight.js/lib/languages/sql';
import rust from 'highlight.js/lib/languages/rust';
import go from 'highlight.js/lib/languages/go';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';

const lowlight = createLowlight(all)
lowlight.register('js', js);
lowlight.register('ts', ts);
lowlight.register('python', python);
lowlight.register('css', css);
lowlight.register('html', html);
lowlight.register('json', json);
lowlight.register('bash', bash);
lowlight.register('sql', sql);
lowlight.register('rust', rust);
lowlight.register('go', go);
import Blockquote from '@tiptap/extension-blockquote';
import { BulletList, OrderedList, ListItem } from '@tiptap/extension-list';
import Paragraph from '@tiptap/extension-paragraph';
import HorizontalRule from '@tiptap/extension-horizontal-rule';
import Document from '@tiptap/extension-document';
import Text from '@tiptap/extension-text';
import HardBreak from '@tiptap/extension-hard-break';
import { UndoRedo, Dropcursor, Gapcursor } from '@tiptap/extensions';
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

const CODE_LANGUAGES = [
  { id: 'plaintext', label: 'Plain text' },
  { id: 'js', label: 'JavaScript' },
  { id: 'ts', label: 'TypeScript' },
  { id: 'python', label: 'Python' },
  { id: 'css', label: 'CSS' },
  { id: 'html', label: 'HTML' },
  { id: 'json', label: 'JSON' },
  { id: 'bash', label: 'Bash' },
  { id: 'sql', label: 'SQL' },
  { id: 'rust', label: 'Rust' },
  { id: 'go', label: 'Go' },
];

interface CodeBlockNode {
  attrs: {
    language?: string;
  };
}

interface CodeBlockExtension {
  options: {
    HTMLAttributes: {
      class: string;
    };
  };
}

const CodeBlockWithBadge = ({ node, extension }: { node: CodeBlockNode; extension: CodeBlockExtension }) => {
  const language = node.attrs.language || 'plaintext';
  const languageLabel = CODE_LANGUAGES.find(lang => lang.id === language)?.label || 'Plain text';

  return (
    <div className="relative">
      <Badge 
        variant="outline" 
        size="sm" 
        className="absolute top-2 right-2 z-10 text-[10px] bg-nocta-700/30 border border-nocta-200 dark:border-nocta-700"
      >
        {languageLabel}
      </Badge>
      <pre className={cn(extension.options.HTMLAttributes.class, "pr-16")}>
        <NodeViewContent className={`language-${language}`} />
      </pre>
    </div>
  );
};

const extensions = [
  TextStyleKit,
  Document,
  Text,
  Paragraph.configure({
    HTMLAttributes: {
      class: "my-2 leading-relaxed text-nocta-600 dark:text-nocta-300/90",
    },
  }),
  Heading.configure({
    levels: [1, 2, 3, 4, 5, 6],
    HTMLAttributes: {
      class: 'tracking-tight',
    },
  }),
  Bold.configure({
    HTMLAttributes: {
      class: "font-bold",
    },
  }),
  Italic.configure({
    HTMLAttributes: {
      class: "italic",
    },
  }),
  Strike.configure({
    HTMLAttributes: {
      class: "line-through",
    },
  }),
  Code.configure({
    HTMLAttributes: {
      class: "font-pp-neue-montreal-mono text-[0.9em] bg-nocta-100 dark:bg-nocta-800 rounded px-1 py-0.5",
    },
  }),
  CodeBlockLowlight.extend({
    addNodeView() {
      return ReactNodeViewRenderer(CodeBlockWithBadge);
    },
  }).configure({
    lowlight,
    HTMLAttributes: {
      class: "font-pp-neue-montreal-mono text-[0.9em] bg-nocta-100 dark:bg-nocta-800/40 border border-nocta-200 dark:border-nocta-800 rounded-md p-3 my-2 overflow-x-auto text-nocta-900 dark:text-nocta-100 [&_.hljs-comment]:text-[#616161] [&_.hljs-quote]:text-[#616161] [&_.hljs-variable]:text-[#f98181] [&_.hljs-template-variable]:text-[#f98181] [&_.hljs-attribute]:text-[#f98181] [&_.hljs-tag]:text-[#f98181] [&_.hljs-regexp]:text-[#f98181] [&_.hljs-link]:text-[#f98181] [&_.hljs-name]:text-[#f98181] [&_.hljs-selector-id]:text-[#f98181] [&_.hljs-selector-class]:text-[#f98181] [&_.hljs-number]:text-[#fbbc88] [&_.hljs-meta]:text-[#fbbc88] [&_.hljs-built_in]:text-[#fbbc88] [&_.hljs-builtin-name]:text-[#fbbc88] [&_.hljs-literal]:text-[#fbbc88] [&_.hljs-type]:text-[#fbbc88] [&_.hljs-params]:text-[#fbbc88] [&_.hljs-string]:text-[#b9f18d] [&_.hljs-symbol]:text-[#b9f18d] [&_.hljs-bullet]:text-[#b9f18d] [&_.hljs-title]:text-[#faf594] [&_.hljs-section]:text-[#faf594] [&_.hljs-keyword]:text-[#70cff8] [&_.hljs-selector-tag]:text-[#70cff8] [&_.hljs-function]:text-[#faf594] [&_.hljs-function_.hljs-title]:text-[#faf594] [&_.hljs-emphasis]:italic [&_.hljs-strong]:font-bold",
    },
  }),
  Blockquote.configure({
    HTMLAttributes: {
      class: "border-l-2 border-nocta-300 dark:border-nocta-700 pl-4 my-3 text-nocta-600 dark:text-nocta-400 italic",
    },
  }),
  BulletList.configure({
    HTMLAttributes: {
      class: "list-disc pl-6 my-2 text-nocta-600 dark:text-nocta-300/90",
    },
  }),
  OrderedList.configure({
    HTMLAttributes: {
      class: "list-decimal pl-6 my-2 text-nocta-600 dark:text-nocta-300/90",
    },
  }),
  ListItem,
  HorizontalRule.configure({
    HTMLAttributes: {
      class: "my-4 border-nocta-200 dark:border-nocta-800",
    },
  }),
  HardBreak,
  Dropcursor,
   Gapcursor,
   UndoRedo,
];

type RichTextEditorProps = {
  value: JSONContent | null;
  onChange: (content: JSONContent) => void;
  className?: string;
  label?: string;
  helperText?: string;
  containerClassName?: string;
  onSelectOpenChange?: (isOpen: boolean) => void;
};

function MenuBar({ editor, onSelectOpenChange }: { editor: Editor; onSelectOpenChange?: (isOpen: boolean) => void }) {
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
        codeBlockLanguage: (ctx.editor.getAttributes('codeBlock')?.language ?? 'plaintext') as string,
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
            "relative aspect-square inline-flex items-center justify-center w-8 h-8 text-xs font-medium rounded-md transition-all duration-200 ease-in-out",
            "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-offset-1 focus-visible:ring-nocta-900/50 dark:focus-visible:ring-nocta-100/50",
            "disabled:opacity-50 disabled:cursor-not-allowed",
            editorState.isBold
              ? "bg-nocta-900 dark:bg-nocta-700 text-nocta-100 dark:text-nocta-100 shadow-sm"
              : "text-nocta-700 dark:text-nocta-300 hover:bg-nocta-200 dark:hover:bg-nocta-800"
          )}
        >
          {editorState.isBold && (
            <>
              <span
							aria-hidden
							className="pointer-events-none absolute -inset-px rounded-lg bg-gradient-to-b to-transparent opacity-60"
							style={{
								maskImage:
									"radial-gradient(120% 100% at 50% 0%, black 30%, transparent 70%)",
								WebkitMaskImage:
									"radial-gradient(120% 100% at 50% 0%, black 30%, transparent 70%)",
							}}
						/>

						<span
							aria-hidden
							className="pointer-events-none absolute inset-x-0 top-0 h-px rounded-t-lg opacity-60"
							style={{
								background:
									"linear-gradient(90deg, transparent, rgba(255,255,255,0.35), transparent)",
							}}
						/>
            </>
          )}
          <TextBIcon size={16} weight="bold" />
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleItalic().run()}
          disabled={!editorState.canItalic}
          className={cn(
            "relative aspect-square inline-flex items-center justify-center w-8 h-8 text-xs font-medium rounded-md transition-all duration-200 ease-in-out",
            "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-offset-1 focus-visible:ring-nocta-900/50 dark:focus-visible:ring-nocta-100/50",
            "disabled:opacity-50 disabled:cursor-not-allowed",
            editorState.isItalic
              ? "bg-nocta-900 dark:bg-nocta-700 text-nocta-100 dark:text-nocta-100 shadow-sm"
              : "text-nocta-700 dark:text-nocta-300 hover:bg-nocta-200 dark:hover:bg-nocta-800"
          )}
        >
          {editorState.isItalic && (
            <>
              <span
							aria-hidden
							className="pointer-events-none absolute -inset-px rounded-lg bg-gradient-to-b to-transparent opacity-60"
							style={{
								maskImage:
									"radial-gradient(120% 100% at 50% 0%, black 30%, transparent 70%)",
								WebkitMaskImage:
									"radial-gradient(120% 100% at 50% 0%, black 30%, transparent 70%)",
							}}
						/>

						<span
							aria-hidden
							className="pointer-events-none absolute inset-x-0 top-0 h-px rounded-t-lg opacity-60"
							style={{
								background:
									"linear-gradient(90deg, transparent, rgba(255,255,255,0.35), transparent)",
							}}
						/>
            </>
          )}
          <TextItalicIcon size={16} />
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleStrike().run()}
          disabled={!editorState.canStrike}
          className={cn(
            "relative aspect-square inline-flex items-center justify-center w-8 h-8 text-xs font-medium rounded-md transition-all duration-200 ease-in-out",
            "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-offset-1 focus-visible:ring-nocta-900/50 dark:focus-visible:ring-nocta-100/50",
            "disabled:opacity-50 disabled:cursor-not-allowed",
            editorState.isStrike
              ? "bg-nocta-900 dark:bg-nocta-700 text-nocta-100 dark:text-nocta-100 shadow-sm"
              : "text-nocta-700 dark:text-nocta-300 hover:bg-nocta-200 dark:hover:bg-nocta-800"
          )}
        >
          {editorState.isStrike && (
            <>
              <span
							aria-hidden
							className="pointer-events-none absolute -inset-px rounded-lg bg-gradient-to-b to-transparent opacity-60"
							style={{
								maskImage:
									"radial-gradient(120% 100% at 50% 0%, black 30%, transparent 70%)",
								WebkitMaskImage:
									"radial-gradient(120% 100% at 50% 0%, black 30%, transparent 70%)",
							}}
						/>

						<span
							aria-hidden
							className="pointer-events-none absolute inset-x-0 top-0 h-px rounded-t-lg opacity-60"
							style={{
								background:
									"linear-gradient(90deg, transparent, rgba(255,255,255,0.35), transparent)",
							}}
						/>
            </>
          )}
          <TextStrikethroughIcon size={16} />
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleCode().run()}
          disabled={!editorState.canCode}
          className={cn(
            "relative aspect-square inline-flex items-center justify-center w-8 h-8 text-xs font-medium rounded-md transition-all duration-200 ease-in-out",
            "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-offset-1 focus-visible:ring-nocta-900/50 dark:focus-visible:ring-nocta-100/50",
            "disabled:opacity-50 disabled:cursor-not-allowed font-pp-neue-montreal-mono",
            editorState.isCode
              ? "bg-nocta-900 dark:bg-nocta-700 text-nocta-100 dark:text-nocta-100 shadow-sm"
              : "text-nocta-700 dark:text-nocta-300 hover:bg-nocta-200 dark:hover:bg-nocta-800"
          )}
        >
          {editorState.isCode && (
            <>
              <span
							aria-hidden
							className="pointer-events-none absolute -inset-px rounded-lg bg-gradient-to-b to-transparent opacity-60"
							style={{
								maskImage:
									"radial-gradient(120% 100% at 50% 0%, black 30%, transparent 70%)",
								WebkitMaskImage:
									"radial-gradient(120% 100% at 50% 0%, black 30%, transparent 70%)",
							}}
						/>

						<span
							aria-hidden
							className="pointer-events-none absolute inset-x-0 top-0 h-px rounded-t-lg opacity-60"
							style={{
								background:
									"linear-gradient(90deg, transparent, rgba(255,255,255,0.35), transparent)",
							}}
						/>
            </>
          )}
          <CodeIcon size={16} />
        </button>
      </div>

      <div className="w-px h-6 bg-nocta-300 dark:bg-nocta-700 mx-1 self-center" />

      <div className="flex gap-0.5">
        <button
          type="button"
          onClick={() => editor.chain().focus().setParagraph().run()}
          className={cn(
            "relative aspect-square inline-flex items-center justify-center px-2 h-8 text-xs font-medium rounded-md transition-all duration-200 ease-in-out",
            "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-offset-1 focus-visible:ring-nocta-900/50 dark:focus-visible:ring-nocta-100/50",
            editorState.isParagraph
              ? "bg-nocta-900 dark:bg-nocta-700 text-nocta-100 dark:text-nocta-100 shadow-sm"
              : "text-nocta-700 dark:text-nocta-300 hover:bg-nocta-200 dark:hover:bg-nocta-800"
          )}
        >
          {editorState.isParagraph && (
            <>
              <span
							aria-hidden
							className="pointer-events-none absolute -inset-px rounded-lg bg-gradient-to-b to-transparent opacity-60"
							style={{
								maskImage:
									"radial-gradient(120% 100% at 50% 0%, black 30%, transparent 70%)",
								WebkitMaskImage:
									"radial-gradient(120% 100% at 50% 0%, black 30%, transparent 70%)",
							}}
						/>

						<span
							aria-hidden
							className="pointer-events-none absolute inset-x-0 top-0 h-px rounded-t-lg opacity-60"
							style={{
								background:
									"linear-gradient(90deg, transparent, rgba(255,255,255,0.35), transparent)",
							}}
						/>
            </>
          )}
          <TextAaIcon size={16} />
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
          className={cn(
            "relative aspect-square inline-flex items-center justify-center px-2 h-8 text-xs font-medium rounded-md transition-all duration-200 ease-in-out",
            "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-offset-1 focus-visible:ring-nocta-900/50 dark:focus-visible:ring-nocta-100/50",
            editorState.isHeading1
              ? "bg-nocta-900 dark:bg-nocta-700 text-nocta-100 dark:text-nocta-100 shadow-sm"
              : "text-nocta-700 dark:text-nocta-300 hover:bg-nocta-200 dark:hover:bg-nocta-800"
          )}
        >
          {editorState.isHeading1 && (
            <>
              <span
							aria-hidden
							className="pointer-events-none absolute -inset-px rounded-lg bg-gradient-to-b to-transparent opacity-60"
							style={{
								maskImage:
									"radial-gradient(120% 100% at 50% 0%, black 30%, transparent 70%)",
								WebkitMaskImage:
									"radial-gradient(120% 100% at 50% 0%, black 30%, transparent 70%)",
							}}
						/>

						<span
							aria-hidden
							className="pointer-events-none absolute inset-x-0 top-0 h-px rounded-t-lg opacity-60"
							style={{
								background:
									"linear-gradient(90deg, transparent, rgba(255,255,255,0.35), transparent)",
							}}
						/>
            </>
          )}
          <TextHOneIcon size={16} />
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
          className={cn(
            "relative aspect-square inline-flex items-center justify-center px-2 h-8 text-xs font-medium rounded-md transition-all duration-200 ease-in-out",
            "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-offset-1 focus-visible:ring-nocta-900/50 dark:focus-visible:ring-nocta-100/50",
            editorState.isHeading2
              ? "bg-nocta-900 dark:bg-nocta-700 text-nocta-100 dark:text-nocta-100 shadow-sm"
              : "text-nocta-700 dark:text-nocta-300 hover:bg-nocta-200 dark:hover:bg-nocta-800"
          )}
        >
          {editorState.isHeading2 && (
            <>
              <span
							aria-hidden
							className="pointer-events-none absolute -inset-px rounded-lg bg-gradient-to-b to-transparent opacity-60"
							style={{
								maskImage:
									"radial-gradient(120% 100% at 50% 0%, black 30%, transparent 70%)",
								WebkitMaskImage:
									"radial-gradient(120% 100% at 50% 0%, black 30%, transparent 70%)",
							}}
						/>

						<span
							aria-hidden
							className="pointer-events-none absolute inset-x-0 top-0 h-px rounded-t-lg opacity-60"
							style={{
								background:
									"linear-gradient(90deg, transparent, rgba(255,255,255,0.35), transparent)",
							}}
						/>
            </>
          )}
          <TextHTwoIcon size={16} />
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
          className={cn(
            "relative aspect-square inline-flex items-center justify-center px-2 h-8 text-xs font-medium rounded-md transition-all duration-200 ease-in-out",
            "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-offset-1 focus-visible:ring-nocta-900/50 dark:focus-visible:ring-nocta-100/50",
            editorState.isHeading3
              ? "bg-nocta-900 dark:bg-nocta-700 text-nocta-100 dark:text-nocta-100 shadow-sm"
              : "text-nocta-700 dark:text-nocta-300 hover:bg-nocta-200 dark:hover:bg-nocta-800"
          )}
        >
          {editorState.isHeading3 && (
            <>
              <span
							aria-hidden
							className="pointer-events-none absolute -inset-px rounded-lg bg-gradient-to-b to-transparent opacity-60"
							style={{
								maskImage:
									"radial-gradient(120% 100% at 50% 0%, black 30%, transparent 70%)",
								WebkitMaskImage:
									"radial-gradient(120% 100% at 50% 0%, black 30%, transparent 70%)",
							}}
						/>

						<span
							aria-hidden
							className="pointer-events-none absolute inset-x-0 top-0 h-px rounded-t-lg opacity-60"
							style={{
								background:
									"linear-gradient(90deg, transparent, rgba(255,255,255,0.35), transparent)",
							}}
						/>
            </>
          )}
          <TextHThreeIcon size={16} />
        </button>
      </div>

      <div className="w-px h-6 bg-nocta-300 dark:bg-nocta-700 mx-1 self-center" />

      <div className="flex gap-0.5">
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          className={cn(
            "relative aspect-square inline-flex items-center justify-center w-8 h-8 text-xs font-medium rounded-md transition-all duration-200 ease-in-out",
            "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-offset-1 focus-visible:ring-nocta-900/50 dark:focus-visible:ring-nocta-100/50",
            editorState.isBulletList
              ? "bg-nocta-900 dark:bg-nocta-700 text-nocta-100 dark:text-nocta-100 shadow-sm"
              : "text-nocta-700 dark:text-nocta-300 hover:bg-nocta-200 dark:hover:bg-nocta-800"
          )}
        >
          {editorState.isBulletList && (
            <>
              <span
						aria-hidden
						className="pointer-events-none absolute -inset-px rounded-lg bg-gradient-to-b to-transparent opacity-60"
						style={{
							maskImage:
								"radial-gradient(120% 100% at 50% 0%, black 30%, transparent 70%)",
							WebkitMaskImage:
								"radial-gradient(120% 100% at 50% 0%, black 30%, transparent 70%)",
						}}
					/>

					<span
						aria-hidden
						className="pointer-events-none absolute inset-x-0 top-0 h-px rounded-t-lg opacity-60"
						style={{
							background:
								"linear-gradient(90deg, transparent, rgba(255,255,255,0.35), transparent)",
						}}
					/>
            </>
          )}
          <ListBulletsIcon size={16} />
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
          className={cn(
            "relative aspect-square inline-flex items-center justify-center w-8 h-8 text-xs font-medium rounded-md transition-all duration-200 ease-in-out",
            "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-offset-1 focus-visible:ring-nocta-900/50 dark:focus-visible:ring-nocta-100/50",
            editorState.isOrderedList
              ? "bg-nocta-900 dark:bg-nocta-700 text-nocta-100 dark:text-nocta-100 shadow-sm"
              : "text-nocta-700 dark:text-nocta-300 hover:bg-nocta-200 dark:hover:bg-nocta-800"
          )}
        >
          {editorState.isOrderedList && (
            <>
              <span
						aria-hidden
						className="pointer-events-none absolute -inset-px rounded-lg bg-gradient-to-b to-transparent opacity-60"
						style={{
							maskImage:
								"radial-gradient(120% 100% at 50% 0%, black 30%, transparent 70%)",
							WebkitMaskImage:
								"radial-gradient(120% 100% at 50% 0%, black 30%, transparent 70%)",
						}}
					/>

					<span
						aria-hidden
						className="pointer-events-none absolute inset-x-0 top-0 h-px rounded-t-lg opacity-60"
						style={{
							background:
								"linear-gradient(90deg, transparent, rgba(255,255,255,0.35), transparent)",
						}}
					/>
            </>
          )}
          <ListNumbersIcon size={16} />
        </button>
      </div>

      <div className="w-px h-6 bg-nocta-300 dark:bg-nocta-700 mx-1 self-center" />

      <div className="flex gap-0.5">
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleCodeBlock().run()}
          className={cn(
            "relative aspect-square inline-flex items-center justify-center px-2 h-8 text-xs font-medium rounded-md transition-all duration-200 ease-in-out",
            "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-offset-1 focus-visible:ring-nocta-900/50 dark:focus-visible:ring-nocta-100/50",
            editorState.isCodeBlock
              ? "bg-nocta-900 dark:bg-nocta-700 text-nocta-100 dark:text-nocta-100 shadow-sm"
              : "text-nocta-700 dark:text-nocta-300 hover:bg-nocta-200 dark:hover:bg-nocta-800"
          )}
        >
          {editorState.isCodeBlock && (
            <>
              <span
						aria-hidden
						className="pointer-events-none absolute -inset-px rounded-lg bg-gradient-to-b to-transparent opacity-60"
						style={{
							maskImage:
								"radial-gradient(120% 100% at 50% 0%, black 30%, transparent 70%)",
							WebkitMaskImage:
								"radial-gradient(120% 100% at 50% 0%, black 30%, transparent 70%)",
						}}
					/>

					<span
						aria-hidden
						className="pointer-events-none absolute inset-x-0 top-0 h-px rounded-t-lg opacity-60"
						style={{
							background:
								"linear-gradient(90deg, transparent, rgba(255,255,255,0.35), transparent)",
						}}
					/>
            </>
          )}
          <CodeBlockIcon size={16} />
        </button>
        <Select
          portalProps={{
            "data-sheet-portal": "true",
          } as React.HTMLAttributes<HTMLDivElement>}
          value={editorState.codeBlockLanguage}
          onValueChange={(language) => {
            editor.chain().focus().updateAttributes('codeBlock', { language }).run();
          }}
          onOpenChange={onSelectOpenChange}
          disabled={!editorState.isCodeBlock}
          size="sm"
        >
          <SelectTrigger className="ml-1 !w-32 dark:bg-nocta-900">
            <SelectValue placeholder="Language" />
          </SelectTrigger>
          <SelectContent>
            {CODE_LANGUAGES.map((lang) => (
              <SelectItem key={lang.id} value={lang.id}>
                {lang.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="w-px h-6 bg-nocta-300 dark:bg-nocta-700 mx-1 self-center" />

      <div className="flex gap-0.5">
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleBlockquote().run()}
          className={cn(
            "relative aspect-square inline-flex items-center justify-center w-8 h-8 text-xs font-medium rounded-md transition-all duration-200 ease-in-out",
            "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-offset-1 focus-visible:ring-nocta-900/50 dark:focus-visible:ring-nocta-100/50",
            editorState.isBlockquote
              ? "bg-nocta-900 dark:bg-nocta-700 text-nocta-100 dark:text-nocta-100 shadow-sm"
              : "text-nocta-700 dark:text-nocta-300 hover:bg-nocta-200 dark:hover:bg-nocta-800"
          )}
        >
          {editorState.isBlockquote && (
            <>
              <span
						aria-hidden
						className="pointer-events-none absolute -inset-px rounded-lg bg-gradient-to-b to-transparent opacity-60"
						style={{
							maskImage:
								"radial-gradient(120% 100% at 50% 0%, black 30%, transparent 70%)",
							WebkitMaskImage:
								"radial-gradient(120% 100% at 50% 0%, black 30%, transparent 70%)",
						}}
					/>

					<span
						aria-hidden
						className="pointer-events-none absolute inset-x-0 top-0 h-px rounded-t-lg opacity-60"
						style={{
							background:
								"linear-gradient(90deg, transparent, rgba(255,255,255,0.35), transparent)",
						}}
					/>
            </>
          )}
          <QuotesIcon size={16} />
        </button>
      </div>

      <div className="w-px h-6 bg-nocta-300 dark:bg-nocta-700 mx-1 self-center" />

      <div className="flex gap-0.5">
        <button
          type="button"
          onClick={() => editor.chain().focus().unsetAllMarks().run()}
          className="aspect-square inline-flex items-center justify-center px-2 h-8 text-xs font-medium rounded-md transition-all duration-200 ease-in-out text-nocta-700 dark:text-nocta-300 hover:bg-nocta-200 dark:hover:bg-nocta-800 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-offset-1 focus-visible:ring-nocta-900/50 dark:focus-visible:ring-nocta-100/50"
        >
          <BroomIcon size={16} />
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().setHorizontalRule().run()}
          className="aspect-square inline-flex items-center justify-center px-2 h-8 text-xs font-medium rounded-md transition-all duration-200 ease-in-out text-nocta-700 dark:text-nocta-300 hover:bg-nocta-200 dark:hover:bg-nocta-800 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-offset-1 focus-visible:ring-nocta-900/50 dark:focus-visible:ring-nocta-100/50"
        >
          <MinusIcon size={16} />
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
          <ArrowCounterClockwiseIcon size={16} />
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().redo().run()}
          disabled={!editorState.canRedo}
          className="aspect-square inline-flex items-center justify-center w-8 h-8 text-xs font-medium rounded-md transition-all duration-200 ease-in-out text-nocta-700 dark:text-nocta-300 hover:bg-nocta-200 dark:hover:bg-nocta-800 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-offset-1 focus-visible:ring-nocta-900/50 dark:focus-visible:ring-nocta-100/50 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <ArrowClockwiseIcon size={16} />
        </button>
      </div>
    </div>
  )
}

export const RichTextEditor: React.FC<RichTextEditorProps> = ({
  value,
  onChange,
  className,
  containerClassName,
  onSelectOpenChange,
}) => {
  const editor = useEditor({
    extensions: [...extensions],
    content: value || '',
    onUpdate: ({ editor }) => {
      onChange(editor.getJSON());
    },
    editorProps: {
      handleKeyDown: (view, event) => {
        if (event.key === 'Tab') {
          const { state } = view;
          const { selection } = state;
          
          if (state.schema.nodes.codeBlock && selection.$from.parent.type === state.schema.nodes.codeBlock) {
            event.preventDefault();
            
            const tabChar = '  ';
            const tr = state.tr.insertText(tabChar, selection.from, selection.to);
            view.dispatch(tr);
            return true;
          }
        }
        return false;
      },
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
        'bg-nocta-200/50 dark:bg-nocta-800/20',
        'text-nocta-900 dark:text-nocta-100',
        'hover:border-nocta-300 dark:hover:border-nocta-700/50',
        'focus-visible:border-nocta-900/50 dark:focus-visible:border-nocta-100/50',
        'focus-visible:ring-nocta-900/50 dark:focus-visible:ring-nocta-100/50 min-h-140',
        className
      )}>
        <MenuBar editor={editor} onSelectOpenChange={onSelectOpenChange} />
        <EditorContent 
          editor={editor} 
          className="px-4 bg-white dark:bg-nocta-950 text-nocta-900 dark:text-nocta-100 border-0 focus:outline-none focus:ring-0 [&_h1]:text-3xl [&_h1]:font-bold [&_h1]:mt-4 [&_h1]:mb-2 [&_h1]:text-nocta-900 [&_h1]:dark:text-nocta-100 [&_h2]:text-2xl [&_h2]:font-semibold [&_h2]:mt-3 [&_h2]:mb-2 [&_h2]:text-nocta-800 [&_h2]:dark:text-nocta-200 [&_h3]:text-xl [&_h3]:font-medium [&_h3]:mt-3 [&_h3]:mb-1 [&_h3]:text-nocta-700 [&_h3]:dark:text-nocta-300 [&_h4]:text-lg [&_h4]:font-medium [&_h4]:mt-2 [&_h4]:mb-1 [&_h4]:text-nocta-600 [&_h4]:dark:text-nocta-400 [&_h5]:text-base [&_h5]:font-medium [&_h5]:mt-2 [&_h5]:mb-1 [&_h5]:text-nocta-500 [&_h5]:dark:text-nocta-500 [&_h6]:text-sm [&_h6]:font-medium [&_h6]:mt-2 [&_h6]:mb-1 [&_h6]:text-nocta-400 [&_h6]:dark:text-nocta-600"
        />
      </div>
    </div>
  );
};