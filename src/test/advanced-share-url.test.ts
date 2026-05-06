import { describe, it, expect, beforeEach } from "vitest";

// Minimal copies of the encode/decode helpers from AdvancedPage so we can
// round-trip without needing the React tree.
function encode(payload: any): string {
  const json = JSON.stringify(payload);
  return btoa(unescape(encodeURIComponent(json)));
}
function decode(enc: string): any {
  const json = decodeURIComponent(escape(atob(enc)));
  return JSON.parse(json);
}

describe("advanced share URL round-trip", () => {
  beforeEach(() => {
    window.history.replaceState({}, "", "/advanced");
  });

  it("encodes and decodes a payload through the URL hash", () => {
    const payload = {
      p: "A.J. Lawson",
      a: ["ejection", "block", "2pt"],
      sf: { qualifiers: [], subtype: [], area: [], shotresult: [], isaftertimeout: false, isbuzzerbeater: false, shotdistancemin: null, shotdistancemax: null },
    };
    const enc = encode(payload);
    const url = `${window.location.origin}/advanced#nbaps=${enc}`;
    window.history.replaceState({}, "", url.replace(window.location.origin, ""));

    const hash = window.location.hash.replace(/^#\/?/, "");
    const got = new URLSearchParams(hash).get("nbaps");
    expect(got).toBe(enc);
    expect(decode(got!)).toEqual(payload);
  });

  it("survives a leading slash in the hash", () => {
    const enc = encode({ p: "X", a: ["block"] });
    window.history.replaceState({}, "", `/advanced#/nbaps=${enc}`);
    const hash = window.location.hash.replace(/^#\/?/, "");
    expect(new URLSearchParams(hash).get("nbaps")).toBe(enc);
  });
});