import { useRef, useState } from "react";

export type SourceFile = { id: string; file: File; text: string };

type Props = {
  sources: SourceFile[];
  resumeFile: File | null;
  jobFile: File | null;
  jobText: string;
  jobUrl: string;
  targetTitle: string;
  wordCount: number;
  busy: boolean;
  uploading: boolean;
  onSources: (files: File[]) => void;
  onRemoveSource: (id: string) => void;
  onResume: (file: File) => void;
  onJob: (file: File) => void;
  onJobText: (value: string) => void;
  onJobUrl: (value: string) => void;
  onTargetTitle: (value: string) => void;
  onBuild: () => void;
};

export default function AmeliaChatWorkspace(props: Props) {
  const sourceInput = useRef<HTMLInputElement>(null);
  const resumeInput = useRef<HTMLInputElement>(null);
  const jobInput = useRef<HTMLInputElement>(null);
  const [jobMode, setJobMode] = useState<"link" | "text">(props.jobText ? "text" : "link");
  const [dragging, setDragging] = useState(false);
  const locked = props.busy || props.uploading;
  const targetReady = Boolean(props.jobText.trim() || /^https?:\/\//i.test(props.jobUrl.trim()));
  const completed = Number(props.sources.length > 0) + Number(Boolean(props.resumeFile)) + Number(targetReady);
  const fileCount = props.sources.length + Number(Boolean(props.resumeFile)) + Number(Boolean(props.jobFile));
  const steps = [{ label: "Source Docs", ready: props.sources.length > 0 }, { label: "CV Draft", ready: Boolean(props.resumeFile) }, { label: "Target JD", ready: targetReady }];

  return (
    <section className="amelia-intake" aria-label="Chat resume workspace">
      <header className="intake-hero">
        <div>
          <span className="intake-pill">Say hello to your AI Resume Co-Pilot</span>
          <h1>Build your target-role resume in 3 simple steps</h1>
          <p>Equip Amelia with your raw project logs, baseline experiences, and dream role specs for precision ATS matching.</p>
        </div>
        <div className="intake-progress" aria-label="Preparation progress">
          {steps.map((item, index) => <div className={item.ready ? "complete" : ""} key={item.label}><span>{item.ready ? "✓" : index + 1}</span><div><small>Step {String.fromCharCode(65 + index)}</small><strong>{item.label}</strong></div></div>)}
        </div>
      </header>

      <div className="intake-columns">
        <div className="intake-main">
          <section className="intake-card">
            <header><h2><i />Step A: Upload Raw Files &amp; Coursework</h2><span className="intake-pill">{props.sources.length} Files Active</span></header>
            <p>Dump your raw notes, project specs, hackathon docs, internship logs, or transcript. Amelia mines hidden career impact points.</p>
            <input ref={sourceInput} type="file" aria-label="Upload raw files and coursework" accept=".pdf,.docx,.txt,.md" multiple hidden disabled={locked} onChange={(e) => { props.onSources(Array.from(e.target.files ?? [])); e.target.value = ""; }} />
            <button className={`intake-dropzone ${dragging ? "is-dragging" : ""}`} disabled={locked}
              onClick={() => sourceInput.current?.click()}
              onDragOver={(e) => { e.preventDefault(); if (!locked) setDragging(true); }}
              onDragLeave={() => setDragging(false)}
              onDrop={(e) => { e.preventDefault(); setDragging(false); if (!locked) props.onSources(Array.from(e.dataTransfer.files)); }}>
              <span className="intake-upload-symbol">♧</span><strong>{props.uploading ? "Saving your files…" : "Tap to browse or drop files here"}</strong><small>Supports PDF, DOCX, TXT, MD up to 25 MB</small>
            </button>
            <ul className="intake-files">{props.sources.map((source) => <li key={source.id}><span className="intake-file-icon">▤</span><div><strong>{source.file.name}</strong><small>{Math.max(1, Math.round(source.file.size / 1024))} KB · Source document</small></div><span className="intake-check" aria-label="Saved">✓</span><button disabled={locked} aria-label={`Remove ${source.file.name} from this resume`} onClick={() => props.onRemoveSource(source.id)}>×</button></li>)}</ul>
            <button className="intake-text-button" disabled={locked} onClick={() => sourceInput.current?.click()}>+ Add more coursework / raw notes</button>
          </section>
          <section className="intake-card">
            <header><h2><i />Step B: Existing Resume Baseline</h2>{props.resumeFile && <span className="intake-pill intake-success">UPLOADED</span>}</header>
            <p>Upload your current student CV or previous job draft as the comparative foundation.</p>
            <input ref={resumeInput} aria-label="Upload existing resume baseline" type="file" accept=".pdf,.docx,.txt" hidden disabled={locked} onChange={(e) => { const file = e.target.files?.[0]; if (file) props.onResume(file); e.target.value = ""; }} />
            <div className="intake-baseline"><span className="intake-file-icon">▧</span><div><strong>{props.resumeFile?.name || "Add your existing resume"}</strong><small>{props.resumeFile ? `${Math.max(1, Math.round(props.resumeFile.size / 1024))} KB · Uploaded baseline draft` : "PDF, DOCX, or TXT"}</small></div><button disabled={locked} onClick={() => resumeInput.current?.click()}>{props.resumeFile ? "↻ Replace" : "↑ Upload"}</button></div>
            <div className="intake-baseline-note">▧ {props.resumeFile ? "Baseline ready for Amelia synthesis" : "Your experience is the foundation of your new resume"}</div>
          </section>
        </div>
        <aside className="intake-side">
          <section className="intake-card">
            <header><h2><i />Step C: Target Role &amp; JD</h2><span className="intake-pill">High Priority</span></header>
            <p>Tell Amelia what role you are targeting or provide a job post link for alignment.</p>
            <label htmlFor="intake-title">Preferred Target Title</label>
            <input id="intake-title" placeholder="Associate Product Manager (APM)" value={props.targetTitle} onChange={(e) => props.onTargetTitle(e.target.value)} />
            <div className="intake-source-heading"><label htmlFor={jobMode === "link" ? "intake-link" : "intake-jd"}>Job Description Source</label><div className="intake-segment"><button aria-pressed={jobMode === "link"} onClick={() => setJobMode("link")}>Job Link</button><button aria-pressed={jobMode === "text"} onClick={() => setJobMode("text")}>Raw Text Input</button></div></div>
            {jobMode === "link" ? <input id="intake-link" type="url" placeholder="https://linkedin.com/jobs/view/…" value={props.jobUrl} onChange={(e) => props.onJobUrl(e.target.value)} /> : <textarea id="intake-jd" placeholder="Paste the full job description here..." value={props.jobText} onChange={(e) => props.onJobText(e.target.value)} />}
            <input ref={jobInput} aria-label="Upload target job description" type="file" accept=".pdf,.docx,.txt,.md" hidden disabled={locked} onChange={(e) => { const file = e.target.files?.[0]; if (file) { props.onJob(file); setJobMode("text"); } e.target.value = ""; }} />
            <button className="intake-job-upload" disabled={locked} onClick={() => jobInput.current?.click()}>↗ {props.jobFile?.name || "Upload a job description"}{props.jobFile && <span className="intake-pill intake-success">SAVED</span>}</button>
          </section>
          <section className="intake-package">
            <div><span className="intake-spark">✣</span><div><h2>{completed === 3 ? "Pre-Synthesis Package Loaded" : "Your Synthesis Package"}</h2><p>{props.sources.length} source documents, {props.resumeFile ? "1 resume" : "no resume yet"}, and {targetReady ? "1 target job description" : "no target job description yet"}.</p></div></div>
            <div className="intake-word-count"><strong>{props.wordCount.toLocaleString()}</strong><small>Words ready for analysis</small></div>
          </section>
        </aside>
      </div>
      <footer className="intake-actionbar"><span className="intake-file-icon">▤</span><div><strong>{completed} of 3 steps completed</strong><small>{fileCount} source files attached{props.targetTitle ? ` · ${props.targetTitle}` : ""}</small></div><button disabled={locked || !props.resumeFile || !targetReady} onClick={props.onBuild}>{props.uploading ? "Saving documents…" : props.busy ? "Preparing your resume…" : "Curate & Elevate with Amelia"} <span>→</span></button></footer>
    </section>
  );
}
