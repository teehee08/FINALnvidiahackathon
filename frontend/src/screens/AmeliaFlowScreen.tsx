import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  buildProfile,
  createApplications,
  createProfile,
  getApplication,
  listProfiles,
  listVaultDocuments,
  saveVaultDocument,
  removeVaultDocument,
  pasteJobText,
  regenerate,
  uploadDocument,
} from "../api";
import type { VaultDocument } from "../api";
import type { ApplicationDetail, ProfileSummary } from "../types";

import type { ConversationMessage } from "../components/AmeliaConversation";
import AmeliaConversation from "../components/AmeliaConversation";
import AmeliaChatWorkspace from "../components/AmeliaChatWorkspace";
import type { SourceFile } from "../components/AmeliaChatWorkspace";

const ACCESS_CODE = "Home";

type FlowStep = 2 | 3 | 4;


function AmeliaLogo() {
  return (
    <span className="amelia-logo">
      <svg className="amelia-logo-symbol" viewBox="35 35 565 525" aria-hidden="true" focusable="false">
        <path fill="#334394" d="M327 40 C378 37 406 57 430 108 L584 458 C600 488 598 510 580 529 C563 548 538 553 506 553 L485 553 C450 553 433 543 420 518 L306 260 Z" />
        <path fill="#222955" d="M316 278 C336 335 358 358 407 378 C472 405 558 423 584 458 C602 482 598 510 580 529 C563 548 538 553 506 553 L485 553 C450 553 433 543 420 518 Z" />
        <path fill="#465BA1" d="M327 40 C357 38 379 44 391 55 C419 81 383 157 360 202 L209 511 C195 540 173 553 136 554 L115 554 C83 553 63 546 50 526 C36 506 41 486 51 465 L238 100 C257 60 281 41 327 40 Z" />
      </svg>
      <span className="amelia-logo-name">Amelia AI <b>PRO</b></span>
    </span>
  );
}

function SidebarNavigation({ step, onSelect }: { step: FlowStep; onSelect: (step: FlowStep) => void }) {
  return (
    <nav className="amelia-sidebar-nav" aria-label="Resume workspace">
      {([{ step: 2, label: "Resume Builder", icon: "▧" }, { step: 3, label: "Resume Chat", icon: "▤" }, { step: 4, label: "Document Vault", icon: "▱" }] as const).map((item) => (
        <button type="button" className={item.step === step ? "is-current" : ""}
          key={item.step} aria-current={item.step === step ? "page" : undefined}
          onClick={() => onSelect(item.step)}>
          <span aria-hidden="true">{item.icon}</span><small>{item.label}</small>
        </button>
      ))}
    </nav>
  );
}

