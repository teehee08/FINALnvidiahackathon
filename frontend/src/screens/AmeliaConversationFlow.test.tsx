import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import AmeliaFlowScreen from "./AmeliaFlowScreen";
import * as api from "../api";
import type { ApplicationDetail, ProfileSummary } from "../types";

vi.mock("../api", () => ({
  listProfiles: vi.fn(), listVaultDocuments: vi.fn(), saveVaultDocument: vi.fn(),
  uploadDocument: vi.fn(), buildProfile: vi.fn(), createApplications: vi.fn(),
  pasteJobText: vi.fn(), getApplication: vi.fn(), regenerate: vi.fn(),
}));

const draft = {
  id: 1, version: 1, status: "queued", resume: null, parsed: { title: "Designer" },
  title: "Designer", tailoring_notes: null,
} as ApplicationDetail;

beforeEach(() => {
  sessionStorage.setItem("amelia-unlocked", "1");
  vi.mocked(api.listProfiles).mockResolvedValue([{ id: 1 }] as ProfileSummary[]);
  vi.mocked(api.saveVaultDocument).mockResolvedValue({
    id: "file-1", filename: "resume.txt", category: "Resume", original_available: true,
    created_at: "2026-09-12T12:00:00Z", text: "Built useful products",
  });
  vi.mocked(api.createApplications).mockResolvedValue([draft]);
  vi.mocked(api.pasteJobText).mockResolvedValue(draft);
});
afterEach(() => { sessionStorage.clear(); vi.useRealTimers(); });

async function prepare() {
  render(<MemoryRouter><AmeliaFlowScreen /></MemoryRouter>);
  fireEvent.change(screen.getByLabelText("Upload existing resume baseline"), {
    target: { files: [new File(["Experience"], "resume.txt")] },
  });
  await screen.findByText("resume.txt");
  fireEvent.click(screen.getByRole("button", { name: "Raw Text Input" }));
  fireEvent.change(screen.getByPlaceholderText("Paste the full job description here..."), { target: { value: "Designer role" } });
  fireEvent.click(screen.getByRole("button", { name: "Chat" }));
}

it("renders user then completed reply, ignores stale draft, and preserves prior turns", async () => {
  let finishFirst!: (value: ApplicationDetail) => void;
  vi.mocked(api.getApplication).mockImplementationOnce(() => new Promise((resolve) => { finishFirst = resolve; }));
  await prepare();
  const log = screen.getByRole("log");
  expect(log).toBeEmptyDOMElement();
  fireEvent.change(screen.getByLabelText("Refinement message"), { target: { value: "Emphasize my projects" } });
  fireEvent.click(screen.getByRole("button", { name: "Send refinement" }));
  expect(within(log).getByText("Emphasize my projects")).toBeInTheDocument();
  expect(screen.getByRole("status")).toHaveTextContent("Amelia is working");
  expect(screen.queryByText("REPLY READY")).not.toBeInTheDocument();
  await waitFor(() => expect(finishFirst).toBeTypeOf("function"));
  await act(async () => finishFirst({ ...draft, status: "ready", tailoring_notes: "I highlighted your projects." }));
  expect(await screen.findByText("I highlighted your projects.")).toBeInTheDocument();

  vi.mocked(api.regenerate).mockResolvedValue({ ...draft, status: "ready" });
  let finishSecond!: (value: ApplicationDetail) => void;
  vi.mocked(api.getApplication)
    .mockResolvedValueOnce({ ...draft, status: "ready", tailoring_notes: "STALE RESPONSE" })
    .mockImplementationOnce(() => new Promise((resolve) => { finishSecond = resolve; }));
  fireEvent.change(screen.getByLabelText("Refinement message"), { target: { value: "Make it concise" } });
  fireEvent.click(screen.getByRole("button", { name: "Send refinement" }));
  expect(screen.getByRole("button", { name: "Send refinement" })).toBeDisabled();
  await waitFor(() => expect(finishSecond).toBeTypeOf("function"), { timeout: 3000 });
  expect(screen.queryByText("STALE RESPONSE")).not.toBeInTheDocument();
  await act(async () => finishSecond({ ...draft, version: 2, status: "ready", tailoring_notes: "I shortened the descriptions." }));
  expect(await screen.findByText("I shortened the descriptions.")).toBeInTheDocument();
  expect(Array.from(log.querySelectorAll(".conversation-message-text")).map((node) => node.textContent)).toEqual([
    "Emphasize my projects", "I highlighted your projects.", "Make it concise", "I shortened the descriptions.",
  ]);
});

it("keeps the user message and shows a retry action when generation fails", async () => {
  vi.mocked(api.buildProfile).mockRejectedValueOnce(new Error("Local inference is unavailable"));
  await prepare();
  fireEvent.change(screen.getByLabelText("Refinement message"), { target: { value: "Tailor my resume" } });
  fireEvent.click(screen.getByRole("button", { name: "Send refinement" }));
  expect(await screen.findByRole("alert")).toHaveTextContent("Local inference is unavailable");
  expect(screen.getByRole("log")).toHaveTextContent("Tailor my resume");
  expect(screen.getByRole("button", { name: "Retry reply" })).toBeInTheDocument();
  expect(screen.queryByText("REPLY READY")).not.toBeInTheDocument();
});
