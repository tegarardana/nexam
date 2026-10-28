"use client";

import React, { useRef, useState, useEffect } from "react";
import {
  Bold,
  Italic,
  Underline,
  AlignLeft,
  AlignCenter,
  AlignRight,
  AlignJustify,
  List,
  ListOrdered,
  Table as TableIcon,
  Code,
  RotateCcw,
  Calculator,
  Eye,
  Type,
  X,
  Plus,
} from "lucide-react";
import katex from "katex";

interface RichTextEditorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  minHeight?: string;
  compact?: boolean;
  className?: string;
}

export function RichTextEditor({
  value,
  onChange,
  placeholder = "Ketik teks di sini...",
  minHeight = "min-h-[140px]",
  compact = false,
  className = "",
}: RichTextEditorProps) {
  const editorRef = useRef<HTMLDivElement>(null);
  const [isCodeView, setIsCodeView] = useState(false);
  const [showMathModal, setShowMathModal] = useState(false);
  const [mathLatex, setMathLatex] = useState("\\frac{a}{b}");
  const [mathPreviewError, setMathPreviewError] = useState<string | null>(null);
  const [savedRange, setSavedRange] = useState<Range | null>(null);

  // Sync value to editor content if external value changed
  useEffect(() => {
    if (!editorRef.current) return;
    const currentHtml = editorRef.current.innerHTML;
    if (value !== currentHtml && document.activeElement !== editorRef.current) {
      editorRef.current.innerHTML = value || "";
    }
  }, [value]);

  const saveSelection = () => {
    const sel = window.getSelection();
    if (sel && sel.rangeCount > 0) {
      setSavedRange(sel.getRangeAt(0));
    }
  };

  const restoreSelection = () => {
    if (!savedRange) return;
    const sel = window.getSelection();
    if (sel) {
      sel.removeAllRanges();
      sel.addRange(savedRange);
    }
  };

  const handleInput = () => {
    if (!editorRef.current) return;
    onChange(editorRef.current.innerHTML);
  };

  const executeCommand = (command: string, arg: string | undefined = undefined) => {
    document.execCommand(command, false, arg);
    if (editorRef.current) {
      onChange(editorRef.current.innerHTML);
    }
  };

  // 1. Style / Heading Formats
  const handleFormatBlock = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const tag = e.target.value;
    if (!tag) return;
    if (tag === "blockquote") {
      executeCommand("formatBlock", "blockquote");
    } else if (tag === "pre") {
      executeCommand("formatBlock", "pre");
    } else if (tag === "p") {
      executeCommand("formatBlock", "p");
    } else {
      executeCommand("formatBlock", `<${tag}>`);
    }
    e.target.value = "";
  };

  // 2. Font Family
  const handleFontFamily = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const font = e.target.value;
    if (!font) return;
    executeCommand("fontName", font);
    e.target.value = "";
  };

  // 3. Font Size
  const handleFontSize = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const size = e.target.value;
    if (!size) return;
    executeCommand("fontSize", size);
    e.target.value = "";
  };

  // 4. Insert Table
  const handleInsertTable = () => {
    const tableHtml = `
      <table style="width: 100%; border-collapse: collapse; margin: 8px 0; border: 1px solid #cbd5e1;">
        <thead>
          <tr style="background-color: #f1f5f9;">
            <th style="border: 1px solid #cbd5e1; padding: 6px 10px; text-align: left; font-weight: bold;">Kolom 1</th>
            <th style="border: 1px solid #cbd5e1; padding: 6px 10px; text-align: left; font-weight: bold;">Kolom 2</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td style="border: 1px solid #cbd5e1; padding: 6px 10px;">Baris 1, Data A</td>
            <td style="border: 1px solid #cbd5e1; padding: 6px 10px;">Baris 1, Data B</td>
          </tr>
          <tr>
            <td style="border: 1px solid #cbd5e1; padding: 6px 10px;">Baris 2, Data C</td>
            <td style="border: 1px solid #cbd5e1; padding: 6px 10px;">Baris 2, Data D</td>
          </tr>
        </tbody>
      </table><p><br></p>
    `;
    executeCommand("insertHTML", tableHtml);
  };

  // 5. Open Math Formula Modal
  const handleOpenMathModal = () => {
    saveSelection();
    setShowMathModal(true);
  };

  // 6. Insert Math Formula into Editor
  const handleInsertMath = () => {
    if (!mathLatex.trim()) {
      setShowMathModal(false);
      return;
    }

    try {
      const renderedKaTeX = katex.renderToString(mathLatex.trim(), {
        displayMode: false,
        throwOnError: false,
      });

      // Wrap in a formula span with latex data attribute so it can be edited if needed
      const formulaHtml = `&nbsp;<span class="katex-formula" data-latex="${encodeURIComponent(
        mathLatex
      )}" contenteditable="false">${renderedKaTeX}</span>&nbsp;`;

      restoreSelection();
      executeCommand("insertHTML", formulaHtml);
    } catch (err: any) {
      alert("Format LaTeX tidak valid: " + err.message);
      return;
    }

    setShowMathModal(false);
  };

  // Render Math Preview inside Modal
  const renderedMathPreview = () => {
    try {
      return (
        <span
          dangerouslySetInnerHTML={{
            __html: katex.renderToString(mathLatex || " ", {
              displayMode: true,
              throwOnError: false,
            }),
          }}
        />
      );
    } catch (err: any) {
      return <span className="text-rose-500 font-mono text-xs">{err.message}</span>;
    }
  };

  // 7. Reset text style / format
  const handleResetFormat = () => {
    executeCommand("removeFormat");
    executeCommand("formatBlock", "p");
  };

  const mathPresets = [
    { label: "Pecahan", latex: "\\frac{a}{b}" },
    { label: "Pangkat", latex: "x^{2}" },
    { label: "Subskrip", latex: "x_{i}" },
    { label: "Akar Kuadrat", latex: "\\sqrt{x}" },
    { label: "Akar-n", latex: "\\sqrt[n]{x}" },
    { label: "Plus Minus", latex: "\\pm" },
    { label: "Kali", latex: "\\times" },
    { label: "Bagi", latex: "\\div" },
    { label: "Tidak Sama", latex: "\\neq" },
    { label: "Kurang Sama", latex: "\\le" },
    { label: "Lebih Sama", latex: "\\ge" },
    { label: "Pi", latex: "\\pi" },
    { label: "Alpha", latex: "\\alpha" },
    { label: "Beta", latex: "\\beta" },
    { label: "Theta", latex: "\\theta" },
    { label: "Integral", latex: "\\int_{a}^{b} f(x) dx" },
    { label: "Sigma / Sum", latex: "\\sum_{i=1}^{n} x_i" },
  ];

  return (
    <div className={`rounded-xl border border-slate-300 bg-white overflow-hidden shadow-2xs focus-within:border-[#65C443] focus-within:ring-1 focus-within:ring-[#65C443] transition ${className}`}>
      {/* TOOLBAR */}
      <div className={`bg-slate-50 border-b border-slate-200 p-1.5 flex flex-wrap items-center gap-1 text-slate-700 select-none ${compact ? "text-xs" : ""}`}>
        {/* Style / Heading Dropdown */}
        <div className="relative">
          <select
            defaultValue=""
            onChange={handleFormatBlock}
            className="h-7 text-[11px] px-2 py-0.5 rounded bg-white border border-slate-200 text-slate-700 hover:bg-slate-100 cursor-pointer focus:outline-none"
            title="Style / Heading"
          >
            <option value="" disabled>Style</option>
            <option value="p">Normal (Paragraf)</option>
            <option value="h1">Heading 1 (Besar)</option>
            <option value="h2">Heading 2 (Sedang)</option>
            <option value="h3">Heading 3 (Kecil)</option>
            <option value="blockquote">Kutipan / Blockquote</option>
            <option value="pre">Blok Kode / Code Block</option>
          </select>
        </div>

        {/* Font Family Dropdown */}
        <div className="relative">
          <select
            defaultValue=""
            onChange={handleFontFamily}
            className="h-7 text-[11px] px-2 py-0.5 rounded bg-white border border-slate-200 text-slate-700 hover:bg-slate-100 cursor-pointer focus:outline-none"
            title="Pilih Font"
          >
            <option value="" disabled>Font</option>
            <option value="Arial, sans-serif">Arial</option>
            <option value="'Times New Roman', serif">Times New Roman</option>
            <option value="'Courier New', monospace">Courier New</option>
            <option value="Georgia, serif">Georgia</option>
            <option value="'Trebuchet MS', sans-serif">Trebuchet MS</option>
            <option value="Verdana, sans-serif">Verdana</option>
          </select>
        </div>

        {/* Font Size Dropdown */}
        <div className="relative">
          <select
            defaultValue=""
            onChange={handleFontSize}
            className="h-7 text-[11px] px-2 py-0.5 rounded bg-white border border-slate-200 text-slate-700 hover:bg-slate-100 cursor-pointer focus:outline-none"
            title="Ukuran Font"
          >
            <option value="" disabled>Ukuran</option>
            <option value="1">10px (Sangat Kecil)</option>
            <option value="2">13px (Kecil)</option>
            <option value="3">16px (Normal)</option>
            <option value="4">18px (Sedang)</option>
            <option value="5">24px (Besar)</option>
            <option value="6">32px (Sangat Besar)</option>
          </select>
        </div>

        <div className="h-4 w-px bg-slate-300 mx-0.5" />

        {/* Inline Formatting: Bold, Italic, Underline */}
        <button
          type="button"
          onMouseDown={(e) => {
            e.preventDefault();
            executeCommand("bold");
          }}
          className="p-1 rounded hover:bg-slate-200 text-slate-700 transition cursor-pointer"
          title="Tebal (Bold)"
        >
          <Bold className="w-3.5 h-3.5" />
        </button>

        <button
          type="button"
          onMouseDown={(e) => {
            e.preventDefault();
            executeCommand("italic");
          }}
          className="p-1 rounded hover:bg-slate-200 text-slate-700 transition cursor-pointer"
          title="Miring (Italic)"
        >
          <Italic className="w-3.5 h-3.5" />
        </button>

        <button
          type="button"
          onMouseDown={(e) => {
            e.preventDefault();
            executeCommand("underline");
          }}
          className="p-1 rounded hover:bg-slate-200 text-slate-700 transition cursor-pointer"
          title="Garis Bawah (Underline)"
        >
          <Underline className="w-3.5 h-3.5" />
        </button>

        <div className="h-4 w-px bg-slate-300 mx-0.5" />

        {/* Paragraph Alignment */}
        <button
          type="button"
          onMouseDown={(e) => {
            e.preventDefault();
            executeCommand("justifyLeft");
          }}
          className="p-1 rounded hover:bg-slate-200 text-slate-700 transition cursor-pointer"
          title="Rata Kiri"
        >
          <AlignLeft className="w-3.5 h-3.5" />
        </button>

        <button
          type="button"
          onMouseDown={(e) => {
            e.preventDefault();
            executeCommand("justifyCenter");
          }}
          className="p-1 rounded hover:bg-slate-200 text-slate-700 transition cursor-pointer"
          title="Rata Tengah"
        >
          <AlignCenter className="w-3.5 h-3.5" />
        </button>

        <button
          type="button"
          onMouseDown={(e) => {
            e.preventDefault();
            executeCommand("justifyRight");
          }}
          className="p-1 rounded hover:bg-slate-200 text-slate-700 transition cursor-pointer"
          title="Rata Kanan"
        >
          <AlignRight className="w-3.5 h-3.5" />
        </button>

        <button
          type="button"
          onMouseDown={(e) => {
            e.preventDefault();
            executeCommand("justifyFull");
          }}
          className="p-1 rounded hover:bg-slate-200 text-slate-700 transition cursor-pointer"
          title="Rata Kiri Kanan (Justify)"
        >
          <AlignJustify className="w-3.5 h-3.5" />
        </button>

        <div className="h-4 w-px bg-slate-300 mx-0.5" />

        {/* Lists */}
        <button
          type="button"
          onMouseDown={(e) => {
            e.preventDefault();
            executeCommand("insertUnorderedList");
          }}
          className="p-1 rounded hover:bg-slate-200 text-slate-700 transition cursor-pointer"
          title="Daftar Bullet (Unordered List)"
        >
          <List className="w-3.5 h-3.5" />
        </button>

        <button
          type="button"
          onMouseDown={(e) => {
            e.preventDefault();
            executeCommand("insertOrderedList");
          }}
          className="p-1 rounded hover:bg-slate-200 text-slate-700 transition cursor-pointer"
          title="Daftar Nomor (Ordered List)"
        >
          <ListOrdered className="w-3.5 h-3.5" />
        </button>

        <div className="h-4 w-px bg-slate-300 mx-0.5" />

        {/* Table */}
        <button
          type="button"
          onMouseDown={(e) => {
            e.preventDefault();
            handleInsertTable();
          }}
          className="p-1 rounded hover:bg-slate-200 text-slate-700 transition cursor-pointer flex items-center gap-1 text-[11px]"
          title="Sisipkan Tabel"
        >
          <TableIcon className="w-3.5 h-3.5 text-[#0D274C]" />
          {!compact && <span>Tabel</span>}
        </button>

        {/* Insert Math Formula */}
        <button
          type="button"
          onMouseDown={(e) => {
            e.preventDefault();
            handleOpenMathModal();
          }}
          className="p-1 px-1.5 rounded bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 transition cursor-pointer flex items-center gap-1 text-[11px] font-semibold"
          title="Sisipkan Rumus Matematika (KaTeX / LaTeX)"
        >
          <Calculator className="w-3.5 h-3.5 text-emerald-700" />
          <span>Rumus Math</span>
        </button>

        {/* Reset / Clear Formatting */}
        <button
          type="button"
          onMouseDown={(e) => {
            e.preventDefault();
            handleResetFormat();
          }}
          className="p-1 rounded hover:bg-slate-200 text-rose-600 transition cursor-pointer ml-auto flex items-center gap-1 text-[11px]"
          title="Reset Style & Format (Clear Format)"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          {!compact && <span>Reset Format</span>}
        </button>

        {/* Code View Toggle */}
        <button
          type="button"
          onMouseDown={(e) => {
            e.preventDefault();
            setIsCodeView(!isCodeView);
          }}
          className={`p-1 px-1.5 rounded transition cursor-pointer flex items-center gap-1 text-[11px] font-semibold border ${
            isCodeView
              ? "bg-[#0D274C] text-white border-[#0D274C]"
              : "bg-white hover:bg-slate-100 text-slate-700 border-slate-200"
          }`}
          title="Tampilan Kode HTML (Code View)"
        >
          <Code className="w-3.5 h-3.5" />
          <span>{isCodeView ? "Visual" : "HTML"}</span>
        </button>
      </div>

      {/* EDITOR AREA */}
      {isCodeView ? (
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Ketik kode HTML di sini..."
          className={`w-full p-3 font-mono text-xs bg-slate-900 text-emerald-400 focus:outline-none resize-y ${minHeight}`}
        />
      ) : (
        <div
          ref={editorRef}
          contentEditable
          onInput={handleInput}
          onBlur={handleInput}
          data-placeholder={placeholder}
          className={`nexam-rich-content p-3.5 text-slate-900 focus:outline-none overflow-y-auto leading-relaxed empty:before:content-[attr(data-placeholder)] empty:before:text-slate-400 empty:before:pointer-events-none ${minHeight}`}
        />
      )}

      {/* MATH FORMULA MODAL */}
      {showMathModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-lg w-full p-5 space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-800 flex items-center justify-center font-bold">
                  ∑
                </div>
                <div>
                  <h4 className="text-sm font-bold text-slate-900">Sisipkan Rumus Matematika</h4>
                  <p className="text-[11px] text-slate-500">Mendukung notasi LaTeX dengan live preview KaTeX</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowMathModal(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Presets Grid */}
            <div className="space-y-1.5">
              <label className="text-[11px] font-semibold text-slate-600">Preset Simbol & Rumus Populer:</label>
              <div className="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto p-1 bg-slate-50 rounded-xl border border-slate-200">
                {mathPresets.map((preset, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => setMathLatex((prev) => (prev ? `${prev} ${preset.latex}` : preset.latex))}
                    className="px-2 py-1 rounded bg-white hover:bg-emerald-50 hover:border-emerald-300 border border-slate-200 text-[11px] font-mono text-slate-700 transition cursor-pointer"
                    title={preset.latex}
                  >
                    {preset.label}
                  </button>
                ))}
              </div>
            </div>

            {/* LaTeX Text Input */}
            <div className="space-y-1">
              <label className="text-[11px] font-semibold text-slate-700">Kode Notasi LaTeX:</label>
              <textarea
                rows={2}
                value={mathLatex}
                onChange={(e) => setMathLatex(e.target.value)}
                placeholder="Contoh: \frac{-b \pm \sqrt{b^2 - 4ac}}{2a}"
                className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-300 font-mono text-xs text-slate-900 focus:outline-none focus:border-[#65C443] focus:bg-white"
              />
            </div>

            {/* Live Preview Box */}
            <div className="space-y-1">
              <label className="text-[11px] font-semibold text-slate-700 flex items-center gap-1.5">
                <Eye className="w-3.5 h-3.5 text-emerald-600" />
                <span>Pratinjau Rumus (Live Preview):</span>
              </label>
              <div className="p-4 rounded-xl bg-slate-100 border border-slate-200 min-h-[60px] flex items-center justify-center text-slate-900 overflow-x-auto text-base">
                {renderedMathPreview()}
              </div>
            </div>

            {/* Modal Actions */}
            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-200">
              <button
                type="button"
                onClick={() => setShowMathModal(false)}
                className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold cursor-pointer transition"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleInsertMath}
                className="px-5 py-2 rounded-xl bg-[#65C443] hover:bg-[#52a835] text-white text-xs font-bold shadow-sm transition cursor-pointer"
              >
                Sisipkan ke Editor
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default RichTextEditor;
