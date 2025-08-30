import Bold from "@tiptap/extension-bold";
import Code from "@tiptap/extension-code";
import CodeBlockLowlight from "@tiptap/extension-code-block-lowlight";
import Heading from "@tiptap/extension-heading";
import Italic from "@tiptap/extension-italic";
import Strike from "@tiptap/extension-strike";
import { TextStyleKit } from "@tiptap/extension-text-style";
import type { Editor } from "@tiptap/react";
import {
	EditorContent,
	NodeViewContent,
	ReactNodeViewRenderer,
	useEditor,
	useEditorState,
} from "@tiptap/react";
import bash from "highlight.js/lib/languages/bash";
import css from "highlight.js/lib/languages/css";
import go from "highlight.js/lib/languages/go";
import js from "highlight.js/lib/languages/javascript";
import json from "highlight.js/lib/languages/json";
import python from "highlight.js/lib/languages/python";
import rust from "highlight.js/lib/languages/rust";
import sql from "highlight.js/lib/languages/sql";
import ts from "highlight.js/lib/languages/typescript";
import html from "highlight.js/lib/languages/xml";
import { all, createLowlight } from "lowlight";
import type React from "react";
import { useEffect, useRef, useState } from "react";
import { Badge } from "@/components/ui/badge";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { useDebounce } from "@/hooks";

const lowlight = createLowlight(all);
lowlight.register("js", js);
lowlight.register("ts", ts);
lowlight.register("python", python);
lowlight.register("css", css);
lowlight.register("html", html);
lowlight.register("json", json);
lowlight.register("bash", bash);
lowlight.register("sql", sql);
lowlight.register("rust", rust);
lowlight.register("go", go);

