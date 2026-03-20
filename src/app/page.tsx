"use client";

import { useState, useRef, useCallback, useEffect } from "react";

type AppState = "upload" | "processing" | "preview" | "deploying" | "deployed";

interface ProcessingStep {
  id: string;
  label: string;
  icon: string;
  status: "pending" | "active" | "done";
}

const INITIAL_STEPS: ProcessingStep[] = [
  { id: "extract", label: "Extracting text from resume...", icon: "📄", status: "pending" },
  { id: "parse", label: "Analyzing professional background...", icon: "🧠", status: "pending" },
  { id: "rewrite", label: "Writing compelling marketing copy...", icon: "✍️", status: "pending" },
  { id: "theme", label: "Applying premium design theme...", icon: "🎨", status: "pending" },
  { id: "render", label: "Finalizing portfolio layout...", icon: "✨", status: "pending" },
];

export default function Home() {
  const [state, setState] = useState<AppState>("upload");
  const [inputType, setInputType] = useState<"pdf" | "text">("pdf");
  const [textInput, setTextInput] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [dragover, setDragover] = useState(false);
  const [steps, setSteps] = useState<ProcessingStep[]>(INITIAL_STEPS);
  const [previewHtml, setPreviewHtml] = useState("");
  const [portfolioId, setPortfolioId] = useState("");
  const [parsedName, setParsedName] = useState("");
  const [deployedUrl, setDeployedUrl] = useState("");
  const [deployCountdown, setDeployCountdown] = useState(0);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  // Write preview HTML to iframe
  useEffect(() => {
    if (previewHtml && iframeRef.current) {
      const doc = iframeRef.current.contentDocument;
      if (doc) {
        doc.open();
        doc.write(previewHtml);
        doc.close();
      }
    }
  }, [previewHtml, state]);

  // Countdown timer for deployed URL
  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (state === "deployed" && deployCountdown > 0) {
      timer = setTimeout(() => {
        setDeployCountdown((prev) => prev - 1);
      }, 1000);
    }
    return () => clearTimeout(timer);
  }, [state, deployCountdown]);

  const handleFileSelect = useCallback((selectedFile: File) => {
    if (selectedFile.type !== "application/pdf") {
      setError("Please upload a PDF file.");
      return;
    }
    if (selectedFile.size > 10 * 1024 * 1024) {
      setError("File must be less than 10MB.");
      return;
    }
    setFile(selectedFile);
    setError("");
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragover(false);
      const droppedFile = e.dataTransfer.files[0];
      if (droppedFile) handleFileSelect(droppedFile);
    },
    [handleFileSelect]
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragover(true);
  }, []);

  const handleDragLeave = useCallback(() => {
    setDragover(false);
  }, []);

  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const selectedFile = e.target.files?.[0];
      if (selectedFile) handleFileSelect(selectedFile);
    },
    [handleFileSelect]
  );

  const removeFile = useCallback(() => {
    setFile(null);
    setError("");
    if (fileInputRef.current) fileInputRef.current.value = "";
  }, []);

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const simulateSteps = async () => {
    // Delays match the heavy backend work: Extract (fast), Parse AI (slow), Rewrite AI (slow), Render (fast)
    const delays = [1500, 6000, 7000, 2000, 2000];

    for (let i = 0; i < INITIAL_STEPS.length; i++) {
      setSteps((prev) =>
        prev.map((s, idx) => ({
          ...s,
          status: idx < i ? "done" : idx === i ? "active" : "pending",
        }))
      );
      if (i < INITIAL_STEPS.length - 1) {
        await new Promise((r) => setTimeout(r, delays[i]));
      }
    }
  };

  const handleGenerate = async () => {
    setError("");
    setState("processing");
    setSteps(INITIAL_STEPS);

    try {
      const formData = new FormData();
      if (inputType === "pdf" && file) {
        formData.append("resume", file);
      } else if (inputType === "text" && textInput.trim()) {
        formData.append("rawText", textInput.trim());
      }

      // If no OpenAI key is set, the backend falls back to mock mode
      if (!file && !textInput.trim()) {
        formData.append("mock", "true");
      }

      // Start step animation
      const stepAnimation = simulateSteps();

      const response = await fetch("/api/generate", {
        method: "POST",
        body: formData,
      });

      // Wait for animation to at least play partially
      await stepAnimation;

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Generation failed");
      }

      const data = await response.json();

      // Mark all steps as done
      setSteps((prev) => prev.map((s) => ({ ...s, status: "done" as const })));
      await new Promise((r) => setTimeout(r, 500));

      setPreviewHtml(data.previewHtml);
      setPortfolioId(data.id);
      setParsedName(data.parsedData?.name || "");
      setState("preview");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Something went wrong";
      setError(message);
      setState("upload");
      setSteps(INITIAL_STEPS);
    }
  };

  const handleDeploy = async () => {
    setState("deploying");
    setError("");

    try {
      const response = await fetch("/api/deploy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: portfolioId,
          portfolioName: parsedName || file?.name.replace(/\.pdf$/i, "") || "my-portfolio",
          html: previewHtml,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Deployment failed");
      }

      const data = await response.json();
      setDeployedUrl(data.url);
      setDeployCountdown(6);
      setState("deployed");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Deployment failed";
      setError(message);
      setState("preview");
    }
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(deployedUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback
      const el = document.createElement("textarea");
      el.value = deployedUrl;
      document.body.appendChild(el);
      el.select();
      document.execCommand("copy");
      document.body.removeChild(el);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleStartOver = () => {
    setState("upload");
    setFile(null);
    setTextInput("");
    setPreviewHtml("");
    setPortfolioId("");
    setParsedName("");
    setDeployedUrl("");
    setDeployCountdown(0);
    setError("");
    setCopied(false);
    setSteps(INITIAL_STEPS);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleDownload = () => {
    const blob = new Blob([previewHtml], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "portfolio.html";
    a.click();
    URL.revokeObjectURL(url);
  };

  // ===== RENDER: Preview / Deployed states =====
  if (state === "preview" || state === "deploying" || state === "deployed") {
    return (
      <div className="app">
        <nav className="navbar">
          <div className="navbar-brand">Portfoliogy</div>
          <button className="btn btn-secondary" onClick={handleStartOver} style={{ padding: "8px 18px", fontSize: "0.82rem" }}>
            ← New Portfolio
          </button>
        </nav>

        <div className="preview-section">
          {/* Deployed banner */}
          {state === "deployed" && deployedUrl && (
            <div className="deployed-banner">
              <div className="icon">🎉</div>
              <div className="info">
                <div className="title">Portfolio deployed successfully!</div>
                <div className="deployed-url">
                  {deployCountdown > 0 ? (
                    <span style={{ color: "var(--text-muted)", fontSize: "0.88rem" }}>
                      Generating secure HTTPS certificates... Your link will be ready in {deployCountdown}s
                    </span>
                  ) : (
                    <>
                      <a href={deployedUrl} target="_blank" rel="noopener noreferrer">
                        {deployedUrl}
                      </a>
                      <button className={`copy-btn ${copied ? "copied" : ""}`} onClick={handleCopy}>
                        {copied ? "Copied!" : "Copy"}
                      </button>
                    </>
                  )}
                </div>
              </div>
            </div>
          )}

          {error && (
            <div className="error-banner" style={{ marginBottom: 24 }}>
              <span className="icon">⚠️</span>
              <span className="message">{error}</span>
            </div>
          )}

          <div className="preview-header">
            <h2>Portfolio Preview</h2>
            <div className="preview-actions">
              <button className="btn btn-secondary" onClick={handleDownload}>
                ⬇ Download HTML
              </button>
              {state !== "deployed" && (
                <button
                  className="btn btn-success"
                  onClick={handleDeploy}
                  disabled={state === "deploying"}
                >
                  {state === "deploying" ? (
                    <>
                      <span className="spinner"></span>
                      Deploying...
                    </>
                  ) : (
                    "🚀 Deploy Live"
                  )}
                </button>
              )}
              {state === "deployed" && deployedUrl && deployCountdown === 0 && (
                <a
                  href={deployedUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn btn-success"
                >
                  ↗ Visit Site
                </a>
              )}
            </div>
          </div>

          <div className="preview-frame">
            <iframe ref={iframeRef} title="Portfolio Preview" sandbox="allow-same-origin" />
          </div>
        </div>
      </div>
    );
  }

  // ===== RENDER: Upload / Processing states =====
  return (
    <div className="app">
      <nav className="navbar">
        <div className="navbar-brand">Portfoliogy</div>
        <span className="navbar-tagline">Resume → Portfolio in seconds</span>
      </nav>

      <section className="hero">
        <div className="hero-container">
          <div className="hero-badge">
            <span className="dot"></span>
            AI-Powered Portfolio Generator
          </div>
          <h1>
            Upload your resume.
            <br />
            Get a <span className="gradient-text">stunning portfolio</span>.
          </h1>
          <p className="subtitle">
            Drop your PDF resume and watch AI transform it into a beautifully designed,
            deployed portfolio website — in seconds.
          </p>

          {state === "upload" && (
            <>
              {/* Input Type Toggle */}
              <div className="input-toggle">
                <button
                  className={`toggle-btn ${inputType === "pdf" ? "active" : ""}`}
                  onClick={() => setInputType("pdf")}
                >
                  Upload PDF
                </button>
                <button
                  className={`toggle-btn ${inputType === "text" ? "active" : ""}`}
                  onClick={() => setInputType("text")}
                >
                  Paste Text
                </button>
              </div>

              {inputType === "pdf" ? (
                <>
                  {/* Upload zone */}
                  <div
                    className={`upload-zone ${dragover ? "dragover" : ""}`}
                    onDrop={handleDrop}
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                    onClick={() => fileInputRef.current?.click()}
                    id="upload-zone"
                  >
                    <div className="upload-zone-content">
                      <div className="upload-icon">📎</div>
                      <div className="upload-title">Drop your resume here</div>
                      <div className="upload-subtitle">
                        or <span className="highlight">click to browse</span> · PDF up to 10MB
                      </div>
                    </div>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept=".pdf"
                      className="file-input"
                      onChange={handleInputChange}
                      id="file-input"
                    />
                  </div>

                  {/* Selected file */}
                  {file && (
                    <div className="selected-file">
                      <div className="file-icon">📄</div>
                      <div className="file-info">
                        <div className="file-name">{file.name}</div>
                        <div className="file-size">{formatFileSize(file.size)}</div>
                      </div>
                      <button className="file-remove" onClick={(e) => { e.stopPropagation(); removeFile(); }}>
                        ✕
                      </button>
                    </div>
                  )}
                </>
              ) : (
                <div className="text-input-zone">
                  <textarea
                    className="resume-textarea"
                    placeholder="Paste the text content of your resume here..."
                    value={textInput}
                    onChange={(e) => setTextInput(e.target.value)}
                  />
                </div>
              )}

              {/* Error */}
              {error && (
                <div className="error-banner">
                  <span className="icon">⚠️</span>
                  <span className="message">{error}</span>
                </div>
              )}

              {/* Generate button */}
              <button
                className="generate-btn"
                onClick={handleGenerate}
                disabled={(inputType === "pdf" && !file) || (inputType === "text" && !textInput.trim())}
                id="generate-btn"
              >
                ✨ Generate Portfolio
              </button>

              {/* Demo button (mock mode) */}
              <button
                className="generate-btn"
                onClick={() => { setFile(null); handleGenerate(); }}
                style={{
                  background: "transparent",
                  border: "1px solid var(--border)",
                  color: "var(--text-secondary)",
                  boxShadow: "none",
                  marginTop: 12,
                  fontSize: "0.85rem",
                }}
                id="demo-btn"
              >
                👀 Try Demo (no upload needed)
              </button>
            </>
          )}

          {state === "processing" && (
            <div className="processing">
              <div className="processing-title">Building your portfolio...</div>
              <div className="processing-subtitle">This usually takes 15–30 seconds</div>
              <div className="step-list">
                {steps.map((step) => (
                  <div key={step.id} className={`step ${step.status}`}>
                    <div className="step-icon">
                      {step.status === "done" ? "✓" : step.icon}
                    </div>
                    <div className="step-label">{step.label}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* How it works */}
          {state === "upload" && (
            <div className="how-it-works">
              <h3>How it works</h3>
              <div className="steps-row">
                <div className="hiw-step">
                  <div className="num">1</div>
                  <div className="label">Upload</div>
                  <div className="desc">Drop your resume PDF</div>
                </div>
                <div className="hiw-step">
                  <div className="num">2</div>
                  <div className="label">Parse</div>
                  <div className="desc">AI extracts & structures data</div>
                </div>
                <div className="hiw-step">
                  <div className="num">3</div>
                  <div className="label">Polish</div>
                  <div className="desc">AI rewrites for impact</div>
                </div>
                <div className="hiw-step">
                  <div className="num">4</div>
                  <div className="label">Deploy</div>
                  <div className="desc">Get a live portfolio URL</div>
                </div>
              </div>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
