import { useEditor, EditorContent } from '@tiptap/react';
import type { JSONContent } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import Image from '@tiptap/extension-image';
import Link from '@tiptap/extension-link';
import Table from '@tiptap/extension-table';
import TableRow from '@tiptap/extension-table-row';
import TableCell from '@tiptap/extension-table-cell';
import TableHeader from '@tiptap/extension-table-header';

export const guideExtensions = [
  StarterKit,
  Image.configure({ allowBase64: false }),
  Link.configure({ openOnClick: true, autolink: true, linkOnPaste: true, HTMLAttributes: { rel: 'noopener noreferrer nofollow', target: '_blank' } }),
  Table.configure({ resizable: false }),
  TableRow,
  TableCell,
  TableHeader,
];

export default function GuideContent({ content }: { content: JSONContent }) {
  const editor = useEditor({
    extensions: guideExtensions,
    content,
    editable: false,
    immediatelyRender: false,
  });
  return <div className="guide-rich-text"><EditorContent editor={editor} /></div>;
}
