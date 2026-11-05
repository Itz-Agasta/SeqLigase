import { describe, expect, it } from "vite-plus/test";
import { createFpsMonitor, PARTICLES, qualityFromSearch } from "./quality";

describe("quality", () => {
  it("defaults to high and honours the URL", () => {
    expect(qualityFromSearch("")).toBe("high");
    expect(qualityFromSearch("?quality=low")).toBe("low");
    expect(qualityFromSearch("?quality=high")).toBe("high");
    expect(qualityFromSearch("?quality=banana")).toBe("high");
  });

  it("has fewer particles on the low tier", () => {
    expect(PARTICLES.low).toBe(800);
    expect(PARTICLES.high).toBeGreaterThan(PARTICLES.low);
  });

  it("downgrades once after sustained low frame rate", () => {
    let downgraded = 0;
    const monitor = createFpsMonitor(() => downgraded++);
    for (let i = 0; i < 120; i++) monitor.frame(1 / 15);
    expect(downgraded).toBe(1);
    for (let i = 0; i < 120; i++) monitor.frame(1 / 60);
    for (let i = 0; i < 120; i++) monitor.frame(1 / 15);
    expect(downgraded).toBe(1);
  });

  it("reacts within three seconds at a very low frame rate", () => {
    let downgraded = 0;
    const monitor = createFpsMonitor(() => downgraded++);
    for (let i = 0; i < 30; i++) monitor.frame(0.1);
    expect(downgraded).toBe(1);
  });

  it("ignores a brief stutter", () => {
    let downgraded = 0;
    const monitor = createFpsMonitor(() => downgraded++);
    for (let i = 0; i < 20; i++) monitor.frame(1 / 15);
    for (let i = 0; i < 300; i++) monitor.frame(1 / 60);
    expect(downgraded).toBe(0);
  });

  it("ignores a very long frame, such as a hidden tab", () => {
    let downgraded = 0;
    const monitor = createFpsMonitor(() => downgraded++);
    for (let i = 0; i < 5; i++) monitor.frame(3);
    expect(downgraded).toBe(0);
  });
});
