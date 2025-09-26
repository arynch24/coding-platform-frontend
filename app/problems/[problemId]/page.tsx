"use client";
import React, { useState, useRef, useEffect } from 'react';
import { ArrowLeft, Play, Upload, TriangleAlert, GripVertical, Plus, X, CheckCircle, XCircle, AlertCircle, Clock, Eye, EyeOff, Trash2, Code, List } from 'lucide-react';
import { useParams } from 'next/navigation';
import MonacoEditor from '@/components/MonacoEditor';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { tomorrow } from 'react-syntax-highlighter/dist/esm/styles/prism';
import ReactMarkdown from "react-markdown"
import { toast } from "sonner";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";

// --- Types ---
interface Language {
    id: string;
    boilerplate: string;
    language: {
        id: string;
        name: string;
        judge0Code: number;
    };
}
interface TestCase {
    id: string;
    input: string;
    output: string;
    explanation?: string;
    isSample: boolean;
    weight?: number;
}
interface CustomTestCase {
    id: string;
    input: string;
    output: string;
    isCustom: true;
}
interface ProblemTag {
    id: string;
    name: string;
}
interface ProblemDetail {
    id: string;
    title: string;
    problemStatement: string;
    constraints: string;
    problemTags: ProblemTag[];
    problemLanguage: Language[];
}
interface ProblemData {
    problemDetail: ProblemDetail;
    testcases: TestCase[];
}
interface RunResult {
    status: "Queued" | "Failed" | "Running" | "Done";
    result?: {
        runId: string;
        totalTestCases: number;
        passedTestCases: number;
        results: Array<{
            status: string;
            output: string;
            expectedOutput?: string;
            executionTime?: number;
            memory?: number;
            passed?: boolean;
            compilerError?: string;
            runtimeError?: string;
        }>;
    };
}
interface SubmissionHistoryItem {
    id: string;
    status: "Accepted" | "Partially Accepted" | "Rejected";
    language: { id: string; name: string };
    executionTime: number | null;
    memoryUsed: number | null;
    submittedAt: string;
    code: string;
}

// --- Custom Hook: Polling ---
const usePolling = <T,>(url: string | null, interval = 1000) => {
    const [data, setData] = useState<T | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const pollUrlRef = useRef<string | null>(null);
    const timeoutRef = useRef<number | null>(null);

    useEffect(() => {
        if (!url || url === pollUrlRef.current) return;

        if (timeoutRef.current) {
            window.clearTimeout(timeoutRef.current);
        }

        pollUrlRef.current = url;
        let cancelled = false;

        const poll = async () => {
            if (cancelled) return;
            setLoading(true);
            try {
                const res = await fetch(url, {
                    method: 'GET',
                    credentials: 'include',
                    headers: { 'Content-Type': 'application/json' },
                });
                const result = await res.json();
                const runData = result.data;
                setData(runData);

                if (runData.status === "Done" || runData.status === "Failed") {
                    pollUrlRef.current = null;
                    return;
                }

                if (!cancelled) {
                    const dynamicInterval = data === null ? 300 : interval;
                    timeoutRef.current = window.setTimeout(poll, dynamicInterval);
                }
            } catch (err) {
                if (!cancelled) {
                    setError("Failed to fetch result");
                    setLoading(false);
                }
            } finally {
                if (!cancelled) setLoading(false);
            }
        };

        poll();

        return () => {
            cancelled = true;
            if (timeoutRef.current) {
                window.clearTimeout(timeoutRef.current);
                timeoutRef.current = null;
            }
        };
    }, [url, interval]);

    return { data, loading, error };
};

