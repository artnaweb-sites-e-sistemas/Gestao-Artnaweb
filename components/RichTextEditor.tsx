import React, { useEffect } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Underline from '@tiptap/extension-underline';
import Placeholder from '@tiptap/extension-placeholder';
import Link from '@tiptap/extension-link';

interface RichTextEditorProps {
    content: string;
    onChange: (content: string) => void;
    placeholder?: string;
}

export const RichTextEditor: React.FC<RichTextEditorProps> = ({
    content,
    onChange,
    placeholder = 'Adicione uma descrição para o projeto...'
}) => {
    const editor = useEditor({
        extensions: [
            StarterKit.configure({
                heading: {
                    levels: [1, 2, 3],
                },
            }),
            Underline,
            Placeholder.configure({
                placeholder,
            }),
            Link.configure({
                openOnClick: false,
                HTMLAttributes: {
                    class: 'text-primary hover:underline cursor-pointer',
                },
            }),
        ],
        content,
        editorProps: {
            attributes: {
                class: 'prose prose-sm max-w-none focus:outline-none min-h-[150px] p-4',
            },
        },
        onUpdate: ({ editor }) => {
            const html = editor.getHTML();
            onChange(html);
        },
    });

    // Atualizar o conteúdo quando o prop content mudar externamente
    useEffect(() => {
        if (editor && content !== editor.getHTML()) {
            editor.commands.setContent(content);
        }
    }, [content, editor]);

    if (!editor) {
        return null;
    }

    return (
        <div className="border border-slate-200 dark:border-slate-700 rounded-lg overflow-hidden bg-white dark:bg-slate-800/50">
            {/* Barra de Ferramentas */}
            <div className="flex flex-wrap items-center gap-1 p-2 border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/80">
                {/* Títulos */}
                <select
                    onChange={(e) => {
                        const value = e.target.value;
                        if (value === 'p') {
                            editor.chain().focus().setParagraph().run();
                        } else {
                            const level = parseInt(value) as 1 | 2 | 3;
                            editor.chain().focus().toggleHeading({ level }).run();
                        }
                    }}
                    value={
                        editor.isActive('heading', { level: 1 })
                            ? '1'
                            : editor.isActive('heading', { level: 2 })
                                ? '2'
                                : editor.isActive('heading', { level: 3 })
                                    ? '3'
                                    : 'p'
                    }
                    className="px-2 py-1 text-xs font-medium border border-slate-300 dark:border-slate-600 rounded bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-300 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-600"
                >
                    <option value="p">Parágrafo</option>
                    <option value="1">Título 1</option>
                    <option value="2">Título 2</option>
                    <option value="3">Título 3</option>
                </select>

                <div className="w-px h-6 bg-slate-300 dark:bg-slate-600 mx-1"></div>

                {/* Formatação de Texto */}
                <ToolbarButton
                    onClick={() => editor.chain().focus().toggleBold().run()}
                    isActive={editor.isActive('bold')}
                    icon="format_bold"
                    title="Negrito (Ctrl+B)"
                />
                <ToolbarButton
                    onClick={() => editor.chain().focus().toggleItalic().run()}
                    isActive={editor.isActive('italic')}
                    icon="format_italic"
                    title="Itálico (Ctrl+I)"
                />
                <ToolbarButton
                    onClick={() => editor.chain().focus().toggleUnderline().run()}
                    isActive={editor.isActive('underline')}
                    icon="format_underlined"
                    title="Sublinhado (Ctrl+U)"
                />
                <ToolbarButton
                    onClick={() => editor.chain().focus().toggleStrike().run()}
                    isActive={editor.isActive('strike')}
                    icon="strikethrough_s"
                    title="Tachado"
                />

                <div className="w-px h-6 bg-slate-300 dark:bg-slate-600 mx-1"></div>

                {/* Listas */}
                <ToolbarButton
                    onClick={() => editor.chain().focus().toggleBulletList().run()}
                    isActive={editor.isActive('bulletList')}
                    icon="format_list_bulleted"
                    title="Lista com marcadores"
                />
                <ToolbarButton
                    onClick={() => editor.chain().focus().toggleOrderedList().run()}
                    isActive={editor.isActive('orderedList')}
                    icon="format_list_numbered"
                    title="Lista numerada"
                />

                <div className="w-px h-6 bg-slate-300 dark:bg-slate-600 mx-1"></div>

                {/* Citação e Código */}
                <ToolbarButton
                    onClick={() => editor.chain().focus().toggleBlockquote().run()}
                    isActive={editor.isActive('blockquote')}
                    icon="format_quote"
                    title="Citação"
                />
                <ToolbarButton
                    onClick={() => editor.chain().focus().toggleCodeBlock().run()}
                    isActive={editor.isActive('codeBlock')}
                    icon="code"
                    title="Bloco de código"
                />

                <div className="w-px h-6 bg-slate-300 dark:bg-slate-600 mx-1"></div>

                {/* Ações */}
                <ToolbarButton
                    onClick={() => editor.chain().focus().setHorizontalRule().run()}
                    isActive={false}
                    icon="horizontal_rule"
                    title="Linha horizontal"
                />
                <ToolbarButton
                    onClick={() => editor.chain().focus().undo().run()}
                    isActive={false}
                    icon="undo"
                    title="Desfazer (Ctrl+Z)"
                    disabled={!editor.can().undo()}
                />
                <ToolbarButton
                    onClick={() => editor.chain().focus().redo().run()}
                    isActive={false}
                    icon="redo"
                    title="Refazer (Ctrl+Y)"
                    disabled={!editor.can().redo()}
                />
            </div>

            {/* Editor de Conteúdo */}
            <div className="bg-white dark:bg-slate-800/30">
                <EditorContent editor={editor} />
            </div>
        </div>
    );
};

// Componente auxiliar para botões da barra de ferramentas
interface ToolbarButtonProps {
    onClick: () => void;
    isActive: boolean;
    icon: string;
    title: string;
    disabled?: boolean;
}

const ToolbarButton: React.FC<ToolbarButtonProps> = ({
    onClick,
    isActive,
    icon,
    title,
    disabled = false,
}) => {
    return (
        <button
            onClick={onClick}
            disabled={disabled}
            title={title}
            className={`
        p-1.5 rounded transition-colors
        ${isActive
                    ? 'bg-primary text-white'
                    : 'text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
                }
        ${disabled
                    ? 'opacity-30 cursor-not-allowed'
                    : 'cursor-pointer'
                }
      `}
        >
            <span className="material-symbols-outlined text-[18px]">{icon}</span>
        </button>
    );
};
