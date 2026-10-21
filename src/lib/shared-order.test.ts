import { describe, it } from "node:test";
import { strict as assert } from "node:assert";
import { sharedOrderSchema, sharedImageTotal } from "./shared-order";

describe("shared gallery orders", () => {
  it("adds each selected image price once", () => {
    assert.equal(sharedImageTotal([{ price: 100 }, { price: 250 }]), 350);
  });
  it("rejects selections without images", () => {
    assert.equal(sharedOrderSchema.safeParse({ name: "Cliente", phone: "", notes: "", imageIds: [] }).success, false);
  });
});