import {
	ArrowClockwiseIcon,
	ArrowCounterClockwiseIcon,
	BroomIcon,
	CodeBlockIcon,
	CodeIcon,
	ImageIcon,
	ListBulletsIcon,
	ListNumbersIcon,
	MinusIcon,
	QuotesIcon,
	TextAaIcon,
	TextBIcon,
	TextHOneIcon,
	TextHThreeIcon,
	TextHTwoIcon,
	TextItalicIcon,
	TextStrikethroughIcon,
} from "@phosphor-icons/react";
import type { JSONContent } from "@tiptap/core";
import Blockquote from "@tiptap/extension-blockquote";
import Document from "@tiptap/extension-document";
import HardBreak from "@tiptap/extension-hard-break";
import HorizontalRule from "@tiptap/extension-horizontal-rule";
import Image from "@tiptap/extension-image";
import { BulletList, ListItem, OrderedList } from "@tiptap/extension-list";
import Paragraph from "@tiptap/extension-paragraph";
import Text from "@tiptap/extension-text";
import { Dropcursor, Gapcursor, UndoRedo } from "@tiptap/extensions";
import { toast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";

const CODE_LANGUAGES = [
	{ id: "plaintext", label: "Plain text" },
	{ id: "js", label: "JavaScript" },
	{ id: "ts", label: "TypeScript" },
	{ id: "python", label: "Python" },
	{ id: "css", label: "CSS" },
	{ id: "html", label: "HTML" },
	{ id: "json", label: "JSON" },
	{ id: "bash", label: "Bash" },
	{ id: "sql", label: "SQL" },
	{ id: "rust", label: "Rust" },
	{ id: "go", label: "Go" },
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

const CodeBlockWithBadge = ({
	node,
	extension,
}: {
	node: CodeBlockNode;
	extension: CodeBlockExtension;
}) => {
	const language = node.attrs.language || "plaintext";
	const languageLabel =
		CODE_LANGUAGES.find((lang) => lang.id === language)?.label || "Plain text";

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
			class: "tracking-tight",
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
			class:
				"font-pp-neue-montreal-mono text-[0.9em] bg-nocta-100 dark:bg-nocta-800 rounded px-1 py-0.5",
		},
	}),
	CodeBlockLowlight.extend({
		addNodeView() {
			return ReactNodeViewRenderer(CodeBlockWithBadge);
		},
	}).configure({
		lowlight,
		HTMLAttributes: {
			class:
				"font-pp-neue-montreal-mono text-[0.9em] bg-nocta-100 dark:bg-nocta-800/40 border border-nocta-200 dark:border-nocta-800 rounded-md p-3 my-2 overflow-x-auto text-nocta-900 dark:text-nocta-100 [&_.hljs-comment]:text-[#616161] [&_.hljs-quote]:text-[#616161] [&_.hljs-variable]:text-[#f98181] [&_.hljs-template-variable]:text-[#f98181] [&_.hljs-attribute]:text-[#f98181] [&_.hljs-tag]:text-[#f98181] [&_.hljs-regexp]:text-[#f98181] [&_.hljs-link]:text-[#f98181] [&_.hljs-name]:text-[#f98181] [&_.hljs-selector-id]:text-[#f98181] [&_.hljs-selector-class]:text-[#f98181] [&_.hljs-number]:text-[#fbbc88] [&_.hljs-meta]:text-[#fbbc88] [&_.hljs-built_in]:text-[#fbbc88] [&_.hljs-builtin-name]:text-[#fbbc88] [&_.hljs-literal]:text-[#fbbc88] [&_.hljs-type]:text-[#fbbc88] [&_.hljs-params]:text-[#fbbc88] [&_.hljs-string]:text-[#b9f18d] [&_.hljs-symbol]:text-[#b9f18d] [&_.hljs-bullet]:text-[#b9f18d] [&_.hljs-title]:text-[#faf594] [&_.hljs-section]:text-[#faf594] [&_.hljs-keyword]:text-[#70cff8] [&_.hljs-selector-tag]:text-[#70cff8] [&_.hljs-function]:text-[#faf594] [&_.hljs-function_.hljs-title]:text-[#faf594] [&_.hljs-emphasis]:italic [&_.hljs-strong]:font-bold",
		},
	}),
	Blockquote.configure({
		HTMLAttributes: {
			class:
				"border-l-2 border-nocta-300 dark:border-nocta-700 pl-4 my-3 text-nocta-600 dark:text-nocta-400 italic",
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
	Image.configure({
		HTMLAttributes: {
			class: "max-w-full h-auto rounded-lg my-2",
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
	onSelectOpenChange?: (isOpen: boolean) => void;
};

function MenuBar({
	editor,
	onSelectOpenChange,
	handleImageUpload,
	debouncedIsUploading,
}: {
	editor: Editor;
	onSelectOpenChange?: (isOpen: boolean) => void;
	handleImageUpload: (file: File, editor: Editor) => Promise<void>;
	debouncedIsUploading: boolean;
}) {
	const editorState = useEditorState({
		editor,
		selector: (ctx) => {
			return {
				isBold: ctx.editor.isActive("bold") ?? false,
				canBold: ctx.editor.can().chain().toggleBold().run() ?? false,
				isItalic: ctx.editor.isActive("italic") ?? false,
				canItalic: ctx.editor.can().chain().toggleItalic().run() ?? false,
				isStrike: ctx.editor.isActive("strike") ?? false,
				canStrike: ctx.editor.can().chain().toggleStrike().run() ?? false,
				isCode: ctx.editor.isActive("code") ?? false,
				canCode: ctx.editor.can().chain().toggleCode().run() ?? false,
				canClearMarks: ctx.editor.can().chain().unsetAllMarks().run() ?? false,
				isParagraph: ctx.editor.isActive("paragraph") ?? false,
				isHeading1: ctx.editor.isActive("heading", { level: 1 }) ?? false,
				isHeading2: ctx.editor.isActive("heading", { level: 2 }) ?? false,
				isHeading3: ctx.editor.isActive("heading", { level: 3 }) ?? false,
				isHeading4: ctx.editor.isActive("heading", { level: 4 }) ?? false,
				isHeading5: ctx.editor.isActive("heading", { level: 5 }) ?? false,
				isHeading6: ctx.editor.isActive("heading", { level: 6 }) ?? false,
				isBulletList: ctx.editor.isActive("bulletList") ?? false,
				isOrderedList: ctx.editor.isActive("orderedList") ?? false,
				isCodeBlock: ctx.editor.isActive("codeBlock") ?? false,
				isBlockquote: ctx.editor.isActive("blockquote") ?? false,
				canUndo: ctx.editor.can().chain().undo().run() ?? false,
				canRedo: ctx.editor.can().chain().redo().run() ?? false,
				codeBlockLanguage: (ctx.editor.getAttributes("codeBlock")?.language ??
					"plaintext") as string,
			};
		},
	});

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
							: "text-nocta-700 dark:text-nocta-300 hover:bg-nocta-200 dark:hover:bg-nocta-800",
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
							: "text-nocta-700 dark:text-nocta-300 hover:bg-nocta-200 dark:hover:bg-nocta-800",
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
							: "text-nocta-700 dark:text-nocta-300 hover:bg-nocta-200 dark:hover:bg-nocta-800",
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
							: "text-nocta-700 dark:text-nocta-300 hover:bg-nocta-200 dark:hover:bg-nocta-800",
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
							: "text-nocta-700 dark:text-nocta-300 hover:bg-nocta-200 dark:hover:bg-nocta-800",
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
					onClick={() =>
						editor.chain().focus().toggleHeading({ level: 1 }).run()
					}
					className={cn(
						"relative aspect-square inline-flex items-center justify-center px-2 h-8 text-xs font-medium rounded-md transition-all duration-200 ease-in-out",
						"focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-offset-1 focus-visible:ring-nocta-900/50 dark:focus-visible:ring-nocta-100/50",
						editorState.isHeading1
							? "bg-nocta-900 dark:bg-nocta-700 text-nocta-100 dark:text-nocta-100 shadow-sm"
							: "text-nocta-700 dark:text-nocta-300 hover:bg-nocta-200 dark:hover:bg-nocta-800",
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
					onClick={() =>
						editor.chain().focus().toggleHeading({ level: 2 }).run()
					}
					className={cn(
						"relative aspect-square inline-flex items-center justify-center px-2 h-8 text-xs font-medium rounded-md transition-all duration-200 ease-in-out",
						"focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-offset-1 focus-visible:ring-nocta-900/50 dark:focus-visible:ring-nocta-100/50",
						editorState.isHeading2
							? "bg-nocta-900 dark:bg-nocta-700 text-nocta-100 dark:text-nocta-100 shadow-sm"
							: "text-nocta-700 dark:text-nocta-300 hover:bg-nocta-200 dark:hover:bg-nocta-800",
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
					onClick={() =>
						editor.chain().focus().toggleHeading({ level: 3 }).run()
					}
					className={cn(
						"relative aspect-square inline-flex items-center justify-center px-2 h-8 text-xs font-medium rounded-md transition-all duration-200 ease-in-out",
						"focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-offset-1 focus-visible:ring-nocta-900/50 dark:focus-visible:ring-nocta-100/50",
						editorState.isHeading3
							? "bg-nocta-900 dark:bg-nocta-700 text-nocta-100 dark:text-nocta-100 shadow-sm"
							: "text-nocta-700 dark:text-nocta-300 hover:bg-nocta-200 dark:hover:bg-nocta-800",
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
							: "text-nocta-700 dark:text-nocta-300 hover:bg-nocta-200 dark:hover:bg-nocta-800",
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
							: "text-nocta-700 dark:text-nocta-300 hover:bg-nocta-200 dark:hover:bg-nocta-800",
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
							: "text-nocta-700 dark:text-nocta-300 hover:bg-nocta-200 dark:hover:bg-nocta-800",
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
					portalProps={
						{
							"data-sheet-portal": "true",
						} as React.HTMLAttributes<HTMLDivElement>
					}
					value={editorState.codeBlockLanguage}
					onValueChange={(language) => {
						editor
							.chain()
							.focus()
							.updateAttributes("codeBlock", { language })
							.run();
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
							: "text-nocta-700 dark:text-nocta-300 hover:bg-nocta-200 dark:hover:bg-nocta-800",
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
				<input
					type="file"
					accept="image/*"
					onChange={(e) => {
						const file = e.target.files?.[0];
						if (file) {
							handleImageUpload(file, editor);
						}
						e.target.value = "";
					}}
					className="hidden"
					id="image-upload"
				/>
				<label
					htmlFor="image-upload"
					className={`aspect-square inline-flex items-center justify-center w-8 h-8 text-xs font-medium rounded-md transition-all duration-200 ease-in-out text-nocta-700 dark:text-nocta-300 hover:bg-nocta-200 dark:hover:bg-nocta-800 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-offset-1 focus-visible:ring-nocta-900/50 dark:focus-visible:ring-nocta-100/50 cursor-pointer ${debouncedIsUploading ? "opacity-50 cursor-not-allowed" : ""}`}
				>
					{debouncedIsUploading ? (
						<Skeleton className="w-4 h-4 rounded" />
					) : (
						<ImageIcon size={16} />
					)}
				</label>
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
	);
}

export const RichTextEditor: React.FC<RichTextEditorProps> = ({
	value,
	onChange,
	className,
	containerClassName,
	onSelectOpenChange,
}) => {
	const [isUploading, setIsUploading] = useState(false);
	const [uploadError, setUploadError] = useState<string | null>(null);
	const debouncedIsUploading = useDebounce(isUploading, 300);
	const previousImagesRef = useRef<Set<string>>(new Set());

	const extractImageUrls = (content: JSONContent | null): Set<string> => {
		const urls = new Set<string>();

		const traverse = (node: JSONContent) => {
			if (node.type === "image" && node.attrs?.src) {
				urls.add(node.attrs.src);
			}
			if (node.content) {
				node.content.forEach(traverse);
			}
		};

		if (content) {
			traverse(content);
		}

		return urls;
	};

	const deleteImageFromS3 = async (imageUrl: string) => {
		try {
			const response = await fetch("/api/delete-image", {
				method: "DELETE",
				headers: {
					"Content-Type": "application/json",
				},
				credentials: "include",
				body: JSON.stringify({ url: imageUrl }),
			});

			if (!response.ok) {
				const errorData = await response
					.json()
					.catch(() => ({ message: "Delete failed" }));
				throw new Error(errorData.message || "Failed to delete image");
			}

			console.log("Image deleted successfully:", imageUrl);
		} catch (error) {
			console.error("Error deleting image:", error);
		}
	};

	const handleImageUpload = async (file: File, editor: Editor) => {
		setUploadError(null);

		const maxSize = 10 * 1024 * 1024;
		if (file.size > maxSize) {
			const errorMsg =
				"Maximum file size is 10MB. Please choose a smaller image.";
			setUploadError(errorMsg);
			toast({
				title: "File too large",
				description: errorMsg,
				variant: "destructive",
				position: "bottom-right",
			});
			return;
		}

		if (!file.type.startsWith("image/")) {
			const errorMsg =
				"Only image files are allowed. Please select a valid image.";
			setUploadError(errorMsg);
			toast({
				title: "Invalid file type",
				description: errorMsg,
				variant: "destructive",
				position: "bottom-right",
			});
			return;
		}

		setIsUploading(true);

		try {
			const formData = new FormData();
			formData.append("file", file);

			const controller = new AbortController();
			const timeoutId = setTimeout(() => controller.abort(), 30000);

			const response = await fetch("/api/upload-image", {
				method: "POST",
				body: formData,
				credentials: "include",
				signal: controller.signal,
			});

			clearTimeout(timeoutId);

			if (!response.ok) {
				const errorData = await response
					.json()
					.catch(() => ({ message: "Upload failed" }));
				const errorMsg = errorData.message || "Failed to upload image";
				throw new Error(errorMsg);
			}

			const data = await response.json();

			if (data.success && data.data?.url) {
				editor.chain().focus().setImage({ src: data.data.url }).run();

				toast({
					title: "Image uploaded successfully",
					description: "Your image has been added to the editor.",
					variant: "success",
					position: "bottom-right",
				});
				setUploadError(null);
			} else {
				throw new Error(data.error || "No URL returned from server");
			}
		} catch (error) {
			console.error("Error uploading image:", error);

			let errorMessage =
				"An unexpected error occurred while uploading the image.";

			if (error instanceof Error) {
				if (error.name === "AbortError") {
					errorMessage =
						"Upload timed out. Please check your connection and try again.";
				} else {
					errorMessage = error.message;
				}
			}

			setUploadError(errorMessage);
			toast({
				title: "Upload failed",
				description: errorMessage,
				variant: "destructive",
				position: "bottom-right",
			});
		} finally {
			setIsUploading(false);
		}
	};

	const editor = useEditor({
		extensions: [...extensions],
		content: value || "",
		onUpdate: ({ editor }) => {
			const json = editor.getJSON();
			onChange(json);

			const currentImages = extractImageUrls(json);
			const previousImages = previousImagesRef.current;

			const removedImages = new Set(
				[...previousImages].filter((url) => !currentImages.has(url)),
			);

			removedImages.forEach((imageUrl) => {
				if (
					imageUrl.includes("s3") ||
					imageUrl.includes("amazonaws") ||
					imageUrl.includes("localhost:4566") ||
					imageUrl.includes("127.0.0.1:4566")
				) {
					deleteImageFromS3(imageUrl);
				}
			});

			previousImagesRef.current = currentImages;
		},
		editorProps: {
			handleKeyDown: (view, event) => {
				if (event.key === "Tab") {
					const { state } = view;
					const { selection } = state;

					if (
						state.schema.nodes.codeBlock &&
						selection.$from.parent.type === state.schema.nodes.codeBlock
					) {
						event.preventDefault();

						const tabChar = "  ";
						const tr = state.tr.insertText(
							tabChar,
							selection.from,
							selection.to,
						);
						view.dispatch(tr);
						return true;
					}
				}
				return false;
			},
		},
	});

	useEffect(() => {
		if (editor && value) {
			const currentImages = extractImageUrls(value);
			previousImagesRef.current = currentImages;
		}
	}, [editor, value]);

	useEffect(() => {
		if (editor && value !== null) {
			const currentContent = editor.getJSON();
			if (JSON.stringify(currentContent) !== JSON.stringify(value)) {
				editor.commands.setContent(value, { emitUpdate: false });
			}
		}
	}, [editor, value]);

	return (
		<div className={cn("not-prose", containerClassName)}>
			{uploadError && (
				<div className="mb-2 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md">
					<p className="text-sm text-red-600 dark:text-red-400">
						{uploadError}
					</p>
				</div>
			)}
			<div
				className={cn(
					"w-full flex flex-col rounded-lg border transition-all duration-200 ease-in-out overflow-hidden",
					"focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2",
					"focus-visible:ring-offset-nocta-50/50 dark:focus-visible:ring-offset-nocta-900/50",
					"disabled:opacity-50 disabled:cursor-not-allowed",
					"not-prose shadow-sm",
					"border-nocta-200 dark:border-nocta-50/10",
					"bg-nocta-200/50 dark:bg-nocta-800/20",
					"text-nocta-900 dark:text-nocta-100",
					"hover:border-nocta-300 dark:hover:border-nocta-700/50",
					"focus-visible:border-nocta-900/50 dark:focus-visible:border-nocta-100/50",
					"focus-visible:ring-nocta-900/50 dark:focus-visible:ring-nocta-100/50 min-h-140",
					className,
				)}
			>
				<MenuBar
					editor={editor}
					onSelectOpenChange={onSelectOpenChange}
					handleImageUpload={handleImageUpload}
					debouncedIsUploading={debouncedIsUploading}
				/>
				<EditorContent
					editor={editor}
					className="px-4 bg-white dark:bg-nocta-950 text-nocta-900 dark:text-nocta-100 border-0 focus:outline-none focus:ring-0 [&_h1]:text-3xl [&_h1]:font-bold [&_h1]:mt-4 [&_h1]:mb-2 [&_h1]:text-nocta-900 [&_h1]:dark:text-nocta-100 [&_h2]:text-2xl [&_h2]:font-semibold [&_h2]:mt-3 [&_h2]:mb-2 [&_h2]:text-nocta-800 [&_h2]:dark:text-nocta-200 [&_h3]:text-xl [&_h3]:font-medium [&_h3]:mt-3 [&_h3]:mb-1 [&_h3]:text-nocta-700 [&_h3]:dark:text-nocta-300 [&_h4]:text-lg [&_h4]:font-medium [&_h4]:mt-2 [&_h4]:mb-1 [&_h4]:text-nocta-600 [&_h4]:dark:text-nocta-400 [&_h5]:text-base [&_h5]:font-medium [&_h5]:mt-2 [&_h5]:mb-1 [&_h5]:text-nocta-500 [&_h5]:dark:text-nocta-500 [&_h6]:text-sm [&_h6]:font-medium [&_h6]:mt-2 [&_h6]:mb-1 [&_h6]:text-nocta-400 [&_h6]:dark:text-nocta-600"
				/>
			</div>
		</div>
	);
};
