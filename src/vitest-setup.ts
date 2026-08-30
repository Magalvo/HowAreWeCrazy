import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach, beforeAll, vi } from "vitest";

beforeAll(() => {
  // Screen changes scroll back to the top, which jsdom does not implement.
  vi.stubGlobal("scrollTo", () => {});
});

afterEach(() => {
  cleanup();
  localStorage.clear();
});
