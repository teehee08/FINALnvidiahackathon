import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import AmeliaFlowScreen from "./AmeliaFlowScreen";
import { listProfiles, listVaultDocuments, saveVaultDocument, removeVaultDocument } from "../api";

vi.mock("../api", () => ({
  listProfiles: vi.fn(),
  listVaultDocuments: vi.fn(),
  saveVaultDocument: vi.fn(),
  removeVaultDocument: vi.fn(),
}));

beforeEach(() => {
  sessionStorage.setItem("amelia-unlocked", "1");
  vi.mocked(listProfiles).mockResolvedValue([]);
  vi.mocked(listVaultDocuments).mockResolvedValue([]);
});
afterEach(() => sessionStorage.clear());

it("opens directly to the resume form and preserves uploads when navigating to the vault", async () => {
  const saved = { id: "file-1", filename: "my-resume.txt", category: "Resume",
    created_at: "2026-09-12T12:00:00Z", original_available: true };
  vi.mocked(saveVaultDocument).mockResolvedValue({ ...saved, text: "Resume" });
  vi.mocked(listVaultDocuments).mockResolvedValue([saved]);
  render(<MemoryRouter><AmeliaFlowScreen /></MemoryRouter>);
  expect(screen.queryByText(/Secure entry/)).not.toBeInTheDocument();
  expect(screen.queryByText(/Bring the evidence/)).not.toBeInTheDocument();
  const file = new File(["Resume"], "my-resume.txt", { type: "text/plain" });
  fireEvent.change(screen.getByLabelText(/Upload existing resume baseline/), { target: { files: [file] } });
  await screen.findByText("my-resume.txt");
  fireEvent.click(screen.getByRole("button", { name: "Raw Text Input" }));
  fireEvent.change(screen.getByPlaceholderText("Paste the full job description here..."), {
    target: { value: "Product manager role" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Document Vault" }));
  expect(await screen.findByRole("link", { name: "Download my-resume.txt" })).toHaveAttribute("href", "/api/vault/file-1/download");
  fireEvent.click(screen.getByRole("button", { name: "Build Resume" }));
  expect(screen.getByText("my-resume.txt")).toBeInTheDocument();
  expect(screen.getByPlaceholderText("Paste the full job description here...")).toHaveValue("Product manager role");
  fireEvent.click(screen.getByRole("button", { name: "Chat" }));
  expect(screen.getByRole("region", { name: "Chat with Amelia" })).toBeInTheDocument();
});

it("shows an upload failure without pretending the file was saved", async () => {
  vi.mocked(saveVaultDocument).mockRejectedValue(new Error("Upload failed"));
  render(<MemoryRouter><AmeliaFlowScreen /></MemoryRouter>);
  fireEvent.change(screen.getByLabelText(/Upload existing resume baseline/), {
    target: { files: [new File(["x"], "failed.txt")] },
  });
  await waitFor(() => expect(screen.getByText(/Upload failed/)).toBeInTheDocument());
  expect(screen.queryByText("failed.txt")).not.toBeInTheDocument();
});

it("shows the welcome branding and goes straight to build after unlocking", async () => {
  sessionStorage.clear();
  render(<MemoryRouter><AmeliaFlowScreen /></MemoryRouter>);
  expect(screen.getByRole("heading", { name: "Your Strategic Career & Resume Builder" })).toBeInTheDocument();
  fireEvent.change(screen.getByPlaceholderText("Enter Password"), { target: { value: "Home" } });
  fireEvent.click(screen.getByRole("button", { name: /Log in to Amelia/ }));
  expect(screen.getByLabelText(/Upload existing resume baseline/)).toBeInTheDocument();
  await waitFor(() => expect(listProfiles).toHaveBeenCalled());
});

it("tracks uploaded coursework in the resume builder and can remove it from the package", async () => {
  vi.mocked(saveVaultDocument).mockResolvedValue({
    id: "file-9", filename: "project.md", category: "Coursework",
    created_at: "2026-09-12T12:00:00Z", original_available: true, text: "Built a useful application",
  });
  render(<MemoryRouter><AmeliaFlowScreen /></MemoryRouter>);
  expect(screen.getByRole("button", { name: "Build Resume" })).toHaveAttribute("aria-current", "page");
  expect(screen.getByText("0 of 3 steps completed")).toBeInTheDocument();
  expect(screen.getByRole("button", { name: /Curate & Elevate/ })).toBeDisabled();
  fireEvent.change(screen.getByLabelText("Upload raw files and coursework"), {
    target: { files: [new File(["Built a useful application"], "project.md")] },
  });
  expect(await screen.findByText("project.md")).toBeInTheDocument();
  expect(saveVaultDocument).toHaveBeenCalledWith(expect.any(File), "Coursework");
  expect(screen.getByText("1 of 3 steps completed")).toBeInTheDocument();
  expect(screen.getByText("4")).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Remove project.md from this resume" }));
  expect(screen.queryByText("project.md")).not.toBeInTheDocument();
  expect(screen.getByText("0 of 3 steps completed")).toBeInTheDocument();
});

it("removes a vault entry only after the API succeeds", async () => {
  vi.mocked(listVaultDocuments).mockResolvedValue([{ id: "file-3", filename: "notes.txt", category: "Coursework", created_at: "2026-09-12T12:00:00Z", original_available: true }]);
  vi.mocked(removeVaultDocument).mockResolvedValue({ removed: "file-3" });
  render(<MemoryRouter><AmeliaFlowScreen /></MemoryRouter>);
  fireEvent.click(screen.getByRole("button", { name: "Document Vault" }));
  fireEvent.click(await screen.findByRole("button", { name: "Remove notes.txt" }));
  await waitFor(() => expect(screen.queryByText("notes.txt")).not.toBeInTheDocument());
  expect(removeVaultDocument).toHaveBeenCalledWith("file-3");
});
