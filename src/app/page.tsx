"use client";

import { useState, useRef, useCallback, useEffect } from "react";

type AppState = "upload" | "processing_parse" | "confirm_info" | "processing_generate" | "preview" | "deploying" | "deployed";

interface ProcessingStep {
  id: string;
  label: string;
  icon: string;
  status: "pending" | "active" | "done";
}

const INITIAL_STEPS: ProcessingStep[] = [
  { id: "extract", label: "Extracting text from resume...", icon: "📄", status: "pending" },
  { id: "parse", label: "Analyzing professional background...", icon: "🧠", status: "pending" },
  { id: "rewrite", label: "Adding projects and experience...", icon: "✍️", status: "pending" },
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
  const [parsedResumeData, setParsedResumeData] = useState<any>(null);
  const [contactInfo, setContactInfo] = useState({ email: "", linkedin: "", github: "" });
  const [useMockFlag, setUseMockFlag] = useState(false);
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

  const simulateParseSteps = async () => {
    const delays = [1500, 4000];
    for (let i = 0; i < 2; i++) {
      setSteps((prev) =>
        prev.map((s, idx) => ({
          ...s,
          status: idx < i ? "done" : idx === i ? "active" : "pending",
        }))
      );
      await new Promise((r) => setTimeout(r, delays[i]));
    }
  };

  const simulateGenerateSteps = async () => {
    const delays = [6000, 2000, 2000];
    for (let i = 2; i < 5; i++) {
      setSteps((prev) =>
        prev.map((s, idx) => ({
          ...s,
          status: idx < i ? "done" : idx === i ? "active" : s.status,
        }))
      );
      if (i < 4) {
        await new Promise((r) => setTimeout(r, delays[i - 2]));
      }
    }
  };

  const handleGenerate = async () => {
    setError("");
    setState("processing_parse");
    setSteps(INITIAL_STEPS);

    try {
      const formData = new FormData();
      if (inputType === "pdf" && file) {
        formData.append("resume", file);
      } else if (inputType === "text" && textInput.trim()) {
        formData.append("rawText", textInput.trim());
      }

      const isMock = (!file && !textInput.trim());
      if (isMock) {
        formData.append("mock", "true");
      }
      setUseMockFlag(isMock);

      const stepAnimation = simulateParseSteps();

      const response = await fetch("/api/parse", {
        method: "POST",
        body: formData,
      });

      await stepAnimation;

      // Mark first two as done immediately
      setSteps((prev) => prev.map((s, idx) => ({ ...s, status: idx <= 1 ? "done" : "pending" as const })));
      await new Promise((r) => setTimeout(r, 500));

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Parsing failed");
      }

      const data = await response.json();

      setParsedResumeData(data.parsedData);
      setContactInfo({
        email: data.parsedData?.email || "",
        linkedin: data.parsedData?.linkedin || "",
        github: data.parsedData?.github || "",
      });
      setState("confirm_info");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Something went wrong";
      setError(message);
      setState("upload");
      setSteps(INITIAL_STEPS);
    }
  };

  const handleConfirmAndGenerate = async () => {
    setError("");
    setState("processing_generate");

    try {
      const updatedResumeData = {
        ...parsedResumeData,
        email: contactInfo.email,
        linkedin: contactInfo.linkedin,
        github: contactInfo.github,
      };

      const stepAnimation = simulateGenerateSteps();

      // Ensure mock mode is handled
      const response = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ resumeData: updatedResumeData, mock: useMockFlag }),
      });

      await stepAnimation;

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Generation failed");
      }

      const data = await response.json();

      setSteps((prev) => prev.map((s) => ({ ...s, status: "done" as const })));
      await new Promise((r) => setTimeout(r, 500));

      setPreviewHtml(data.previewHtml);
      setPortfolioId(data.id);
      setParsedName(data.parsedData?.name || "");
      setState("preview");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Something went wrong";
      setError(message);
      setState("confirm_info");
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
    setParsedResumeData(null);
    setUseMockFlag(false);
    setContactInfo({ email: "", linkedin: "", github: "" });
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
                    <span style={{ color: "white", fontSize: "0.88rem" }}>
                      Generating Live Link in {deployCountdown}s
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
              {/* <button
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
              </button> */}
            </>
          )}

          {state === "confirm_info" && (
            <div className="confirm-info-card" style={{ background: "var(--bg-card)", border: "1px solid var(--border)", padding: "32px", borderRadius: "16px", marginTop: "32px", textAlign: "left" }}>
              <h2 style={{ marginBottom: "8px", fontSize: "1.5rem" }}>Confirm Contact Info</h2>
              <p style={{ color: "var(--text-secondary)", marginBottom: "24px", fontSize: "0.95rem" }}>
                We've extracted these links from your resume. Update them if needed so potential employers or clients can reach you.
              </p>

              <div style={{ display: "flex", flexDirection: "column", gap: "16px", marginBottom: "32px" }}>
                <div className="input-field">
                  <label style={{ display: "block", marginBottom: "8px", fontSize: "0.9rem", color: "var(--text-secondary)" }}>Email address</label>
                  <input
                    type="email"
                    value={contactInfo.email}
                    onChange={(e) => setContactInfo({ ...contactInfo, email: e.target.value })}
                    style={{ width: "100%", padding: "12px", background: "var(--bg-primary)", border: "1px solid var(--border)", borderRadius: "8px", color: "var(--text-primary)", fontSize: "1rem" }}
                  />
                </div>
                <div className="input-field">
                  <label style={{ display: "block", marginBottom: "8px", fontSize: "0.9rem", color: "var(--text-secondary)" }}>LinkedIn URL</label>
                  <input
                    type="text"
                    value={contactInfo.linkedin}
                    onChange={(e) => setContactInfo({ ...contactInfo, linkedin: e.target.value })}
                    style={{ width: "100%", padding: "12px", background: "var(--bg-primary)", border: "1px solid var(--border)", borderRadius: "8px", color: "var(--text-primary)", fontSize: "1rem" }}
                  />
                </div>
                <div className="input-field">
                  <label style={{ display: "block", marginBottom: "8px", fontSize: "0.9rem", color: "var(--text-secondary)" }}>GitHub URL <span style={{ color: "var(--text-muted)", fontSize: "0.8rem" }}>(Optional)</span></label>
                  <input
                    type="text"
                    value={contactInfo.github}
                    onChange={(e) => setContactInfo({ ...contactInfo, github: e.target.value })}
                    style={{ width: "100%", padding: "12px", background: "var(--bg-primary)", border: "1px solid var(--border)", borderRadius: "8px", color: "var(--text-primary)", fontSize: "1rem" }}
                  />
                </div>
              </div>

              <div style={{ display: "flex", gap: "12px" }}>
                <button
                  className="btn btn-secondary"
                  onClick={handleStartOver}
                  style={{ flex: 1, padding: "14px", fontSize: "1rem", justifyContent: "center" }}
                >
                  Cancel
                </button>
                <button
                  className="btn btn-primary"
                  onClick={handleConfirmAndGenerate}
                  style={{ flex: 2, padding: "14px", fontSize: "1rem", justifyContent: "center" }}
                >
                  Confirm Portfolio Generation ✨
                </button>
              </div>
            </div>
          )}

          {(state === "processing_parse" || state === "processing_generate") && (
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
