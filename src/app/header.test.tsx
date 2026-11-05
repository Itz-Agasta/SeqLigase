import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vite-plus/test";
import { Header } from "./header";

afterEach(cleanup);

describe("Header", () => {
  it("makes the title the page heading, with a note and actions", () => {
    render(
      <Header title="Experiments" note="Eight runs" actions={<button type="button">Act</button>} />,
    );
    expect(screen.getByRole("heading", { level: 1, name: "Experiments" })).toBeTruthy();
    expect(screen.getByText("Eight runs")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Act" })).toBeTruthy();
  });

  it("works with only a title", () => {
    render(<Header title="Models" />);
    expect(screen.getAllByRole("heading")).toHaveLength(1);
  });

  it("can show a parent section before the title", () => {
    render(<Header parent="Repair Lab" title="Phenol" />);
    expect(screen.getByText("Repair Lab")).toBeTruthy();
    expect(screen.getByRole("heading", { level: 1, name: "Phenol" })).toBeTruthy();
  });
});