// --- Main Component ---
const CodingProblemPage = () => {
    const [activeTab, setActiveTab] = useState<'description' | 'submissions'>('description');
    const [selectedLanguage, setSelectedLanguage] = useState<Language | null>(null);
    const [code, setCode] = useState('');
    const [isRunning, setIsRunning] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [runResult, setRunResult] = useState<RunResult | null>(null);
    const [leftPanelWidth, setLeftPanelWidth] = useState(45);
    const [editorHeight, setEditorHeight] = useState(55);
    const [isResizing, setIsResizing] = useState<'horizontal' | 'vertical' | null>(null);
    const [submissionHistory, setSubmissionHistory] = useState<SubmissionHistoryItem[]>([]);
    const [submissionsLoading, setSubmissionsLoading] = useState(false);
    const [customTestCases, setCustomTestCases] = useState<CustomTestCase[]>([]);
    const [showCustomInput, setShowCustomInput] = useState(false);
    const [inputValue, setInputValue] = useState('');
    const [outputValue, setOutputValue] = useState('');
    const [testCaseView, setTestCaseView] = useState<'testcases' | 'result'>('testcases');
    const [showSampleOnly, setShowSampleOnly] = useState(false);
    const editorRef = useRef<any>(null);
    const monacoRef = useRef<any>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const runIdRef = useRef<string | null>(null);
    const submissionIdRef = useRef<string | null>(null);

    const [pollRunId, setPollRunId] = useState<string | null>(null);
    const [pollSubmissionId, setPollSubmissionId] = useState<string | null>(null);

    const params = useParams();
    const problemId = params.problemId as string;

    const [problemData, setProblemData] = useState<ProblemData | null>(null);
    const [loadingProblem, setLoadingProblem] = useState(true);

    // --- Tabs for Submissions ---
    const [openTabs, setOpenTabs] = useState<Array<{
        id: string;
        status: string;
        language: string;
        executionTime: number | null;
        memoryUsed: number | null;
        submittedAt: string;
        code: string;
    }>>([]);
    const [activeTabId, setActiveTabId] = useState<string | null>(null);

    // --- Fetch Problem Data ---
    useEffect(() => {
        const fetchProblemData = async () => {
            if (!problemId) return;
            setLoadingProblem(true);
            try {
                const url = `${process.env.NEXT_PUBLIC_CODING_BACKEND_URL}/problems/detail/${problemId}`;
                const res = await fetch(url, { credentials: 'include' });
                if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
                const data = await res.json();
                setProblemData(data.data);
            } catch (error) {
                console.error("Error fetching problem:", error);
                toast.error("Failed to load problem. Please try again.");
            } finally {
                setLoadingProblem(false);
            }
        };
        fetchProblemData();
    }, [problemId]);

    // Initialize selected language and code
    useEffect(() => {
        if (problemData && problemData.problemDetail.problemLanguage.length > 0) {
            const defaultLang = problemData.problemDetail.problemLanguage[0];
            setSelectedLanguage(defaultLang);
            setCode(defaultLang.boilerplate);
        }
    }, [problemData]);

    // --- Load Saved Code from LocalStorage ---
    useEffect(() => {
        if (!problemId || !selectedLanguage || activeTabId !== null) return;
        const saved = localStorage.getItem(`problem_${problemId}_lang_${selectedLanguage.language.id}`);
        if (saved) {
            try {
                setCode(JSON.parse(saved).code);
            } catch (e) {
                console.warn("Failed to parse saved code", e);
            }
        }
    }, [problemId, selectedLanguage, activeTabId]);

    // --- Polling for Run Result ---
    const { data: polledRunResult } = usePolling<RunResult>(
        pollRunId ? `${process.env.NEXT_PUBLIC_CODING_BACKEND_URL}/run/${pollRunId}` : null
    );

    // --- Polling for Submission Result ---
    const { data: polledSubmissionResult } = usePolling<RunResult>(
        pollSubmissionId ? `${process.env.NEXT_PUBLIC_CODING_BACKEND_URL}/submissions/active/${pollSubmissionId}` : null
    );

    // --- Update Run Result from Polling ---
    useEffect(() => {
        if (polledRunResult) {
            setRunResult({
                status: polledRunResult.status,
                result: polledRunResult.result
            });
            setTestCaseView('result');
            if (polledRunResult.status === "Done" || polledRunResult.status === "Failed") {
                setIsRunning(false);
                setPollRunId(null);
            }
        }
    }, [polledRunResult]);

    // --- Update Submission Result ---
    useEffect(() => {
        if (polledSubmissionResult && submissionIdRef.current) {
            if (polledSubmissionResult.status === "Done" || polledSubmissionResult.status === "Failed") {
                setIsSubmitting(false);
                submissionIdRef.current = null;
                fetchSubmissionHistory();
            }
        }
    }, [polledSubmissionResult]);

    // --- Fetch Submission History ---
    const fetchSubmissionHistory = async () => {
        if (!problemId) return;
        setSubmissionsLoading(true);
        try {
            const res = await fetch(`${process.env.NEXT_PUBLIC_CODING_BACKEND_URL}/submissions/history/${problemId}`, {
                credentials: 'include',
            });
            const data = await res.json();
            setSubmissionHistory(data.data.submissions);
        } catch (error) {
            console.error("Failed to load submission history:", error);
        } finally {
            setSubmissionsLoading(false);
        }
    };

    useEffect(() => {
        if (activeTab === 'submissions') {
            fetchSubmissionHistory();
        }
    }, [activeTab, problemId]);

    // --- Initialize Monaco Editor ---
    useEffect(() => {
        if (!selectedLanguage) return;
        if (window.monaco) {
            initializeEditor();
            return;
        }

        return () => {
            if (editorRef.current) editorRef.current.dispose();
        };
    }, [selectedLanguage]);

    const initializeEditor = () => {
        if (editorRef.current) editorRef.current.dispose();
        const langMap: Record<string, string> = {
            'Python': 'python',
            'C++': 'cpp',
            'Java': 'java',
            'JavaScript': 'javascript',
        };
        const monacoLang = langMap[selectedLanguage?.language.name || 'Python'] || 'plaintext';
        const model = monacoRef.current.editor.createModel(code, monacoLang);
        editorRef.current = monacoRef.current.editor.create(
            document.getElementById('monaco-editor')!,
            {
                model,
                theme: 'vs-dark',
                fontSize: 14,
                lineNumbers: 'on',
                automaticLayout: true,
                minimap: { enabled: false },
                wordWrap: 'on',
                mouseWheelZoom: true,
                folding: true,
                padding: { top: 15, bottom: 15 },
                scrollBeyondLastLine: false,
                renderWhitespace: 'selection',
                contextmenu: true,
                quickSuggestions: true,
                suggestOnTriggerCharacters: true,
                readOnly: activeTabId !== null, // Make readonly when viewing submissions
            }
        );

        // Only allow editing when in main editor
        if (activeTabId === null) {
            editorRef.current.onDidChangeModelContent(() => {
                const newCode = editorRef.current.getValue();
                setCode(newCode);

                // Save to localStorage only if in main editor
                if (activeTabId === null && problemId && selectedLanguage) {
                    localStorage.setItem(
                        `problem_${problemId}_lang_${selectedLanguage.language.id}`,
                        JSON.stringify({ code: newCode, timestamp: Date.now() })
                    );
                }
            });
        }
    };

    // Update editor content and readonly state when active tab changes
    useEffect(() => {
        if (editorRef.current && monacoRef.current) {
            const currentCode = activeTabId === null ?
                (selectedLanguage ? selectedLanguage.boilerplate : '') :
                (openTabs.find(t => t.id === activeTabId)?.code || '');

            // Update the model content
            const model = editorRef.current.getModel();
            if (model) {
                model.setValue(currentCode);
            }

            // Update readonly state
            editorRef.current.updateOptions({
                readOnly: activeTabId !== null
            });
        }
    }, [activeTabId, openTabs, selectedLanguage]);

    // --- Handle Language Change ---
    const handleLanguageChange = (langId: string) => {
        const lang = problemData?.problemDetail.problemLanguage.find(l => l.id === langId);
        if (lang) {
            setSelectedLanguage(lang);
            if (activeTabId === null) {
                setCode(lang.boilerplate);
            }
        }
    };

    // --- Get All Test Cases ---
    const getAllTestCases = () => {
        const testcases = problemData?.testcases.map(tc => ({
            input: tc.input.trim(),
            output: tc.output.trim(),
        })) || [];
        const customTCs = customTestCases.map(tc => ({
            input: tc.input.trim(),
            output: tc.output.trim(),
        }));
        return [...testcases, ...customTCs];
    };

    // --- Run Code ---
    const runCode = async () => {
        if (!problemData || !selectedLanguage || !code.trim()) {
            toast.info("Please write some code first.");
            return;
        }
        const allTestCases = getAllTestCases();
        if (allTestCases.length === 0) {
            toast.info("No test cases available to run.");
            return;
        }
        setIsRunning(true);
        setRunResult(null);
        setPollRunId(null);
        try {
            const res = await fetch(`${process.env.NEXT_PUBLIC_CODING_BACKEND_URL}/run`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({
                    problemId: problemData.problemDetail.id,
                    testCases: allTestCases,
                    code,
                    languageId: selectedLanguage.language.id,
                    languageCode: JSON.stringify(selectedLanguage.language.judge0Code),
                }),
            });
            const data = await res.json();
            runIdRef.current = data.data.runId;
            setPollRunId(data.data.runId);
        } catch (error) {
            console.error("Run request failed:", error);
            toast.error("Failed to run code. Please try again.");
            setIsRunning(false);
        }
    };

    // --- Submit Code ---
    const submitCode = async () => {
        if (!problemData || !selectedLanguage || !code.trim()) {
            toast.info("Please write some code first.");
            return;
        }
        setIsSubmitting(true);
        setPollSubmissionId(null);
        try {
            const res = await fetch(`${process.env.NEXT_PUBLIC_CODING_BACKEND_URL}/submissions`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({
                    problemId: problemData.problemDetail.id,
                    languageId: selectedLanguage.language.id,
                    code,
                    submissionTime: new Date().toISOString(),
                    languageCode: JSON.stringify(selectedLanguage.language.judge0Code),
                }),
            });
            const data = await res.json();
            setPollSubmissionId(data.data.submissionId);
        } catch (error) {
            console.error("Submission failed:", error);
            toast.error("Failed to submit code. Please try again.");
            setIsSubmitting(false);
        } finally {
            setIsSubmitting(false);
        }
    };

    // --- Add Custom Test Case ---
    const addCustomTestCase = () => {
        if (!inputValue.trim() || !outputValue.trim()) {
            toast.error("Both input and expected output are required.");
            return;
        }
        const newTestCase: CustomTestCase = {
            id: `custom-${Date.now()}`,
            input: inputValue,
            output: outputValue,
            isCustom: true,
        };
        setCustomTestCases(prev => [...prev, newTestCase]);
        setInputValue('');
        setOutputValue('');
        setShowCustomInput(false);
    };

    // --- Remove Custom Test Case ---
    const removeCustomTestCase = (id: string) => {
        setCustomTestCases(prev => prev.filter(tc => tc.id !== id));
    };

    const switchToMainEditor = () => {
        setActiveTabId(null);
    };

    // --- Mouse Down Handler ---
    const handleMouseDown = (type: 'horizontal' | 'vertical') => (e: React.MouseEvent) => {
        e.preventDefault();
        setIsResizing(type);
    };

    // --- Mouse Move Effect ---
    useEffect(() => {
        const handleMouseMove = (e: MouseEvent) => {
            if (!isResizing || !containerRef.current) return;
            const rect = containerRef.current.getBoundingClientRect();
            if (isResizing === 'horizontal') {
                const newWidth = ((e.clientX - rect.left) / rect.width) * 100;
                setLeftPanelWidth(Math.max(25, Math.min(75, newWidth)));
            } else if (isResizing === 'vertical') {
                const rightPanel = containerRef.current.querySelector('.right-panel') as HTMLElement;
                if (rightPanel) {
                    const rightRect = rightPanel.getBoundingClientRect();
                    const newHeight = ((e.clientY - rightRect.top) / rightRect.height) * 100;
                    setEditorHeight(Math.max(0, Math.min(90, newHeight)));
                }
            }
        };
        const handleMouseUp = () => setIsResizing(null);
        if (isResizing) {
            document.addEventListener('mousemove', handleMouseMove);
            document.addEventListener('mouseup', handleMouseUp);
        }
        return () => {
            document.removeEventListener('mousemove', handleMouseMove);
            document.removeEventListener('mouseup', handleMouseUp);
        };
    }, [isResizing]);

    // --- Get visible test cases ---
    const getVisibleTestCases = () => {
        if (!problemData || !problemData.testcases) return [];
        return showSampleOnly
            ? problemData.testcases.filter(tc => tc.isSample)
            : problemData.testcases;
    };


    // --- Format Date: 12 Aug 2025 ---
    const formatDate = (dateString: string) => {
        const date = new Date(dateString);
        return date.toLocaleDateString('en-US', {
            day: 'numeric',
            month: 'short',
            year: 'numeric'
        }); // e.g., "23 Aug 2025"
    };

    // --- Status Badge with Metrics ---
    const StatusBadge = ({ status, executionTime, memoryUsed }: {
        status: string;
        executionTime?: number | null;
        memoryUsed?: number | null;
    }) => {
        const getStatusStyles = (status: string) => {
            switch (status) {
                case 'Accepted': return 'bg-green-900 text-green-200 border-green-700';
                case 'Partially Accepted': return 'bg-yellow-900 text-yellow-200 border-yellow-700';
                case 'Rejected': return 'bg-red-900 text-red-200 border-red-700';
                default: return 'bg-gray-700 text-gray-300 border-gray-600';
            }
        };

        return (
            <div className="flex items-center gap-1">
                <span className={`px-2 py-0.5 rounded-full text-xs font-semibold border ${getStatusStyles(status)}`}>
                    {status}
                </span>
                {executionTime !== null && (
                    <span className="text-xs text-gray-400">{executionTime}ms</span>
                )}
                {memoryUsed && (
                    <span className="text-xs text-gray-400">{Math.round(memoryUsed)} KB</span>
                )}
            </div>
        );
    };

    // --- Sync active tab with editor code ---
    useEffect(() => {
        if (activeTabId === null) {
            if (selectedLanguage) setCode(selectedLanguage.boilerplate);
        } else {
            const tab = openTabs.find(t => t.id === activeTabId);
            if (tab) setCode(tab.code);
        }
    }, [activeTabId, openTabs, selectedLanguage]);

    if (loadingProblem) {
        return (
            <div className="flex items-center justify-center h-screen bg-gray-900 text-white">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
                <span className="ml-3">Loading problem...</span>
            </div>
        );
    }

    return (
        <div className="h-screen w-screen bg-gray-900 text-gray-100 flex flex-col" ref={containerRef}>
            {/* Header */}
            <header className="bg-gray-800 border-b border-gray-700 px-6 py-4 flex-shrink-0 shadow-lg">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <button className="p-2 hover:bg-gray-700 rounded-lg transition-colors">
                            <ArrowLeft className="h-5 w-5 text-gray-300" />
                        </button>
                        <h1 className="text-xl font-bold text-white">{problemData?.problemDetail.title}</h1>

                        {/*problem difficulty pending*/}
                        {/* <span className="px-3 py-1 rounded-full text-xs font-semibold bg-green-900 text-green-200">
                            Easy
                        </span> */}
                    </div>
                    <div className="flex items-center gap-3">
                        <select
                            value={selectedLanguage?.id || ''}
                            onChange={(e) => handleLanguageChange(e.target.value)}
                            className="bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                        >
                            {problemData?.problemDetail.problemLanguage.map(lang => (
                                <option key={lang.id} value={lang.id}>
                                    {lang.language.name}
                                </option>
                            ))}
                        </select>
                        <button
                            onClick={runCode}
                            disabled={isRunning || activeTabId !== null}
                            className="bg-green-600 hover:bg-green-700 disabled:bg-green-800 disabled:opacity-50 text-white px-4 py-2 rounded-lg flex items-center gap-2 font-medium transition-colors"
                        >
                            <Play className="h-4 w-4" />
                            {isRunning ? 'Running...' : 'Run'}
                        </button>
                        <button
                            onClick={submitCode}
                            disabled={isSubmitting || activeTabId !== null}
                            className="bg-blue-600 hover:bg-blue-700 disabled:bg-blue-800 disabled:opacity-50 text-white px-4 py-2 rounded-lg flex items-center gap-2 font-medium transition-colors"
                        >
                            <Upload className="h-4 w-4" />
                            {isSubmitting ? 'Submitting...' : 'Submit'}
                        </button>
                    </div>
                </div>
            </header>

            <div className="flex flex-1 overflow-hidden">
                {/* Left Panel */}
                <div className="bg-gray-800 border-r border-gray-700 flex flex-col" style={{ width: `${leftPanelWidth}%` }}>
                    <div className="px-6 py-2 border-b border-gray-700 bg-gray-750 flex-shrink-0">
                        <div className="flex gap-2">
                            <button
                                onClick={() => setActiveTab('description')}
                                className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${activeTab === 'description'
                                    ? 'bg-gray-700 text-blue-400 shadow-sm'
                                    : 'text-gray-400 hover:text-gray-200 hover:bg-gray-700'
                                    }`}
                            >
                                Description
                            </button>
                            <button
                                onClick={() => setActiveTab('submissions')}
                                className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${activeTab === 'submissions'
                                    ? 'bg-gray-700 text-blue-400 shadow-sm'
                                    : 'text-gray-400 hover:text-gray-200 hover:bg-gray-700'
                                    }`}
                            >
                                Submissions
                            </button>
                        </div>
                    </div>

                    {activeTab === 'description' && (
                        <div className="flex-1 p-6 overflow-y-auto scrollbar-hide">
                            <div className="prose prose-invert max-w-none">
                                <div className="text-gray-300 leading-relaxed mb-6 whitespace-pre-line">
                                    <div className="max-w-none">
                                        <ReactMarkdown
                                            remarkPlugins={[remarkMath]}
                                            rehypePlugins={[rehypeKatex]}
                                            children={problemData?.problemDetail.problemStatement || ''}
                                        />
                                    </div>
                                </div>
                                <h4 className="font-semibold text-gray-100 mb-2">Constraints</h4>
                                <div className="text-gray-300 mb-6 text-sm bg-gray-700 p-4 rounded-lg border border-gray-600">
                                    <div>
                                        <ReactMarkdown
                                            remarkPlugins={[remarkMath]}
                                            rehypePlugins={[rehypeKatex]}
                                            children={problemData?.problemDetail.constraints || ''}
                                        />
                                    </div>
                                </div>
                                <div className="flex flex-wrap gap-2 mb-6">
                                    {problemData?.problemDetail.problemTags.map(tag => (
                                        <span key={tag.id} className="px-3 py-1 rounded-full text-xs font-medium bg-gray-700 text-gray-300 border border-gray-600">
                                            {tag.name}
                                        </span>
                                    ))}
                                </div>
                            </div>
                        </div>
                    )}

                    {activeTab === 'submissions' && (
                        <div className="flex-1 p-6 overflow-y-auto scrollbar-hide">
                            <h3 className="text-lg font-semibold text-white mb-4">Submission History</h3>
                            {submissionsLoading ? (
                                <div className="flex justify-center py-8">
                                    <div className="animate-spin h-6 w-6 border-b-2 border-blue-500 rounded-full"></div>
                                </div>
                            ) : submissionHistory.length === 0 ? (
                                <p className="text-gray-400">No submissions yet.</p>
                            ) : (
                                <div className="space-y-3">
                                    {submissionHistory.map((submission, i) => {
                                        const formattedDate = formatDate(submission.submittedAt);

                                        return (
                                            <div
                                                key={i}
                                                className="p-4 bg-gray-700 rounded-lg border border-gray-600 hover:bg-gray-650 cursor-pointer transition-colors"
                                                onClick={() => {
                                                    const exists = openTabs.find(t => t.id === submission.id);
                                                    if (!exists) {
                                                        setOpenTabs(prev => [
                                                            ...prev,
                                                            {
                                                                id: submission.id,
                                                                status: submission.status,
                                                                language: submission.language.name,
                                                                executionTime: submission.executionTime,
                                                                memoryUsed: submission.memoryUsed,
                                                                submittedAt: submission.submittedAt,
                                                                code: submission.code,
                                                            }
                                                        ]);
                                                    }
                                                    setActiveTabId(submission.id);
                                                }}
                                            >
                                                <div className="flex justify-between items-start mb-2">
                                                    <StatusBadge
                                                        status={submission.status}
                                                        executionTime={submission.executionTime}
                                                        memoryUsed={submission.memoryUsed}
                                                    />
                                                    <span className="text-xs text-gray-400">{formattedDate}</span>
                                                </div>
                                                <div className="flex justify-between items-center text-sm">
                                                    <span className="text-gray-300">{submission.language.name}</span>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    )}
                    <div className='h-5'>

                    </div>
                </div>

                {/* Vertical Resizer */}
                <div
                    className="w-1 bg-gray-600 hover:bg-gray-500 cursor-col-resize flex items-center justify-center transition-colors"
                    onMouseDown={handleMouseDown('horizontal')}
                >
                    <GripVertical className="h-4 w-4 text-gray-500" />
                </div>

                {/* Right Panel */}
                <div className="flex flex-col right-panel overflow-hidden" style={{ width: `${100 - leftPanelWidth}%` }}>
                    <div className="flex items-center bg-gray-750 border-b border-gray-600 scrollbar-hide ">
                        {/* Main Editor Tab */}
                        <div
                            className={`flex-shrink-0 px-4 py-2 border-r border-gray-600 cursor-pointer text-sm font-medium flex items-center gap-2
                                    ${activeTabId === null ? 'bg-gray-700 text-white' : 'text-gray-300 hover:text-white'}`}
                            onClick={() => {
                                setActiveTabId(null);
                            }}
                        >
                            <Code className="h-3 w-3" />
                            Main Editor
                        </div>

                        {/* Submission Tabs */}
                        {openTabs.map(tab => {
                            const date = new Date(tab.submittedAt).toLocaleDateString('en-US', {
                                day: 'numeric',
                                month: 'short'
                            }); // "23 Aug"

                            return (
                                <div
                                    key={tab.id}
                                    className={`flex-shrink-0 px-4 py-2 border-r border-gray-600 cursor-pointer text-xs flex items-center gap-2
                                            ${activeTabId === tab.id ? 'bg-gray-700 text-white' : 'text-gray-400 hover:text-gray-200'}`}
                                    onClick={() => {
                                        setActiveTabId(tab.id);
                                    }}
                                >
                                    <span className="font-medium">Submission</span>
                                    <span className="text-gray-500">{date}</span>
                                    <button
                                        className="ml-1 text-gray-500 hover:text-red-400"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            setOpenTabs(prev => prev.filter(t => t.id !== tab.id));
                                            if (activeTabId === tab.id) {
                                                setActiveTabId(null);
                                            }
                                        }}
                                    >
                                        <X className="h-3 w-3" />
                                    </button>
                                </div>
                            );
                        })}
                    </div>

                    <div className="bg-gray-800 flex flex-col" style={{ height: `${editorHeight}%` }}>
                        {/* Editor Content */}
                        <div className="flex-1 p-4">
                            {activeTabId === null ? (
                                // --- Main Editor: Show Monaco Editor ---
                                <MonacoEditor
                                    value={code}
                                    language={{
                                        'Python': 'python',
                                        'C++': 'cpp',
                                        'Java': 'java',
                                        'JavaScript': 'javascript',
                                    }[selectedLanguage?.language.name || 'Python'] || 'plaintext'}
                                    onChange={setCode}
                                    readOnly={false}
                                    theme="vs-dark"
                                />
                            ) : (<div className="flex-1 flex flex-col overflow-y-auto h-[500px] scrollbar-hide">
                                {activeTabId !== null && (
                                    <div className=" py-4 bg-gray-750 text-sm">
                                        <div className="flex flex-wrap gap-4 items-center">
                                            <StatusBadge
                                                status={openTabs.find(t => t.id === activeTabId)?.status || ''}
                                                executionTime={openTabs.find(t => t.id === activeTabId)?.executionTime}
                                                memoryUsed={openTabs.find(t => t.id === activeTabId)?.memoryUsed}
                                            />
                                            <span className="text-gray-300">
                                                Date: <span className="text-gray-400">
                                                    {formatDate(openTabs.find(t => t.id === activeTabId)?.submittedAt || '')}
                                                </span>
                                            </span>
                                            <span className="text-yellow-400 text-xs">
                                                Read-only submission
                                            </span>
                                        </div>
                                    </div>
                                )}
                                <div className="bg-gray-800 rounded-lg border border-gray-600    flex flex-col">
                                    <div className="p-3 border-b border-gray-600 bg-gray-750 flex justify-between items-center">
                                        <span className="text-sm font-mono text-gray-300">
                                            {openTabs.find(t => t.id === activeTabId)?.language} • Read-only
                                        </span>
                                    </div>
                                    <div className="flex-1 p-4 overflow-auto">
                                        <SyntaxHighlighter
                                            language={
                                                {
                                                    'Python': 'python',
                                                    'C++': 'cpp',
                                                    'Java': 'java',
                                                    'JavaScript': 'javascript',
                                                }[selectedLanguage?.language.name || 'Python'] || 'plaintext'
                                            }
                                            style={tomorrow}
                                            customStyle={{
                                                margin: 0,
                                                padding: '1rem',
                                                borderRadius: '0.5rem',
                                                fontSize: '14px',
                                                lineHeight: '1.5',
                                                backgroundColor: '#1e1e1e',
                                                fontFamily: `'Fira Code', 'Monaco', 'Menlo', monospace`,
                                            }}
                                            wrapLongLines={true}
                                        >
                                            {code}
                                        </SyntaxHighlighter>
                                    </div>
                                </div>
                            </div>
                            )}
                        </div>
                    </div>

                    {/* Horizontal Resizer */}
                    <div
                        className="h-1 bg-gray-600 hover:bg-gray-500 cursor-row-resize transition-colors z-100"
                        onMouseDown={handleMouseDown('vertical')}
                    >
                        <GripVertical className="h-4 w-4 text-gray-500 rotate-90 mx-auto" />
                    </div>

                    {/* Test Cases & Results */}
                    <div className="bg-gray-800 flex flex-col z-100 " style={{ height: `${100 - editorHeight}%` }}>
                        <div className="px-6 py-3 bg-gray-750 border-b border-gray-600 flex items-center justify-between flex-shrink-0">
                            <div className="flex items-center gap-4">
                                <div className="flex gap-2">
                                    <button
                                        onClick={() => setTestCaseView('testcases')}
                                        className={`px-3 py-1 text-sm font-medium rounded transition-colors ${testCaseView === 'testcases'
                                            ? 'bg-gray-600 text-white'
                                            : 'text-gray-400 hover:text-gray-200'
                                            }`}
                                    >
                                        <List className="h-4 w-4 inline mr-1" />
                                        Testcases
                                    </button>
                                    <button
                                        onClick={() => setTestCaseView('result')}
                                        className={`px-3 py-1 text-sm font-medium rounded transition-colors ${testCaseView === 'result'
                                            ? 'bg-gray-600 text-white'
                                            : 'text-gray-400 hover:text-gray-200'
                                            }`}
                                    >
                                        <Code className="h-4 w-4 inline mr-1" />
                                        Result
                                    </button>
                                </div>
                                {/* {testCaseView === 'testcases' && (
                                    <div className="flex items-center gap-2">
                                        <button
                                            onClick={() => setShowSampleOnly(!showSampleOnly)}
                                            className="flex items-center gap-1 text-blue-400 hover:text-blue-300 text-sm font-medium"
                                        >
                                            {showSampleOnly ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
                                            {showSampleOnly ? 'Show All' : 'Sample Only'}
                                        </button>
                                    </div>
                                )} */}
                            </div>
                            {testCaseView === 'testcases' && (
                                <button
                                    onClick={() => setShowCustomInput(!showCustomInput)}
                                    className="flex items-center gap-1 text-green-400 hover:text-green-300 text-sm font-medium"
                                >
                                    <Plus className="h-4 w-4" />
                                    {showCustomInput ? 'Cancel' : 'Add Test'}
                                </button>
                            )}
                        </div>

                        {showCustomInput && (
                            <div className="m-6 rounded-xl px-6 py-4 bg-gray-700 border-b border-gray-600 space-y-3 flex-shrink-0 flex justify-between">
                                <div className='w-1/3'>
                                    <label className="block text-sm font-medium text-gray-300 mb-1">Input</label>
                                    <textarea
                                        placeholder="Enter test input..."
                                        value={inputValue}
                                        onChange={(e) => setInputValue(e.target.value)}
                                        className="w-full p-3 border border-gray-600 rounded-lg bg-gray-800 text-gray-100 text-sm resize-none focus:outline-none focus:ring-1 focus:ring-blue-500"
                                        rows={3}
                                    />
                                </div>
                                <div className='w-1/3'>
                                    <label className="block text-sm font-medium text-gray-300 mb-1">Expected Output</label>
                                    <textarea
                                        placeholder="Enter expected output..."
                                        value={outputValue}
                                        onChange={(e) => setOutputValue(e.target.value)}
                                        className="w-full p-3 border border-gray-600 rounded-lg bg-gray-800 text-gray-100 text-sm resize-none focus:outline-none focus:ring-1 focus:ring-blue-500"
                                        rows={3}
                                    />
                                </div>
                                <div className="flex items-end gap-2 mb-5">
                                    <button
                                        onClick={addCustomTestCase}
                                        className="h-fit bg-green-600 hover:bg-green-700 text-white px-3 py-2 rounded-lg text-sm transition-colors"
                                    >
                                        Add Test
                                    </button>
                                    <button
                                        onClick={() => setShowCustomInput(false)}
                                        className=" h-fit px-3 py-2 border border-gray-600 rounded-lg text-sm hover:bg-gray-600 transition-colors"
                                    >
                                        Cancel
                                    </button>
                                </div>
                            </div>
                        )}

                        <div className="flex-1 p-6 overflow-y-auto scrollbar-hide">
                            {testCaseView === 'testcases' ? (
                                <div className="space-y-4">
                                    {getVisibleTestCases().map((testCase, idx) => (
                                        <div key={testCase.id} className="bg-gray-700 rounded-lg border border-gray-600">
                                            <div className="px-4 py-3 border-b border-gray-600 flex items-center justify-between">
                                                <div className="flex items-center gap-2">
                                                    <span className="font-semibold text-gray-200">
                                                        Test Case {idx + 1}
                                                    </span>
                                                    {testCase.isSample && (
                                                        <span className="px-2 py-1 rounded text-xs font-medium bg-blue-900 text-blue-200">
                                                            Sample
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                            <div className="p-4 space-y-3">
                                                <div>
                                                    <label className="block text-sm font-medium text-gray-300 mb-1">Input</label>
                                                    <pre className="bg-gray-800 p-3 rounded border border-gray-600 text-sm font-mono text-gray-100 overflow-x-auto">
                                                        {testCase.input}
                                                    </pre>
                                                </div>
                                                <div>
                                                    <label className="block text-sm font-medium text-gray-300 mb-1">Expected Output</label>
                                                    <pre className="bg-gray-800 p-3 rounded border border-green-600 text-sm font-mono text-green-200 overflow-x-auto">
                                                        {testCase.output}
                                                    </pre>
                                                </div>
                                                {testCase.explanation && (
                                                    <div>
                                                        <label className="block text-sm font-medium text-gray-300 mb-1">Explanation</label>
                                                        <p className="text-sm text-gray-400 p-3 bg-gray-800 rounded border border-gray-600">
                                                            {testCase.explanation}
                                                        </p>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    ))}
                                    {customTestCases.map((testCase, idx) => (
                                        <div key={testCase.id} className="bg-gray-700 rounded-lg border border-gray-600">
                                            <div className="px-4 py-3 border-b border-gray-600 flex items-center justify-between">
                                                <div className="flex items-center gap-2">
                                                    <span className="font-semibold text-gray-200">
                                                        Custom Test {idx + 1}
                                                    </span>
                                                    <span className="px-2 py-1 rounded text-xs font-medium bg-purple-900 text-purple-200">
                                                        Custom
                                                    </span>
                                                </div>
                                                <button
                                                    onClick={() => removeCustomTestCase(testCase.id)}
                                                    className="text-red-400 hover:text-red-300 p-1 rounded hover:bg-gray-600 transition-colors"
                                                >
                                                    <Trash2 className="h-4 w-4" />
                                                </button>
                                            </div>
                                            <div className="p-4 space-y-3">
                                                <div>
                                                    <label className="block text-sm font-medium text-gray-300 mb-1">Input</label>
                                                    <pre className="bg-gray-800 p-3 rounded border border-gray-600 text-sm font-mono text-gray-100 overflow-x-auto">
                                                        {testCase.input}
                                                    </pre>
                                                </div>
                                                <div>
                                                    <label className="block text-sm font-medium text-gray-300 mb-1">Expected Output</label>
                                                    <pre className="bg-gray-800 p-3 rounded border border-green-600 text-sm font-mono text-green-200 overflow-x-auto">
                                                        {testCase.output}
                                                    </pre>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div className="space-y-4">
                                    {runResult?.result ? (
                                        <>
                                            <div className="flex items-center justify-between mb-4 p-3 bg-gray-700 rounded-lg border border-gray-600">
                                                <div className="flex items-center gap-3">
                                                    <span className="text-lg font-semibold text-gray-200">Test Results</span>
                                                    <span className={`px-2 py-1 rounded-full text-xs font-semibold
                                        ${runResult.status === 'Done' ? 'bg-green-900 text-green-200' :
                                                            runResult.status === 'Failed' ? 'bg-red-900 text-red-200' :
                                                                'bg-yellow-900 text-yellow-200'}`}>
                                                        {runResult.status}
                                                    </span>
                                                    <span className="text-sm text-gray-300">
                                                        {runResult.result.passedTestCases} / {runResult.result.totalTestCases} passed
                                                    </span>
                                                </div>
                                            </div>
                                            {runResult.result.results.map((res, idx) => {
                                                const isCustom = idx >= (problemData?.testcases.length || 0);
                                                const label = isCustom
                                                    ? `Custom Test ${idx - (problemData?.testcases.length || 0) + 1}`
                                                    : `Test Case ${idx + 1}`;
                                                let Icon, color, bg;
                                                if (res.compilerError) {
                                                    Icon = XCircle;
                                                    color = 'text-red-400';
                                                    bg = 'bg-red-900/20 border-red-700';
                                                } else if (res.runtimeError) {
                                                    Icon = TriangleAlert;
                                                    color = 'text-yellow-400';
                                                    bg = 'bg-yellow-900/20 border-yellow-700';
                                                } else if (res.status === 'Accepted') {
                                                    Icon = CheckCircle;
                                                    color = 'text-green-400';
                                                    bg = 'bg-green-900/20 border-green-700';
                                                } else {
                                                    Icon = XCircle;
                                                    color = 'text-red-400';
                                                    bg = 'bg-red-900/20 border-red-700';
                                                }
                                                return (
                                                    <div key={idx} className={`p-4 rounded-lg border ${bg} shadow-sm`}>
                                                        <div className="flex items-center gap-2 mb-3">
                                                            <Icon className={`h-5 w-5 ${color}`} />
                                                            <strong className={`font-medium ${color}`}>
                                                                {res.compilerError ? 'Compile Error' :
                                                                    res.runtimeError ? 'Runtime Error' :
                                                                        res.status}
                                                            </strong>
                                                            <span className="text-gray-400 text-sm">({label})</span>
                                                        </div>
                                                        {res.compilerError && (
                                                            <div className="mb-3">
                                                                <label className="block text-sm font-medium text-red-300 mb-1">Compile Error</label>
                                                                <pre className="text-red-100 bg-red-900/40 p-3 rounded border border-red-700 text-sm font-mono overflow-x-auto">
                                                                    {res.compilerError}
                                                                </pre>
                                                            </div>
                                                        )}
                                                        {res.runtimeError && !res.compilerError && (
                                                            <div className="mb-3">
                                                                <label className="block text-sm font-medium text-yellow-300 mb-1">Runtime Error</label>
                                                                <pre className="text-yellow-100 bg-yellow-900/40 p-3 rounded border border-yellow-700 text-sm font-mono overflow-x-auto">
                                                                    {res.runtimeError}
                                                                </pre>
                                                            </div>
                                                        )}
                                                        {!res.compilerError && !res.runtimeError && (
                                                            <>
                                                                <div className="mb-2">
                                                                    <label className="block text-sm font-medium text-gray-300 mb-1">Output</label>
                                                                    <pre className="bg-gray-800 p-3 rounded border border-gray-600 text-sm font-mono text-gray-100 overflow-x-auto max-h-32 overflow-y-auto">
                                                                        {res.output || '<blank>'}
                                                                    </pre>
                                                                </div>
                                                                <div className="mb-2">
                                                                    <label className="block text-sm font-medium text-gray-300 mb-1">Expected</label>
                                                                    <pre className="bg-gray-800 p-3 rounded border border-green-600 text-sm font-mono text-green-200 overflow-x-auto max-h-32 overflow-y-auto">
                                                                        {problemData?.testcases[idx]?.output ??
                                                                            customTestCases[idx - (problemData?.testcases.length || 0)]?.output ??
                                                                            '<not available>'}
                                                                    </pre>
                                                                </div>
                                                            </>
                                                        )}
                                                        <div className="flex items-center gap-4 text-xs text-gray-400 mt-2">
                                                            {res.executionTime !== undefined && (
                                                                <span className="flex items-center gap-1">
                                                                    <Clock className="h-3 w-3" />
                                                                    {res.executionTime}ms
                                                                </span>
                                                            )}
                                                            {res.memory !== undefined && (
                                                                <span>Memory: {res.memory}KB</span>
                                                            )}
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </>
                                    ) : (
                                        <div className="text-center text-gray-500 py-12">
                                            <Play className="h-16 w-16 mx-auto mb-4 opacity-30" />
                                            <p className="text-lg mb-2">No results yet</p>
                                            <p className="text-sm">Run your code to see test results</p>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                        <div className='h-5'>

                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default CodingProblemPage;