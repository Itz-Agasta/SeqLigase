import { describe, expect, it } from "vite-plus/test";
import { bondLength, DEFAULT_LOOK, stepZoom, vdwRadius, zoomLook, ZOOM_LIMITS } from "./look";

describe("zoomLook", () => {
  it("shows translucent shells around ball-and-stick at the default distance", () => {
    const look = zoomLook(1);
    expect(look).toEqual(DEFAULT_LOOK);
    expect(look.solid).toBe(0);
    expect(look.shell).toBeGreaterThan(0);
    expect(look.labels).toBe(0);
    expect(look.lengths).toBe(0);
  });

  it("is solid space-filling when far away", () => {
    const look = zoomLook(ZOOM_LIMITS.max);
    expect(look.solid).toBe(1);
    expect(look.labels).toBe(0);
  });

  it("drops the shells and labels every atom when close", () => {
    const look = zoomLook(0.55);
    expect(look.shell).toBe(0);
    expect(look.labels).toBe(1);
    expect(look.lengths).toBe(0);
  });

  it("adds bond lengths when very close", () => {
    expect(zoomLook(ZOOM_LIMITS.min).lengths).toBe(1);
  });

  it("blends without jumps as the camera moves", () => {
    let previous = zoomLook(ZOOM_LIMITS.min);
    for (let r = ZOOM_LIMITS.min; r <= ZOOM_LIMITS.max; r += 0.01) {
      const look = zoomLook(r);
      for (const key of ["solid", "shell", "labels", "lengths"] as const) {
        expect(Math.abs(look[key] - previous[key])).toBeLessThan(0.12);
      }
      previous = look;
    }
  });
});

describe("stepZoom", () => {
  it("moves closer and further within the limits", () => {
    expect(stepZoom(1, -1)).toBeLessThan(1);
    expect(stepZoom(1, 1)).toBeGreaterThan(1);
    expect(stepZoom(ZOOM_LIMITS.min, -1)).toBe(ZOOM_LIMITS.min);
    expect(stepZoom(ZOOM_LIMITS.max, 1)).toBe(ZOOM_LIMITS.max);
  });
});

describe("chemistry helpers", () => {
  it("uses Bondi van der Waals radii", () => {
    expect(vdwRadius("C")).toBe(1.7);
    expect(vdwRadius("H")).toBe(1.2);
    expect(vdwRadius("O")).toBe(1.52);
    expect(vdwRadius("N")).toBe(1.55);
    expect(vdwRadius("F")).toBe(1.47);
  });
  it("formats a bond length in angstroms", () => {
    expect(bondLength([0, 0, 0], [1.395, 0, 0])).toBe("1.40 Å");
  });
});
