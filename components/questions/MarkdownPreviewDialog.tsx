import React from 'react';
import { Button } from '../ui/Button';
import ReactMarkdown from "react-markdown"
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";

interface MarkdownPreviewDialogProps {
    isOpen: boolean;
    onClose: () => void;
    content: string;
    title: string;
}

export const MarkdownPreviewDialog: React.FC<MarkdownPreviewDialogProps> = ({
    isOpen,
    onClose,
    content,
    title
}) => {
    if (!isOpen) return null;


    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[80vh] flex flex-col">
                <div className="flex justify-between items-center p-6 border-b border-gray-200">
                    <h2 className="text-xl font-semibold text-gray-900">{title}</h2>
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={onClose}
                        className="text-gray-500 hover:text-gray-700"
                    >
                        ✕
                    </Button>
                </div>

                <div className="flex-1 overflow-auto p-6">
                    <div className="bg-gray-50 rounded-md p-4 min-h-[200px] border">
                        {content ? (
                            <div
                                className="prose prose-sm max-w-none"
                            >
                                <ReactMarkdown
                                    remarkPlugins={[remarkMath]}
                                    rehypePlugins={[rehypeKatex]}
                                    children={content}
                                />
                            </div>
                        ) : (
                            <p className="text-gray-400 italic text-center py-8">
                                No content to preview
                            </p>
                        )}
                    </div>
                </div>

                <div className="flex justify-end p-6 border-t border-gray-200">
                    <Button
                        variant="outline"
                        onClick={onClose}
                        className="bg-gray-100 hover:bg-gray-200 text-gray-700"
                    >
                        Close
                    </Button>
                </div>
            </div>
        </div>
    );
};

export default MarkdownPreviewDialog;