export default function AmeliaFlowScreen() {
  const [step, setStep] = useState<FlowStep>(2);
  const [unlocked, setUnlocked] = useState(() => sessionStorage.getItem("amelia-unlocked") === "1");
  const [accessCode, setAccessCode] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [profile, setProfile] = useState<ProfileSummary | null>(null);
  const [resumeFile, setResumeFile] = useState<File | null>(null);
  const [jobFile, setJobFile] = useState<File | null>(null);
  const [jobText, setJobText] = useState("");
  const [jobUrl, setJobUrl] = useState("");
  const [targetTitle, setTargetTitle] = useState("");
  const [sources, setSources] = useState<SourceFile[]>([]);
  const [resumeText, setResumeText] = useState("");
  const wordCount = [resumeText, jobText, ...sources.map((source) => source.text)].join(" ").trim().split(/\s+/).filter(Boolean).length;
  const [application, setApplication] = useState<ApplicationDetail | null>(null);
  const [feedback, setFeedback] = useState("");
  const [chatMessages, setChatMessages] = useState<ConversationMessage[]>([]);
  const [replyPending, setReplyPending] = useState(false);
  const [replyError, setReplyError] = useState<string | null>(null);
  const [pendingRequest, setPendingRequest] = useState<{ id: number; version: number; rawText: string; started: number } | null>(null);
  const interruptedRequest = useRef<typeof pendingRequest>(null);
  const sending = useRef(false);
  const lastRequest = useRef("");
  const [documents, setDocuments] = useState<VaultDocument[]>([]);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [resumeVaultId, setResumeVaultId] = useState<string | null>(null);
  const [jobVaultId, setJobVaultId] = useState<string | null>(null);
  const [vaultLoading, setVaultLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    listProfiles().then((profiles) => setProfile(profiles[0] ?? null)).catch(() => undefined);
  }, []);

  useEffect(() => {
    if (!pendingRequest) return;
    interruptedRequest.current = pendingRequest;
    let cancelled = false;
    let timer: number;
    async function poll() {
      try {
        const next = await getApplication(pendingRequest!.id);
        if (cancelled) return;
        setApplication(next);
        if (next.status === "ready" && next.version >= pendingRequest!.version) {
          setChatMessages((messages) => [...messages, {
            role: "amelia",
            text: next.tailoring_notes || next.resume?.summary || "Your updated resume is ready. What would you like to refine next?",
            application: next,
            rawText: pendingRequest!.rawText,
          }]);
          interruptedRequest.current = null;
          setReplyPending(false);
          setPendingRequest(null);
          sending.current = false;
          return;
        }
        if (next.status === "error" || next.status === "needs_paste") {
          interruptedRequest.current = null;
          throw new Error(next.error_message || "The job link could not be read. Add the job description text in Build Resume, then retry.");
        }
        if (Date.now() - pendingRequest!.started > 300000) {
          throw new Error("The reply is taking longer than expected. Retry to check its progress.");
        }
        timer = window.setTimeout(poll, 1500);
      } catch (e) {
        if (!cancelled) {
          setReplyError(String(e));
          setReplyPending(false);
          setPendingRequest(null);
          sending.current = false;
        }
      }
    }
    timer = window.setTimeout(poll, 500);
    return () => { cancelled = true; window.clearTimeout(timer); };
  }, [pendingRequest]);

  useEffect(() => {
    if (!unlocked || step !== 4) return;
    let cancelled = false;
    setVaultLoading(true);
    listVaultDocuments()
      .then((items) => { if (!cancelled) setDocuments(items); })
      .catch((e) => { if (!cancelled) setError(String(e)); })
      .finally(() => { if (!cancelled) setVaultLoading(false); });
    return () => { cancelled = true; };
  }, [step, unlocked]);

  function unlock() {
    if (accessCode.trim().toLowerCase() !== ACCESS_CODE.toLowerCase()) {
      setError("That access code did not match.");
      return;
    }
    sessionStorage.setItem("amelia-unlocked", "1");
    setUnlocked(true);
    setError(null);
  }

  async function saveUpload(file: File | null, category: "Resume" | "Job description") {
    if (!file) return;
    if (file.size > 25 * 1024 * 1024) { setError("Each file must be 25 MB or smaller."); return; }
    setUploading(true);
    setError(null);
    try {
      const saved = await saveVaultDocument(file, category);
      setDocuments((items) => [saved, ...items]);
      if (category === "Resume") { setResumeFile(file); setResumeText(saved.text); setResumeVaultId(saved.id); }
      else {
        setJobFile(file);
        setJobVaultId(saved.id);
        setJobText(saved.text);
      }
    } catch (e) {
      setError(String(e));
    } finally {
      setUploading(false);
    }
  }

  async function removeDocument(id: string) {
    setRemovingId(id);
    setError(null);
    try {
      await removeVaultDocument(id);
      setDocuments((items) => items.filter((item) => item.id !== id));
      setSources((items) => items.filter((item) => item.id !== id));
      if (id === resumeVaultId) { setResumeFile(null); setResumeText(""); setResumeVaultId(null); }
      if (id === jobVaultId) { setJobFile(null); setJobText(""); setJobVaultId(null); }
    } catch (e) { setError(String(e)); }
    finally { setRemovingId(null); }
  }

  async function saveSources(files: File[]) {
    if (uploading || busy) return;
    setUploading(true);
    setError(null);
    try {
      for (const file of files) {
        if (file.size > 25 * 1024 * 1024 || !/\.(pdf|docx|txt|md)$/i.test(file.name)) {
          throw new Error("Use PDF, DOCX, TXT, or MD files up to 25 MB.");
        }
        const saved = await saveVaultDocument(file, "Coursework");
        setDocuments((items) => [saved, ...items]);
        setSources((items) => [...items, { id: saved.id, file, text: saved.text }]);
      }
    } catch (e) { setError(String(e)); }
    finally { setUploading(false); }
  }

  async function buildResume(requestText = "Build a tailored resume from my uploaded experience and target role.", retry = false) {
    if (!resumeFile || (!jobText.trim() && !/^https?:\/\//i.test(jobUrl.trim()))) {
      setError("Add a resume file and a job description before continuing.");
      return;
    }
    if (sending.current) return;
    sending.current = true;
    lastRequest.current = requestText;
    setReplyPending(true);
    setReplyError(null);
    setStep(3);
    if (!retry) setChatMessages((messages) => [...messages, { role: "user", text: requestText,
      files: [resumeFile, ...sources.map((source) => source.file), jobFile].filter((file): file is File => file !== null).map((file) => ({ name: file.name, size: file.size })) }]);
    setFeedback("");
    setBusy(true);
    setError(null);
    try {
      let profileId = profile?.id;
      if (profileId === undefined) {
        const created = await createProfile("Maya", {
          name: "Maya",
          email: "maya@example.com",
          links: [],
        });
        profileId = created.id;
        setProfile({
          id: created.id,
          name: created.name,
          contact: created.contact,
          has_master_profile: false,
        });
      }
      await uploadDocument(profileId, resumeFile);
      for (const source of sources) await uploadDocument(profileId, source.file);
      await buildProfile(profileId);
      const [created] = await createApplications(
        profileId,
        [{ url: jobUrl.trim() || "https://local.test/job-description", depth: "standard", template: "slate" }],
        "standard",
        "slate",
        !jobText.trim()
      );
      const description = `Resume request: ${requestText}\nPreferred target role: ${targetTitle.trim()}\n\n${jobText}`;
      const queued = jobText.trim() ? await pasteJobText(created.id, description) : created;
      setApplication(queued);
      setPendingRequest({ id: queued.id, version: queued.version, rawText: resumeText || sources[0]?.text || "", started: Date.now() });
    } catch (e) {
      setReplyError(String(e));
      setReplyPending(false);
      sending.current = false;
    } finally {
      setBusy(false);
    }
  }

  async function sendFeedback(retry = false) {
    const message = retry ? lastRequest.current : feedback.trim();
    if (!message || sending.current || busy || uploading) return;
    if (retry && interruptedRequest.current) {
      sending.current = true;
      setReplyPending(true);
      setReplyError(null);
      setPendingRequest({ ...interruptedRequest.current, started: Date.now() });
      return;
    }
    if (!application || application.status === "needs_paste" || (!application.parsed && application.status === "error")) {
      await buildResume(message, retry);
      return;
    }
    // Resume polling after a connection failure without launching duplicate work.
    if (!["ready", "error"].includes(application.status)) {
      sending.current = true;
      setReplyPending(true);
      setReplyError(null);
      setPendingRequest({ id: application.id, version: application.version, rawText: resumeText, started: Date.now() });
      return;
    }
    sending.current = true;
    lastRequest.current = message;
    setReplyPending(true);
    setReplyError(null);
    setError(null);
    if (!retry) setChatMessages((messages) => [...messages, { role: "user", text: message }]);
    setFeedback("");
    try {
      const next = await regenerate(application.id, message);
      setApplication({ ...next, status: "queued" });
      setPendingRequest({ id: application.id, version: application.version + 1, rawText: resumeText || sources[0]?.text || "", started: Date.now() });
    } catch (e) {
      setReplyError(String(e));
      setReplyPending(false);
      sending.current = false;
    }
  }

  if (!unlocked) {
    return (
      <main className="amelia-shell amelia-gate">
        <AmeliaLogo />
        <h1>Your Strategic Career &amp; Resume Builder</h1>
        <div className="amelia-panel amelia-login-panel">
          <h2>Welcome back Maya</h2>
          <p className="amelia-muted">Sign in to resume targeting your dream roles</p>
          <label className="amelia-label" htmlFor="access-code">Keyword : Home</label>
          <div className="amelia-input-wrap">
            <svg className="amelia-login-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true"><rect x="5" y="10" width="14" height="11" rx="2" /><path d="M8 10V7a4 4 0 0 1 8 0v3M12 14v3" /></svg>
            <input
              id="access-code"
              className="amelia-input"
              type={showPassword ? "text" : "password"}
              autoComplete="current-password"
              placeholder="Enter Password"
              value={accessCode}
              onChange={(e) => setAccessCode(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && unlock()}
            />
            <button type="button" className="amelia-password-toggle" aria-label={showPassword ? "Hide password" : "Show password"} onClick={() => setShowPassword((visible) => !visible)}>
              <svg className="amelia-login-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z" /><circle cx="12" cy="12" r="3" /></svg>
            </button>
          </div>
          <button className="amelia-primary" onClick={unlock}>Log in to Amelia <span>→</span></button>
          {error && <p className="amelia-error">{error}</p>}
        </div>
      </main>
    );
  }

  return (
    <main className={`amelia-shell amelia-workspace ${step === 3 ? "amelia-chat-desktop" : ""}`}>
      {step === 3 && <header className="amelia-desktop-header">
        <button className="amelia-wordmark" onClick={() => setStep(2)}><AmeliaLogo /></button>
        <span className="amelia-desktop-breadcrumb">› <b>Profile &amp; Resume Intelligence</b></span>
        <button className="amelia-desktop-vault" onClick={() => setStep(4)}>▱ Document Vault</button>
        <span className="amelia-desktop-profile">{profile?.contact?.name || profile?.name || "Your workspace"}</span>
      </header>}
      <aside className="amelia-sidebar" aria-label="Workspace sidebar">
        <button className="amelia-wordmark" aria-label="Amelia home" onClick={() => setStep(2)}><AmeliaLogo /></button>
        <p className="amelia-sidebar-caption">CAREER CO-PILOT</p>
        <SidebarNavigation step={step} onSelect={(next) => { setStep(next); setError(null); }} />
        <div className="amelia-sidebar-footer">
          <span>YOUR CAREER WORKSPACE</span>
          <small>Documents saved locally</small>
          <button onClick={() => { sessionStorage.removeItem("amelia-unlocked"); setUnlocked(false); }}>Lock workspace</button>
        </div>
      </aside>
      <div className="amelia-workspace-content">
      {error && <div className="amelia-error amelia-alert">{error}</div>}

      {step === 4 && (
        <section className="amelia-panel amelia-vault">
          <p className="amelia-eyebrow">YOUR DOCUMENTS</p>
          <h1>Document Vault</h1>
          <p className="amelia-muted">Your uploaded resumes and job descriptions, saved across visits.</p>
          {vaultLoading ? <p role="status">Loading documents...</p> : documents.length === 0 ? (
            <div className="amelia-vault-empty">
              <p>No uploaded files yet.</p>
              <button className="amelia-primary" onClick={() => setStep(2)}>Upload your first document</button>
            </div>
          ) : (
            <ul className="amelia-vault-list">
              {documents.map((document) => (
                <li key={document.id}>
                  <div><strong>{document.filename}</strong><small>{document.category} · {new Date(document.created_at).toLocaleDateString()}</small></div>
                  <div className="amelia-vault-actions">
                    <a className="amelia-vault-download" href={`/api/vault/${document.id}/download`} download aria-label={`Download ${document.filename}${document.original_available ? "" : " as saved text"}`} title={document.original_available ? "Download file" : "Download saved text"}>
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="M12 3v12m-5-5 5 5 5-5M5 16v4h14v-4" /></svg>
                    </a>
                    <button className="amelia-vault-remove" disabled={removingId !== null} onClick={() => { void removeDocument(document.id); }} aria-label={`Remove ${document.filename}`} title="Remove file">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18" /></svg>
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      {step === 2 && (
        <AmeliaChatWorkspace sources={sources} resumeFile={resumeFile} jobFile={jobFile}
          jobText={jobText} jobUrl={jobUrl} targetTitle={targetTitle} wordCount={wordCount}
          busy={busy || Boolean(application && !["ready", "error", "not_started"].includes(application.status))} uploading={uploading}
          onSources={(files) => { void saveSources(files); }}
          onRemoveSource={(id) => setSources((items) => items.filter((item) => item.id !== id))}
          onResume={(file) => { void saveUpload(file, "Resume"); }}
          onJob={(file) => { void saveUpload(file, "Job description"); }}
          onJobText={setJobText} onJobUrl={setJobUrl} onTargetTitle={setTargetTitle}
          onBuild={() => { void buildResume(); }} />
      )}

      {step === 3 && (
        <AmeliaConversation logo={<AmeliaLogo />} application={application} targetTitle={targetTitle}
          files={[resumeFile, ...sources.map((source) => source.file), jobFile].filter((file): file is File => file !== null)}
          wordCount={wordCount} rawText={resumeText || sources[0]?.text || ""}
          feedback={feedback} messages={chatMessages} busy={busy || uploading}
          replyPending={replyPending} replyError={replyError} onRetry={() => { void sendFeedback(true); }}
          onFeedback={setFeedback} onSend={() => { void sendFeedback(); }}
          onBuild={() => setStep(2)} onVault={() => setStep(4)}
          onDocument={() => { if (application) navigate(`/applications/${application.id}`); }} />
      )}

      </div>
    </main>
  );
}
