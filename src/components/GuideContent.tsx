import { useEditor, EditorContent } from '@tiptap/react';
import type { JSONContent } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import Image from '@tiptap/extension-image';
import Heading from '@tiptap/extension-heading';
import Link from '@tiptap/extension-link';
import Table from '@tiptap/extension-table';
import TableRow from '@tiptap/extension-table-row';
import TableCell from '@tiptap/extension-table-cell';
import { GuideButton, GuideCallout, GuideGallery, GuideSkillCard } from './GuideBlocks';

export type GuideHeading = { id:string; text:string; level:number };

function plainText(node: JSONContent): string {
  return (node.text || '') + (node.content || []).map(plainText).join('');
}

/** Stable, unique heading anchors generated from the same JSON for previews and public pages. */
export function prepareGuideContent(content: JSONContent): { document: JSONContent; headings:GuideHeading[] } {
  const headings:GuideHeading[] = [];
  const used = new Set<string>();
  const assign = (node:JSONContent):JSONContent => {
    const mapped:JSONContent = {...node};
    if(node.type==='heading') {
      const text=plainText(node).trim() || 'Section';
      const base=text.toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g,'')
        .replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,65) || 'section';
      let id=base, suffix=2;
      while(used.has(id))id=base+'-'+suffix++;
      used.add(id);
      const level=Number(node.attrs?.level)||2;
      mapped.attrs={...node.attrs,id};
      headings.push({id,text,level});
    }
    if(node.content)mapped.content=node.content.map(assign);
    return mapped;
  };
  return {document:assign(content),headings};
}

export const guideExtensions = [
  StarterKit.configure({ heading: false }),
  Heading.extend({
    addAttributes() {
      return {
        ...this.parent?.(),
        id: {
          default: null,
          parseHTML: element => element.getAttribute('id'),
          renderHTML: attributes => attributes.id ? {id:attributes.id} : {}
        }
      };
    }
  }).configure({levels:[1,2,3]}),
  Image.configure({allowBase64:false}),
  Link.configure({openOnClick:true,autolink:true,linkOnPaste:true,HTMLAttributes:{rel:'noopener noreferrer'}}),
  Table.configure({resizable:false}),
  TableRow,
  TableCell,
  TableHeader,
  GuideButton,
  GuideCallout,
  GuideSkillCard,
  GuideGallery,
];

export default function GuideContent({content}:{content:JSONContent}) {
  const editor = useEditor({
    extensions: guideExtensions,
    content: prepareGuideContent(content).document,
    editable:false,
    immediatelyRender:false
  });
  return <div className="guide-rich-text"><EditorContent editor={editor}/></div>;
}
