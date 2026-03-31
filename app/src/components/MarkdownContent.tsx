import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

interface MarkdownContentProps {
	source: string;
}

export function MarkdownContent({ source }: MarkdownContentProps) {
	return (
		<div className="prose prose-slate max-w-none prose-headings:font-serif prose-headings:text-slate-900 prose-p:text-slate-700 prose-strong:text-slate-900 prose-code:rounded prose-code:bg-slate-100 prose-code:px-1 prose-code:py-0.5 prose-code:text-slate-800 prose-code:before:content-none prose-code:after:content-none prose-pre:overflow-x-auto prose-pre:rounded-2xl prose-pre:bg-slate-900 prose-pre:text-slate-100 prose-blockquote:border-l-[3px] prose-blockquote:border-l-emerald-300 prose-blockquote:bg-emerald-50 prose-blockquote:py-2 prose-blockquote:pr-4 prose-blockquote:text-slate-700 prose-li:text-slate-700">
			<ReactMarkdown remarkPlugins={[remarkGfm]}>{source}</ReactMarkdown>
		</div>
	);
}
