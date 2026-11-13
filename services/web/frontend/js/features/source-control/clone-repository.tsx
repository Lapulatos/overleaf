import MaterialIcon from '@/shared/components/material-icon'
import { useState } from "react";
import { Modal } from "react-bootstrap";
import type { GitCommand } from "./api";
import type { GitSnapshot } from "./types";
export default function CloneRepository({
  command,
  busy,
  error,
  onClose,
}: {
  command: (value: GitCommand) => Promise<GitSnapshot | undefined>;
  busy: boolean;
  error: string;
  onClose: () => void;
}) {
  const [url, setUrl] = useState(""),
    [branch, setBranch] = useState(""),
    [name, setName] = useState(""),
    [username, setUsername] = useState(""),
    [token, setToken] = useState("");
  const [operationId, setOperationId] = useState(() => crypto.randomUUID());
  const [result, setResult] = useState<{ url: string; branch?: string }>();
  const change = (fn: () => void) => {
    fn();
    setOperationId(crypto.randomUUID());
  };
  return (
    <Modal className="native-git-dialog"
      show
      onHide={() => {
        if (!busy) onClose();
      }}
      aria-label="Clone repository"
    >
      <Modal.Header closeButton>
        <Modal.Title>Clone repository</Modal.Title>
      </Modal.Header>
      <form
        onSubmit={async (event) => {
          event.preventDefault();
          const value = await command({
            command: "clone",
            url,
            name,
            operationId,
            ...(branch ? { branch } : {}),
            ...(username || token ? { username, token } : {}),
          });
          if (value?.result) {
            setResult(value.result as any);
            setToken("");
          }
        }}
      >
        <Modal.Body>
          {error && <p role="alert">{error}</p>}
          {result ? (
            <>
              <p>Repository cloned successfully.</p>
              <a href={result.url}>Open cloned project</a>
            </>
          ) : (
            <>
              <p>
                Create a new paper project from a repository URL, including its
                Git history and remote.
              </p>
              <label className="native-git-field">
                Repository URL
                <input
                  type="url"
                  className="form-control"
                  required
                  value={url}
                  disabled={busy}
                  onChange={(e) => change(() => setUrl(e.target.value))}
                />
              </label>
              <label className="native-git-field">
                Project name
                <input
                  className="form-control"
                  required
                  maxLength={150}
                  value={name}
                  disabled={busy}
                  onChange={(e) => change(() => setName(e.target.value))}
                />
              </label>
              <label className="native-git-field">
                Branch (optional)
                <input
                  className="form-control"
                  value={branch}
                  disabled={busy}
                  onChange={(e) => change(() => setBranch(e.target.value))}
                />
              </label>
              <label className="native-git-field">
                Username (private repository)
                <input
                  className="form-control"
                  autoComplete="username"
                  value={username}
                  disabled={busy}
                  onChange={(e) => setUsername(e.target.value)}
                />
              </label>
              <label className="native-git-field">
                Access token
                <input
                  className="form-control"
                  type="password"
                  autoComplete="off"
                  value={token}
                  disabled={busy}
                  onChange={(e) => setToken(e.target.value)}
                />
              </label>
            </>
          )}
        </Modal.Body>
        <Modal.Footer>
          <button
            type="button"
            className="btn btn-default"
            disabled={busy}
            onClick={onClose}
          ><MaterialIcon type="close" />
            {result ? "Close" : "Cancel"}
          </button>
          {!result && (
            <button
              className="btn btn-primary"
              type="submit"
              disabled={
                busy || !url.trim() || !name.trim() || !!username !== !!token
              }
            >
              {busy ? "Cloning…" : "Clone"}
            </button>
          )}
        </Modal.Footer>
      </form>
    </Modal>
  );
}
