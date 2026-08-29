import 'fake-indexeddb/auto';

const dialogProto = HTMLDialogElement.prototype as unknown as Record<string, unknown>;
if (typeof dialogProto['showModal'] !== 'function') {
  dialogProto['showModal'] = function () {
    // no-op
  };
}
if (typeof dialogProto['close'] !== 'function') {
  dialogProto['close'] = function (returnValue?: string) {
    (this as unknown as HTMLDialogElement).returnValue = returnValue ?? '';
    (this as unknown as HTMLDialogElement).dispatchEvent(new Event('close'));
  };
}
