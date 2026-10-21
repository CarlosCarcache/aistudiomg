import { describe, it, expect } from "bun:test";
import { sharedOrderSchema, sharedImageTotal } from "./shared-order";

describe("shared gallery orders", () => {
  it("adds each selected image price once", () => {
    expect(sharedImageTotal([{ price: 100 }, { price: 250 }])).toBe(350);
  });
  it("rejects selections without images", () => {
    expect(sharedOrderSchema.safeParse({ name: "Cliente", phone: "", notes: "", imageIds: [] }).success).toBe(false);
  });
});