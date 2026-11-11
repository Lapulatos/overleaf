import { expect } from "chai";
import sinon from "sinon";
import { joinCurrentDocument } from "@/features/ide-react/editor/join-current-document";

function fixture() {
  let callback: (error?: Error) => void = () => {};
  const document = {
    join: (cb?: (error?: Error) => void) => {
      callback = cb!;
    },
    leaveAndCleanUp: sinon.stub(),
  };
  const bind = sinon.stub();
  let current = true;
  const result = joinCurrentDocument(document, () => current, bind);
  return {
    document,
    bind,
    result,
    finish: (error?: Error) => callback(error),
    supersede: () => {
      current = false;
    },
  };
}

describe("joining the current editor document", function () {
  it("discards a superseded join error without leaving the new document", async function () {
    const old = fixture();
    old.supersede();
    const next = fixture();
    next.finish();
    expect(await next.result).to.equal(next.document);
    old.finish(new Error("JoinLeaveEpochMismatchError"));
    await expect(old.result).to.be.rejectedWith("another document was loaded");
    expect(old.bind).not.to.have.been.called;
    expect(old.document.leaveAndCleanUp).not.to.have.been.called;
    expect(next.bind).to.have.been.calledOnce;
  });
  it("cleans up a successful superseded join without binding it", async function () {
    const old = fixture();
    old.supersede();
    old.finish();
    await expect(old.result).to.be.rejectedWith("another document was loaded");
    expect(old.document.leaveAndCleanUp).to.have.been.calledOnce;
    expect(old.bind).not.to.have.been.called;
  });
  it("preserves the actual error for the current document", async function () {
    const current = fixture();
    const error = new Error("permission denied");
    current.finish(error);
    await expect(current.result).to.be.rejectedWith(error);
    expect(current.bind).not.to.have.been.called;
    expect(current.document.leaveAndCleanUp).not.to.have.been.called;
  });
  it("binds the current document before resolving", async function () {
    const current = fixture();
    current.finish();
    expect(await current.result).to.equal(current.document);
    expect(current.bind).to.have.been.calledOnce;
    expect(current.document.leaveAndCleanUp).not.to.have.been.called;
  });
});
