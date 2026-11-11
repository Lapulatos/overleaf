import type { DocumentContainer } from "./document-container";

// A superseded join may fail because the server has already joined the next
// document. Such a response must not replace the current editor with an error.
export function joinCurrentDocument<
  T extends Pick<DocumentContainer, "join" | "leaveAndCleanUp">,
>(document: T, isCurrent: () => boolean, onJoined: () => void): Promise<T> {
  return new Promise((resolve, reject) => {
    document.join((error) => {
      if (!isCurrent()) {
        // Only a successful stale join needs leaving. A failed join did not
        // acquire the document and must not issue another leave RPC.
        if (!error) document.leaveAndCleanUp();
        reject(new Error("another document was loaded"));
        return;
      }
      if (error) {
        reject(error);
        return;
      }
      onJoined();
      resolve(document);
    });
  });
}
