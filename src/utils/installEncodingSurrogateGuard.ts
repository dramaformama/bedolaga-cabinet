import { sanitizeSurrogates } from './sanitizeSurrogates';

/**
 * App-wide guard against the "String contained an illegal UTF-16 sequence" crash.
 *
 * A lone (unpaired) UTF-16 surrogate — typically a truncated emoji in a backend
 * name/remark that ends up in a subscription/connection URL — makes encodeURI /
 * encodeURIComponent throw a URIError on iOS WebKit/JavaScriptCore (V8: "URI
 * malformed"; Safari/JSC: "String contained an illegal UTF-16 sequence"). Any
 * code path that encodes such a string crashes — including third-party libs we
 * can't edit (e.g. qrcode.react calls encodeURI internally) and any encode call
 * added later. The base64 idiom btoa(unescape(encodeURIComponent(x))) is covered
 * transitively, since its encodeURIComponent is guarded here. (We do NOT patch
 * btoa itself: it rejects every char > U+00FF — Cyrillic, emoji, even the U+FFFD
 * replacement — with a separate "Invalid character" error that sanitising
 * surrogates cannot fix, and nothing base64-encodes raw Unicode directly.)
 *
 * Instead of wrapping every (current and future) call site, we sanitise at the
 * single chokepoint: the global encoders themselves. This is fail-safe, not
 * fail-broken — for any well-formed string there are no lone surrogates, so the
 * output is byte-for-byte identical; only strings that would otherwise have
 * thrown get their lone surrogates replaced with U+FFFD (the same remedy as
 * String.prototype.toWellFormed()).
 *
 * Must run before any rendering or network call. Idempotent.
 */
export function installEncodingSurrogateGuard(): void {
  const flag = '__surrogateEncoderGuardInstalled';
  const g = globalThis as typeof globalThis & Record<string, unknown>;
  if (g[flag]) return;
  g[flag] = true;

  const nativeEncodeURI = globalThis.encodeURI;
  const nativeEncodeURIComponent = globalThis.encodeURIComponent;

  globalThis.encodeURI = (uri: string): string => nativeEncodeURI(sanitizeSurrogates(String(uri)));
  globalThis.encodeURIComponent = (uriComponent: string | number | boolean): string =>
    nativeEncodeURIComponent(sanitizeSurrogates(String(uriComponent)));
}
